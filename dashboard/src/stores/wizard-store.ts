import { create } from "zustand";

import type { AgentStreamBody } from "@/lib/agent-request-schema";
import {
  applyAgentStreamEvent,
  type RunState as SharedRunState,
} from "@/lib/agent-run-shared";
import { runAgentStream, type AgentStreamEvent } from "@/lib/agent-stream-runner";

export const WIZARD_STEPS = [
  { id: "context", label: "Context", prompt: "Summarize the problem and constraints in 3–5 bullets." },
  { id: "options", label: "Options", prompt: "List 2–3 viable approaches with tradeoffs." },
  { id: "recommendation", label: "Recommendation", prompt: "Pick one approach and justify it briefly." },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

type WizardMessage = { role: "user" | "assistant"; content: string };

/** See `RunState` in `@/lib/agent-run-shared` for the rationale. */
export type WizardRunState = SharedRunState;

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
  /** See chat-store's `claudeSessionId` -- same `--resume` mechanism, reset by `resetWizard`. */
  claudeSessionId: string | null;
  setSkillId: (id: string) => void;
  setExpectStructuredJson: (v: boolean) => void;
  setStepContext: (text: string) => void;
  nextStep: () => Promise<void>;
  resetWizard: () => void;
};

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
  claudeSessionId: null,

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
      claudeSessionId: null,
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
      claudeSessionId,
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
    // Resuming: the session already holds every prior step's transcript, so only this step's
    // new prompt needs to go out. The first step (no session yet) still sends the (empty)
    // transcript plus this prompt, which is what establishes the session.
    const messagesForApi = (
      claudeSessionId !== null ? [pendingUser] : [...transcript, pendingUser]
    ).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const body: AgentStreamBody = {
      messages: messagesForApi,
      skillId: skillId.trim().length > 0 ? skillId.trim() : undefined,
      expectStructuredJson: expectStructuredJson || undefined,
      surface: "wizard",
      resumeSessionId: claudeSessionId ?? undefined,
    };

    set({
      run: { status: "streaming", draft: "" },
      streamEvents: [],
      toolEvents: [],
      structuredJsonText: null,
    });

    let draft = "";

    const onEvent = (evt: AgentStreamEvent): void => {
      const current = get();
      const applied = applyAgentStreamEvent(evt, draft, current);
      draft = applied.draft;
      set(applied.patch);
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

    if (get().run.status === "error") {
      // A server-reported "error" event (as opposed to a thrown network/HTTP failure) doesn't
      // throw -- runAgentStream resolves normally. Advancing the step here would commit this
      // step's failed exchange to the transcript as if it had succeeded, and the step could
      // never be retried (the button would target the next step instead). Only clear the
      // draft so a retry starts clean; leave stepIndex/transcript/stepContext untouched.
      set((s) => ({ run: { ...s.run, draft: "" } as WizardRunState }));
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
      run: { status: "done" as const },
      structuredJsonText:
        expectStructuredJson && assistantMsg !== null
          ? assistantMsg.content
          : null,
    }));
  },
}));
