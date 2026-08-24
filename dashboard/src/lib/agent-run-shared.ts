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

/** The slice of store state every `onEvent` handler below reads and writes, shared by
 * chat-store and wizard-store. */
export type AgentStreamCommonSlice = {
  run: RunState;
  streamEvents: AgentStreamEvent[];
  toolEvents: { id: string; name: string; input: unknown }[];
  costSeries: number[];
  tokenSeries: number[];
  claudeSessionId: string | null;
};

/**
 * Computes the next common-slice values for one incoming SSE event, given the running draft
 * text and the current common slice. Both stores used to hand-copy this entire dispatch
 * themselves -- not just the pure extractors above, which were already shared -- and that
 * duplication already caused a real bug once (wizard-store silently dropped "error"/"stderr"
 * events chat-store already handled, until manually patched; see the "Parity fix" callers).
 *
 * Callers apply their own per-surface extras around this (chat-store's `start` ->
 * `lastRunContext`, its result-text fallback) -- those genuinely differ between surfaces, so
 * they stay local rather than being forced into this shared function.
 */
export function applyAgentStreamEvent(
  evt: AgentStreamEvent,
  draft: string,
  current: AgentStreamCommonSlice,
): { draft: string; patch: Partial<AgentStreamCommonSlice> } {
  const patch: Partial<AgentStreamCommonSlice> = {
    streamEvents: [...current.streamEvents, evt],
  };
  let nextDraft = draft;
  const type = evt.type;

  if (type === "session" && typeof evt.sessionId === "string" && evt.sessionId.length > 0) {
    patch.claudeSessionId = evt.sessionId;
  }
  if (type === "text" && typeof evt.text === "string") {
    nextDraft = draft + evt.text;
    patch.run = nextRunStateForDraft(current.run, nextDraft);
  }
  if (type === "error" && typeof evt.message === "string") {
    patch.run = { status: "error", message: evt.message, draft: nextDraft };
  }
  if (type === "stderr" && typeof evt.text === "string") {
    const next = appendStderrToDraft(nextDraft, evt.text);
    if (next !== nextDraft) {
      nextDraft = next;
      patch.run = nextRunStateForDraft(current.run, nextDraft);
    }
  }
  if (type === "tool_use") {
    patch.toolEvents = [
      ...current.toolEvents,
      { id: newRunId(), name: extractToolEventName(evt), input: evt.input },
    ];
  }
  if (type === "result") {
    const cost = extractResultCost(evt);
    if (cost !== null) patch.costSeries = pushSeries(current.costSeries, cost);
    const tokenTotal = extractResultTokenTotal(evt);
    if (tokenTotal !== null) patch.tokenSeries = pushSeries(current.tokenSeries, tokenTotal);
  }

  return { draft: nextDraft, patch };
}
