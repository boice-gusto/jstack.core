"use client";

import { Loader2 } from "lucide-react";
import { useState, type ReactElement } from "react";

import { AgentMetricsSparklines } from "@/components/agent-metrics-sparklines";
import { AgentRunContextStrip } from "@/components/agent-run-context-strip";
import { ChatMarkdown } from "@/components/chat-markdown";
import { SkillDocumentsPanel } from "@/components/skill-documents-panel";
import { SkillPicker } from "@/components/skill-picker";
import { StreamDebugPanel } from "@/components/stream-debug-panel";
import { StructuredJsonPanel } from "@/components/structured-json-panel";
import { ToolTimelinePanel } from "@/components/tool-timeline-panel";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import { cn } from "@/lib/utils";

export default function AgentPage(): ReactElement {
  const [draft, setDraft] = useState("");

  const messages = useChatStore((s) => s.messages);
  const assistantDraft = useChatStore((s) => s.assistantDraft);
  const toolEvents = useChatStore((s) => s.toolEvents);
  const costSeries = useChatStore((s) => s.costSeries);
  const tokenSeries = useChatStore((s) => s.tokenSeries);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const skillId = useChatStore((s) => s.skillId);
  const expectStructuredJson = useChatStore((s) => s.expectStructuredJson);
  const structuredJsonText = useChatStore((s) => s.structuredJsonText);
  const lastRunContext = useChatStore((s) => s.lastRunContext);
  const streamEvents = useChatStore((s) => s.streamEvents);

  const appendUser = useChatStore((s) => s.appendUser);
  const runAgent = useChatStore((s) => s.runAgent);
  const resetConversation = useChatStore((s) => s.resetConversation);
  const setSkillId = useChatStore((s) => s.setSkillId);
  const setExpectStructuredJson = useChatStore((s) => s.setExpectStructuredJson);

  async function handleSendAndRun(): Promise<void> {
    const t = draft.trim();
    if (t.length > 0) {
      appendUser(t);
      setDraft("");
    }
    await runAgent();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      <div>
        <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">Agent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Freeform chat against the same backend as{" "}
          <a href="/wizard" className="font-medium text-primary underline-offset-2 hover:underline">
            Wizard
          </a>
          : local{" "}
          <code className="rounded border border-border bg-muted px-1 font-mono text-xs">claude -p</code> with{" "}
          <code className="rounded border border-border bg-muted px-1 font-mono text-xs">stream-json</code>, optional
          skill text from the repo skill catalog, tool timeline, cost/token sparklines, structured JSON mode for
          evals, and a raw SSE panel for integrators.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Requires <code className="rounded bg-muted px-1 font-mono">CLAUDE_BIN</code>,{" "}
          <code className="rounded bg-muted px-1 font-mono">DASHBOARD_AGENT_CWD</code> (or defaults to jstack.core), and
          an Anthropic-capable environment for the child process.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,20rem]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <AgentRunContextStrip
              context={lastRunContext}
              connecting={isStreaming && lastRunContext === null}
            />
            <SkillPicker value={skillId} onChange={setSkillId} id="agent-skill" />
            <SkillDocumentsPanel skillId={skillId} />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-input"
                checked={expectStructuredJson}
                onChange={(e) => setExpectStructuredJson(e.target.checked)}
              />
              Expect structured JSON (type + version envelope)
            </label>
            <AgentMetricsSparklines costSeries={costSeries} tokenSeries={tokenSeries} />
          </div>

          <div className="rounded-lg border border-border bg-card">
            {isStreaming ? (
              <div className="flex items-center gap-2 border-b border-border bg-muted/20 px-4 py-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                <span>Receiving stream from local Claude…</span>
              </div>
            ) : null}
            <div className="max-h-[min(50vh,28rem)] space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && assistantDraft.length === 0 ? (
                <p className="m-0 text-sm text-muted-foreground">No messages yet. Type below and send.</p>
              ) : null}
              {messages.map((m) => (
                <div
                  key={m.id}
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
            <div className="border-t border-border p-4 space-y-2">
              <label htmlFor="agent-input" className="sr-only">
                Message
              </label>
              <textarea
                id="agent-input"
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="User message…"
                className={cn(
                  "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                )}
                disabled={isStreaming}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={isStreaming} onClick={() => void handleSendAndRun()}>
                  Send &amp; run
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isStreaming || messages.length === 0}
                  onClick={() => void runAgent()}
                  title={messages.length === 0 ? "Send at least one message first" : undefined}
                >
                  Run again
                </Button>
                <Button type="button" variant="secondary" disabled={isStreaming} onClick={resetConversation}>
                  Reset thread
                </Button>
              </div>
              {error !== null ? <p className="m-0 text-sm text-destructive">{error}</p> : null}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <ToolTimelinePanel tools={toolEvents} />
          <StructuredJsonPanel text={structuredJsonText} title="Structured output" />
          <StreamDebugPanel events={streamEvents} />
        </div>
      </div>
    </div>
  );
}
