import { create } from "zustand";

import type { AgentStreamBody } from "@/lib/agent-request-schema";

export const WIZARD_STEPS = [
  { id: "context", label: "Context", prompt: "Summarize the problem and constraints in 3–5 bullets." },
  { id: "options", label: "Options", prompt: "List 2–3 viable approaches with tradeoffs." },
  { id: "recommendation", label: "Recommendation", prompt: "Pick one approach and justify it briefly." },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

type WizardMessage = { role: "user" | "assistant"; content: string };

type WizardState = {
  stepIndex: number;
  transcript: WizardMessage[];
  /** Optional user notes appended to the current step prompt when running. */
  stepContext: string;
  assistantDraft: string;
  toolEvents: { id: string; name: string; input: unknown }[];
  streamEvents: Record<string, unknown>[];
  costSeries: number[];
  tokenSeries: number[];
  isStreaming: boolean;
  error: string | null;
  skillId: string;
  expectStructuredJson: boolean;
  structuredJsonText: string | null;
  setSkillId: (id: string) => void;
  setExpectStructuredJson: (v: boolean) => void;
  setStepContext: (text: string) => void;
  nextStep: () => Promise<void>;
  resetWizard: () => void;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useWizardStore = create<WizardState>((set, get) => ({
  stepIndex: 0,
  transcript: [],
  stepContext: "",
  assistantDraft: "",
  toolEvents: [],
  streamEvents: [],
  costSeries: [],
  tokenSeries: [],
  isStreaming: false,
  error: null,
  skillId: "",
  expectStructuredJson: false,
  structuredJsonText: null,

  setSkillId: (id: string) => set({ skillId: id }),
  setExpectStructuredJson: (v: boolean) => set({ expectStructuredJson: v }),
  setStepContext: (text: string) => set({ stepContext: text }),

  resetWizard: () => {
    set({
      stepIndex: 0,
      transcript: [],
      stepContext: "",
      assistantDraft: "",
      toolEvents: [],
      streamEvents: [],
      costSeries: [],
      tokenSeries: [],
      error: null,
      structuredJsonText: null,
    });
  },

  nextStep: async () => {
    const {
      stepIndex,
      transcript,
      stepContext,
      skillId,
      expectStructuredJson,
      isStreaming,
    } = get();
    if (isStreaming) {
      return;
    }
    if (stepIndex >= WIZARD_STEPS.length) {
      return;
    }

    const step = WIZARD_STEPS[stepIndex];
    const extra = stepContext.trim();
    const userLine =
      extra.length > 0
        ? `${step.prompt}\n\nAdditional context:\n${extra}`
        : step.prompt;
    const pendingUser: WizardMessage = { role: "user", content: userLine };
    const messagesForApi = [...transcript, pendingUser].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: AgentStreamBody = {
      messages: messagesForApi,
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

    const appendEvent = (evt: Record<string, unknown>): void => {
      set((s) => ({ streamEvents: [...s.streamEvents, evt] }));
      const type = evt.type;
      if (type === "text" && typeof evt.text === "string") {
        draft += evt.text;
        set({ assistantDraft: draft });
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
              const obj = JSON.parse(jsonStr) as Record<string, unknown>;
              appendEvent(obj);
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stream read error";
      set({ isStreaming: false, error: msg });
      return;
    }

    const finalContent = draft.trim();
    const assistantMsg: WizardMessage | null =
      finalContent.length > 0
        ? { role: "assistant", content: finalContent }
        : null;

    set((s) => ({
      transcript: [
        ...s.transcript,
        pendingUser,
        ...(assistantMsg !== null ? [assistantMsg] : []),
      ],
      stepIndex: s.stepIndex + 1,
      stepContext: "",
      assistantDraft: "",
      isStreaming: false,
      structuredJsonText:
        expectStructuredJson && assistantMsg !== null
          ? assistantMsg.content
          : null,
    }));
  },
}));
