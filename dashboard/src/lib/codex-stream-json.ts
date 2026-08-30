import type { StreamJsonEvent } from "./claude-stream-json";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Pull the thread id off a `codex exec --json` line. Only the `thread.started` event carries it
 * (confirmed against a live `codex exec --json "..."` run: `{"type":"thread.started",
 * "thread_id":"..."}` is the first line of every run), so this is a direct field check rather
 * than the nested lookup `claude-stream-json.ts`'s `extractSessionId` needs for Claude's shape.
 */
export function extractCodexSessionId(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const id = parsed.thread_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Incrementally map one NDJSON line from `codex exec --json` to the same `StreamJsonEvent` union
 * `claude-stream-json.ts` produces, so `route.ts` can treat both backends identically past this
 * point.
 *
 * Codex's `--json` mode emits whole completed items (`item.completed`), not Claude's token-level
 * `stream_event`/`text_delta` -- confirmed live: a multi-sentence reply arrived as one
 * `item.completed` with the full text, never as partial chunks. There is no Codex equivalent of
 * Claude's delta streaming to map to; callers should expect Codex responses to appear in fewer,
 * larger `assistant_text` events, not a character-by-character stream.
 */
export function mapCodexStreamJsonLine(line: string): StreamJsonEvent[] {
  const trimmed = line.trim();
  if (trimmed.length === 0) return [];
  let event: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isRecord(parsed)) return [];
    event = parsed;
  } catch {
    return [];
  }

  if (event.type === "item.completed") {
    const item = event.item;
    if (!isRecord(item)) return [{ kind: "raw", event }];
    if (item.type === "agent_message") {
      const text = item.text;
      return typeof text === "string" && text.length > 0
        ? [{ kind: "assistant_text", text }]
        : [];
    }
    if (item.type === "command_execution") {
      return [
        {
          kind: "tool_use",
          name: "command_execution",
          input: {
            command: item.command,
            exit_code: item.exit_code,
            aggregated_output: item.aggregated_output,
          },
        },
      ];
    }
    // Other item kinds (reasoning, mcp_tool_call, file_change, ...) surface as raw rather than
    // silently dropping -- the tool-timeline panel already renders `raw` events for inspection.
    return [{ kind: "raw", event }];
  }

  if (event.type === "turn.completed") {
    const usageRaw = event.usage;
    const usage: Record<string, number> = isRecord(usageRaw)
      ? Object.fromEntries(
          Object.entries(usageRaw).filter(
            (e): e is [string, number] => typeof e[1] === "number",
          ),
        )
      : {};
    // `codex exec --json` reports token usage but no computed dollar cost (unlike Claude's
    // `total_cost_usd`) -- 0 here means "not reported," not "free."
    return [{ kind: "result", result: undefined, usage, total_cost_usd: 0 }];
  }

  if (event.type === "thread.started" || event.type === "turn.started" || event.type === "item.started") {
    return [];
  }

  return [{ kind: "raw", event }];
}
