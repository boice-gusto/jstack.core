import type { AgentStreamEvent } from "@/lib/agent-stream-runner";

/**
 * Streaming lifecycle for a single agent run, shared by `chat-store` and `wizard-store`.
 * Collapsed into one union so "streaming" / "error" / "draft text" can't disagree with each
 * other (e.g. a mid-stream read failure used to clear `isStreaming` and set `error` while
 * leaving a stale draft around, rendering a "(streaming)" box next to an error banner).
 */
export type RunState =
  | { status: "idle" }
  | { status: "streaming"; draft: string }
  | { status: "error"; message: string; draft: string }
  | { status: "done" };

export function newRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * The shared draft-refresh rule both stores' `setDraft` closures implement: keep updating the
 * draft as it streams in, without reviving "streaming" once an error event has already flipped
 * `run` to "error" -- the error stays visible; only its attached draft refreshes.
 */
export function nextRunStateForDraft(run: RunState, draft: string): RunState {
  return run.status === "error" ? { ...run, draft } : { status: "streaming", draft };
}

/**
 * Formats a non-empty stderr chunk as a fenced block appended to `draft`, capped at 8000 chars
 * per chunk. Returns `draft` unchanged if the chunk is empty after trimming trailing whitespace.
 */
export function appendStderrToDraft(draft: string, stderrText: string): string {
  const piece = stderrText.trimEnd();
  if (piece.length === 0) return draft;
  return `${draft}${draft.length > 0 ? "\n\n" : ""}\`\`\`stderr\n${piece.slice(0, 8000)}\n\`\`\``;
}

/** A "result" event's total cost, if present as a number. */
export function extractResultCost(evt: AgentStreamEvent): number | null {
  const costUsd = evt.total_cost_usd;
  return typeof costUsd === "number" ? costUsd : null;
}

/** Sum of a "result" event's `usage` object's numeric fields (token counts), if any are > 0. */
export function extractResultTokenTotal(evt: AgentStreamEvent): number | null {
  const usage = evt.usage;
  if (typeof usage !== "object" || usage === null || Array.isArray(usage)) {
    return null;
  }
  const vals = Object.values(usage as Record<string, unknown>).filter(
    (v): v is number => typeof v === "number",
  );
  const total = vals.reduce((a, b) => a + b, 0);
  return total > 0 ? total : null;
}

/** A "tool_use" event's tool name, falling back to a placeholder when the field is missing/non-string. */
export function extractToolEventName(evt: AgentStreamEvent): string {
  return typeof evt.name === "string" ? evt.name : "unknown_tool";
}

/** Appends a new value to a bounded rolling series (used for cost/token sparklines). */
export function pushSeries(series: number[], value: number, max = 24): number[] {
  return [...series, value].slice(-max);
}
