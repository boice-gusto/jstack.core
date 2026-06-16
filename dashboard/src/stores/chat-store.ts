import { create } from "zustand";

import type { AgentStreamBody } from "@/lib/agent-request-schema";

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

export type AgentStreamEvent = Record<string, unknown>;

export type AgentRunContext = {
  cwd: string;
  skillId: string | null;
};

type ChatState = {
  messages: ChatMessage[];
  assistantDraft: string;
  toolEvents: ToolEvent[];
  streamEvents: AgentStreamEvent[];
  lastRunContext: AgentRunContext | null;
  costSeries: number[];
  tokenSeries: number[];
  isStreaming: boolean;
  error: string | null;
  skillId: string;
  expectStructuredJson: boolean;
  structuredJsonText: string | null;
  appendUser: (content: string) => void;
  resetConversation: () => void;
  setSkillId: (id: string) => void;
  setExpectStructuredJson: (v: boolean) => void;
  runAgent: () => Promise<void>;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  assistantDraft: "",
  toolEvents: [],
  streamEvents: [],
  lastRunContext: null,
  costSeries: [],
  tokenSeries: [],
  isStreaming: false,
  error: null,
  skillId: "",
  expectStructuredJson: false,
  structuredJsonText: null,

  appendUser: (content: string) => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return;
    }
    set((s) => ({
      messages: [
        ...s.messages,
        { id: newId(), role: "user", content: trimmed },
      ],
    }));
  },

  resetConversation: () => {
    set({
      messages: [],
      assistantDraft: "",
      toolEvents: [],
      streamEvents: [],
      lastRunContext: null,
      costSeries: [],
      tokenSeries: [],
      error: null,
      structuredJsonText: null,
    });
  },

  setSkillId: (id: string) => set({ skillId: id }),
  setExpectStructuredJson: (v: boolean) => set({ expectStructuredJson: v }),

  runAgent: async () => {
    const {
      messages,
      skillId,
      expectStructuredJson,
      isStreaming,
    } = get();
    if (isStreaming) {
      return;
    }
    if (messages.length === 0) {
      set({ error: "Add a message first." });
      return;
    }

    const body: AgentStreamBody = {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      skillId: skillId.trim().length > 0 ? skillId.trim() : undefined,
      expectStructuredJson: expectStructuredJson || undefined,
    };

    set({
      isStreaming: true,
      error: null,
      assistantDraft: "",
      streamEvents: [],
      toolEvents: [],
      structuredJsonText: null,
      lastRunContext: null,
    });

    let res: Response;
    try {
      res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      set({ isStreaming: false, error: msg });
      return;
    }

    if (!res.ok) {
      const text = await res.text();
      set({
        isStreaming: false,
        error: `Agent request failed (${res.status}): ${text.slice(0, 500)}`,
      });
      return;
    }

    const reader = res.body?.getReader();
    if (reader === undefined) {
      set({ isStreaming: false, error: "No response body" });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let draft = "";
    let exitCode: number | null = null;

    const appendEvent = (evt: AgentStreamEvent): void => {
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
      if (type === "text" && typeof evt.text === "string") {
        draft += evt.text;
        set({ assistantDraft: draft });
      }
      if (type === "error" && typeof evt.message === "string") {
        set({ error: evt.message });
      }
      if (type === "stderr" && typeof evt.text === "string") {
        const piece = evt.text.trimEnd();
        if (piece.length > 0) {
          draft += `${draft.length > 0 ? "\n\n" : ""}\`\`\`stderr\n${piece.slice(0, 8000)}\n\`\`\``;
          set({ assistantDraft: draft });
        }
      }
      if (type === "tool_use") {
        const name =
          typeof evt.name === "string" ? evt.name : "unknown_tool";
        const input = evt.input;
        set((s) => ({
          toolEvents: [
            ...s.toolEvents,
            { id: newId(), name, input },
          ],
        }));
      }
      if (type === "result") {
        const costUsd = evt.total_cost_usd;
        if (typeof costUsd === "number") {
          set((s) => ({
            costSeries: [...s.costSeries, costUsd].slice(-24),
          }));
        }
        const usage = evt.usage;
        if (
          typeof usage === "object" &&
          usage !== null &&
          !Array.isArray(usage)
        ) {
          const vals = Object.values(usage as Record<string, unknown>).filter(
            (v): v is number => typeof v === "number",
          );
          const total = vals.reduce((a, b) => a + b, 0);
          if (total > 0) {
            set((s) => ({
              tokenSeries: [...s.tokenSeries, total].slice(-24),
            }));
          }
        }
        const resultText =
          typeof evt.result === "string" ? evt.result.trim() : "";
        if (resultText.length > 0 && draft.trim().length === 0) {
          draft += resultText;
          set({ assistantDraft: draft });
        }
      }
      if (type === "done") {
        const code = evt.code;
        exitCode = typeof code === "number" ? code : null;
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length === 0) {
            continue;
          }
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.slice(5).trim();
            try {
              const obj = JSON.parse(jsonStr) as AgentStreamEvent;
              appendEvent(obj);
            } catch {
              // ignore malformed chunk
            }
          }
        }
      }
      const tail = buffer.trim();
      if (tail.length > 0 && tail.startsWith("data:")) {
        const jsonStr = tail.slice(5).trim();
        try {
          appendEvent(JSON.parse(jsonStr) as AgentStreamEvent);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stream read error";
      set({ isStreaming: false, error: msg });
      return;
    }

    const finalContent = draft.trim();
    if (finalContent.length > 0) {
      set((s) => ({
        messages: [
          ...s.messages,
          { id: newId(), role: "assistant", content: finalContent },
        ],
        assistantDraft: "",
      }));
      if (expectStructuredJson) {
        set({ structuredJsonText: finalContent });
      }
    } else if (exitCode !== null && exitCode !== 0) {
      set((s) => ({
        error:
          s.error ??
          `Agent process exited with code ${exitCode}. Check server logs and CLAUDE_BIN.`,
      }));
    }

    set({ isStreaming: false });
  },
}));
