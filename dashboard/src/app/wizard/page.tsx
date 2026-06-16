"use client";

import type { ReactElement } from "react";

import { AgentMetricsSparklines } from "@/components/agent-metrics-sparklines";
import { ChatMarkdown } from "@/components/chat-markdown";
import { SkillPicker } from "@/components/skill-picker";
import { StructuredJsonPanel } from "@/components/structured-json-panel";
import { ToolTimelinePanel } from "@/components/tool-timeline-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWizardStore, WIZARD_STEPS } from "@/stores/wizard-store";

const textareaClass = cn(
  "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
);

export default function WizardPage(): ReactElement {
  const stepIndex = useWizardStore((s) => s.stepIndex);
  const transcript = useWizardStore((s) => s.transcript);
  const assistantDraft = useWizardStore((s) => s.assistantDraft);
  const toolEvents = useWizardStore((s) => s.toolEvents);
  const costSeries = useWizardStore((s) => s.costSeries);
  const tokenSeries = useWizardStore((s) => s.tokenSeries);
  const isStreaming = useWizardStore((s) => s.isStreaming);
  const error = useWizardStore((s) => s.error);
  const skillId = useWizardStore((s) => s.skillId);
  const expectStructuredJson = useWizardStore((s) => s.expectStructuredJson);
  const structuredJsonText = useWizardStore((s) => s.structuredJsonText);

  const stepContext = useWizardStore((s) => s.stepContext);
  const setSkillId = useWizardStore((s) => s.setSkillId);
  const setExpectStructuredJson = useWizardStore((s) => s.setExpectStructuredJson);
  const setStepContext = useWizardStore((s) => s.setStepContext);
  const nextStep = useWizardStore((s) => s.nextStep);
  const resetWizard = useWizardStore((s) => s.resetWizard);

  const currentStep = stepIndex < WIZARD_STEPS.length ? WIZARD_STEPS[stepIndex] : null;
  const complete = stepIndex >= WIZARD_STEPS.length;
  const canContinue = !isStreaming && !complete;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Wizard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guided flow: three fixed prompts run in order (each is one model call with full transcript so far). This is not
          freeform chat — use{" "}
          <a href="/agent" className="font-medium text-primary underline-offset-2 hover:underline">
            Agent
          </a>{" "}
          to type back-and-forth. Optional notes per step are merged into{" "}
          {"that step's user message"}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,20rem]">
        <div className="space-y-4">
          <ol className="m-0 flex list-none flex-wrap gap-2 p-0">
            {WIZARD_STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex && !complete;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    done && "border-primary/40 bg-primary/10 text-foreground",
                    active && "border-primary bg-primary/15 text-foreground",
                    !done && !active && "border-border text-muted-foreground",
                  )}
                >
                  {i + 1}. {s.label}
                </li>
              );
            })}
          </ol>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <SkillPicker value={skillId} onChange={setSkillId} id="wizard-skill" />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={expectStructuredJson}
                onChange={(e) => setExpectStructuredJson(e.target.checked)}
              />
              Expect structured JSON on final assistant message
            </label>
            <AgentMetricsSparklines costSeries={costSeries} tokenSeries={tokenSeries} />
            {!complete && currentStep !== null ? (
              <div className="space-y-2">
                <label htmlFor="wizard-step-context" className="text-sm font-medium text-foreground">
                  Notes for this step (optional)
                </label>
                <textarea
                  id="wizard-step-context"
                  rows={3}
                  value={stepContext}
                  onChange={(e) => setStepContext(e.target.value)}
                  placeholder="e.g. product area, links, constraints…"
                  className={textareaClass}
                  disabled={isStreaming}
                />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!canContinue} onClick={() => void nextStep()}>
                {complete ? "Done" : currentStep !== null ? `Run step: ${currentStep.label}` : "Continue"}
              </Button>
              <Button type="button" variant="outline" disabled={isStreaming} onClick={resetWizard}>
                Reset wizard
              </Button>
            </div>
            {complete ? (
              <p className="m-0 text-sm text-muted-foreground">All steps finished. Reset to start over.</p>
            ) : currentStep !== null ? (
              <p className="m-0 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Next prompt: </span>
                {currentStep.prompt}
              </p>
            ) : null}
            {error !== null ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-2">
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</h2>
            </div>
            <div className="max-h-[min(50vh,28rem)] space-y-3 overflow-y-auto p-4">
              {transcript.length === 0 && assistantDraft.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">Run the first step to begin.</p>
              ) : null}
              {transcript.map((m, idx) => (
                <div
                  key={`${idx}-${m.role}-${m.content.slice(0, 24)}`}
                  className={cn(
                    "rounded-md border px-3 py-2",
                    m.role === "user"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.role}
                  </div>
                  {m.role === "assistant" ? (
                    <ChatMarkdown content={m.content} />
                  ) : (
                    <p className="m-0 whitespace-pre-wrap text-sm text-foreground">{m.content}</p>
                  )}
                </div>
              ))}
              {assistantDraft.length > 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-2">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    assistant (streaming)
                  </div>
                  <ChatMarkdown content={assistantDraft} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ToolTimelinePanel tools={toolEvents} title="This step" />
          <StructuredJsonPanel text={structuredJsonText} title="Wizard structured output" />
        </div>
      </div>
    </div>
  );
}
