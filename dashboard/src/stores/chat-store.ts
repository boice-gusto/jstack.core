import { create } from "zustand";

import type { AgentStreamBody } from "@/lib/agent-request-schema";
import {
  appendStderrToDraft,
  extractResultCost,
  extractResultTokenTotal,
  extractToolEventName,
  newRunId,
  nextRunStateForDraft,
  pushSeries,
  type RunState,
} from "@/lib/agent-run-shared";
import { runAgentStream, type AgentStreamEvent } from "@/lib/agent-stream-runner";

export type { AgentStreamEvent } from "@/lib/agent-stream-runner";
export type { RunState } from "@/lib/agent-run-shared";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

export type ToolEvent = {
  id: string;
  name: string;
  input: unknown;
};

export type AgentRunContext = {
  cwd: string;
  skillId: string | null;
};

type ChatState = {
  messages: ChatMessage[];
  run: RunState;
  toolEvents: ToolEvent[];
  streamEvents: AgentStreamEvent[];
  lastRunContext: AgentRunContext | null;
  costSeries: number[];
  tokenSeries: number[];
  skillId: string;
  expectStructuredJson: boolean;
  structuredJsonText: string | null;
  /** `claude` session id from the last run's `start` event; lets the next turn `--resume` instead
   *  of resending the whole transcript. Cleared by `resetConversation`. */
  claudeSessionId: string | null;
  appendUser: (content: string) => void;
  resetConversation: () => void;
  setSkillId: (id: string) => void;
  setExpectStructuredJson: (v: boolean) => void;
  runAgent: () => Promise<void>;
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  run: { status: "idle" },
  toolEvents: [],
  streamEvents: [],
  lastRunContext: null,
  costSeries: [],
  tokenSeries: [],
  skillId: "",
  expectStructuredJson: false,
  structuredJsonText: null,
  claudeSessionId: null,

  appendUser: (content: string) => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return;
    }
    set((s) => ({
      messages: [
        ...s.messages,
        { id: newRunId(), role: "user", content: trimmed },
      ],
    }));
  },

  resetConversation: () => {
    set({
      messages: [],
      run: { status: "idle" },
      toolEvents: [],
      streamEvents: [],
      lastRunContext: null,
      costSeries: [],
      tokenSeries: [],
      structuredJsonText: null,
      claudeSessionId: null,
    });
  },

  setSkillId: (id: string) => set({ skillId: id }),
  setExpectStructuredJson: (v: boolean) => set({ expectStructuredJson: v }),

  runAgent: async () => {
    const { messages, skillId, expectStructuredJson, run, claudeSessionId } = get();
    if (run.status === "streaming") {
      return;
    }
    if (messages.length === 0) {
      set({ run: { status: "error", message: "Add a message first.", draft: "" } });
      return;
    }

    // Resuming an existing `claude` session: it already holds every earlier turn, so only the
    // newest message needs to go over the wire. A fresh run (no session yet) still sends the
    // full transcript once, which is what establishes that session in the first place.
    const messagesToSend =
      claudeSessionId !== null ? messages.slice(-1) : messages;

    const body: AgentStreamBody = {
      messages: messagesToSend.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      skillId: skillId.trim().length > 0 ? skillId.trim() : undefined,
      expectStructuredJson: expectStructuredJson || undefined,
      surface: "agent",
      resumeSessionId: claudeSessionId ?? undefined,
    };

    set({
      run: { status: "streaming", draft: "" },
      streamEvents: [],
      toolEvents: [],
      structuredJsonText: null,
      lastRunContext: null,
    });

    let draft = "";

    // Keep updating the draft text as it streams in, without reviving a
    // "streaming" status once an error event has already flipped us to
    // "error" (the error stays visible; only the attached draft refreshes).
    const setDraft = (): void => {
      set((s) => ({ run: nextRunStateForDraft(s.run, draft) }));
    };

    const onEvent = (evt: AgentStreamEvent): void => {
      set((s) => ({ streamEvents: [...s.streamEvents, evt] }));
      const type = evt.type;
      if (type === "start" && typeof evt.cwd === "string") {
        const sid = evt.skillId;
        set({
          lastRunContext: {
            cwd: evt.cwd,
            skillId: typeof sid === "string" && sid.length > 0 ? sid : null,
          },
        });
      }
      if (type === "session" && typeof evt.sessionId === "string" && evt.sessionId.length > 0) {
        set({ claudeSessionId: evt.sessionId });
      }
      if (type === "text" && typeof evt.text === "string") {
        draft += evt.text;
        setDraft();
      }
      if (type === "error" && typeof evt.message === "string") {
        set({ run: { status: "error", message: evt.message, draft } });
      }
      if (type === "stderr" && typeof evt.text === "string") {
        const next = appendStderrToDraft(draft, evt.text);
        if (next !== draft) {
          draft = next;
          setDraft();
        }
      }
      if (type === "tool_use") {
        const name = extractToolEventName(evt);
        const input = evt.input;
        set((s) => ({
          toolEvents: [
            ...s.toolEvents,
            { id: newRunId(), name, input },
          ],
        }));
      }
      if (type === "result") {
        const cost = extractResultCost(evt);
        if (cost !== null) {
          set((s) => ({ costSeries: pushSeries(s.costSeries, cost) }));
        }
        const tokenTotal = extractResultTokenTotal(evt);
        if (tokenTotal !== null) {
          set((s) => ({ tokenSeries: pushSeries(s.tokenSeries, tokenTotal) }));
        }
        const resultText =
          typeof evt.result === "string" ? evt.result.trim() : "";
        if (resultText.length > 0 && draft.trim().length === 0) {
          draft += resultText;
          setDraft();
        }
      }
    };

    let exitCode: number | null = null;
    try {
      const result = await runAgentStream(body, onEvent);
      exitCode = result.exitCode;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stream error";
      set({ run: { status: "error", message: msg, draft } });
      return;
    }

    const finalContent = draft.trim();
    set((s) => {
      if (finalContent.length > 0) {
        return {
          messages: [
            ...s.messages,
            { id: newRunId(), role: "assistant" as const, content: finalContent },
          ],
          run: { status: "done" as const },
        };
      }
      if (s.run.status === "error") {
        // A server-side error already explains why there's no content;
        // leave it in place rather than overwriting it with "done".
        return {};
      }
      if (exitCode !== null && exitCode !== 0) {
        return {
          run: {
            status: "error" as const,
            message: `Agent process exited with code ${exitCode}. Check server logs and CLAUDE_BIN.`,
            draft: "",
          },
        };
      }
      return { run: { status: "done" as const } };
    });

    if (expectStructuredJson && finalContent.length > 0) {
      set({ structuredJsonText: finalContent });
    }
  },
}));
