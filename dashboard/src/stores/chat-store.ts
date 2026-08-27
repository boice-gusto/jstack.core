import { create } from "zustand";

import type { AgentStreamBody } from "@/lib/agent-request-schema";
import {
  applyAgentStreamEvent,
  initialAgentRunSlice,
  newRunId,
  nextRunStateForDraft,
  type RunState,
  type ToolEvent,
} from "@/lib/agent-run-shared";
import { runAgentStream, type AgentStreamEvent } from "@/lib/agent-stream-runner";

export type { AgentStreamEvent } from "@/lib/agent-stream-runner";
export type { RunState, ToolEvent } from "@/lib/agent-run-shared";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
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
  ...initialAgentRunSlice(),
  lastRunContext: null,
  skillId: "",
  expectStructuredJson: false,

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
      ...initialAgentRunSlice(),
      lastRunContext: null,
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

    const onEvent = (evt: AgentStreamEvent): void => {
      const current = get();
      const applied = applyAgentStreamEvent(evt, draft, current);
      draft = applied.draft;
      set(applied.patch);

      // Extras that only apply to this surface, not shared with wizard-store:
      if (evt.type === "start" && typeof evt.cwd === "string") {
        const sid = evt.skillId;
        set({
          lastRunContext: {
            cwd: evt.cwd,
            skillId: typeof sid === "string" && sid.length > 0 ? sid : null,
          },
        });
      }
      if (evt.type === "result") {
        const resultText =
          typeof evt.result === "string" ? evt.result.trim() : "";
        if (resultText.length > 0 && draft.trim().length === 0) {
          draft += resultText;
          set((s) => ({ run: nextRunStateForDraft(s.run, draft) }));
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

    if (get().run.status === "error") {
      // Same rule as wizard-store: a server-reported "error" event doesn't throw --
      // runAgentStream resolves normally -- so a partial draft can exist alongside a real
      // error. Committing it as a successful assistant message would hide the error and
      // flip status to "done" as if the run had actually succeeded.
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
