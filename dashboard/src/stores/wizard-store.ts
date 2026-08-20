import { create } from "zustand";

import type { AgentStreamBody } from "@/lib/agent-request-schema";
import { runAgentStream, type AgentStreamEvent } from "@/lib/agent-stream-runner";

export const WIZARD_STEPS = [
  { id: "context", label: "Context", prompt: "Summarize the problem and constraints in 3–5 bullets." },
  { id: "options", label: "Options", prompt: "List 2–3 viable approaches with tradeoffs." },
  { id: "recommendation", label: "Recommendation", prompt: "Pick one approach and justify it briefly." },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

type WizardMessage = { role: "user" | "assistant"; content: string };

/**
 * Streaming lifecycle for a single `nextStep()` call. See `RunState` in
 * `@/stores/chat-store` for the rationale — mirrored here so wizard steps
 * can't end up with a lingering "streaming" draft box next to (or instead
 * of) a surfaced error.
 */
export type WizardRunState =
  | { status: "idle" }
  | { status: "streaming"; draft: string }
  | { status: "error"; message: string; draft: string }
  | { status: "done" };

type WizardState = {
  stepIndex: number;
  transcript: WizardMessage[];
  /** Optional user notes appended to the current step prompt when running. */
  stepContext: string;
  run: WizardRunState;
  toolEvents: { id: string; name: string; input: unknown }[];
  streamEvents: AgentStreamEvent[];
  costSeries: number[];
  tokenSeries: number[];
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
  run: { status: "idle" },
  toolEvents: [],
  streamEvents: [],
  costSeries: [],
  tokenSeries: [],
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
      run: { status: "idle" },
      toolEvents: [],
      streamEvents: [],
      costSeries: [],
      tokenSeries: [],
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
      run,
    } = get();
    if (run.status === "streaming") {
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
      run: { status: "streaming", draft: "" },
      streamEvents: [],
      toolEvents: [],
      structuredJsonText: null,
    });

    let draft = "";

    // Same rule as chat-store: keep refreshing the draft without reviving
    // "streaming" once an error event has flipped us to "error".
    const setDraft = (): void => {
      set((s) => ({
        run: s.run.status === "error" ? { ...s.run, draft } : { status: "streaming", draft },
      }));
    };

    const onEvent = (evt: AgentStreamEvent): void => {
      set((s) => ({ streamEvents: [...s.streamEvents, evt] }));
      const type = evt.type;
      if (type === "text" && typeof evt.text === "string") {
        draft += evt.text;
        setDraft();
      }
      // Parity fix: chat-store has always surfaced server-side "error" and
      // "stderr" events; wizard-store previously ignored both, so a failure
      // mid-wizard was silently dropped instead of shown to the user.
      if (type === "error" && typeof evt.message === "string") {
        set({ run: { status: "error", message: evt.message, draft } });
      }
      if (type === "stderr" && typeof evt.text === "string") {
        const piece = evt.text.trimEnd();
        if (piece.length > 0) {
          draft += `${draft.length > 0 ? "\n\n" : ""}\`\`\`stderr\n${piece.slice(0, 8000)}\n\`\`\``;
          setDraft();
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
      }
    };

    try {
      // Return value (exit code) intentionally unused here, same as before
      // this extraction: wizard-store never branched on process exit code.
      await runAgentStream(body, onEvent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stream error";
      set({ run: { status: "error", message: msg, draft } });
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
      run: s.run.status === "error" ? { ...s.run, draft: "" } : { status: "done" as const },
      structuredJsonText:
        expectStructuredJson && assistantMsg !== null
          ? assistantMsg.content
          : null,
    }));
  },
}));
