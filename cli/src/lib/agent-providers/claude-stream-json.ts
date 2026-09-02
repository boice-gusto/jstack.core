export type StreamJsonEvent =
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_use"; id?: string; name: string; input: unknown }
  | {
      /** A tool's real output, reported back to claude as a "user" role message -- claude-code's
       * own convention for tool results, not something a human typed. `toolUseId` matches the
       * `id` on the `tool_use` event this completes, since multiple tool calls in one turn (or
       * parallel calls) aren't otherwise distinguishable in the stream. */
      kind: "tool_result";
      toolUseId?: string;
      content: string;
      isError: boolean;
    }
  | {
      kind: "result";
      result?: string;
      usage: Record<string, number>;
      total_cost_usd: number;
      /** `is_error` off the raw event -- `subtype` stays "success" even when this is true, so
       * a consumer gating on success/failure (session.ts's runClaudeStreaming) must read this,
       * not `subtype`. */
      isError: boolean;
    }
  | { kind: "raw"; event: Record<string, unknown> };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Pull `session_id` off a raw NDJSON line from `claude --output-format stream-json`, checked at
 * both the top level and inside a nested `event` (stream_event lines nest it one level down).
 * Every line in the stream carries the same session id once the child has actually started, so
 * the caller only needs the first non-null result.
 */
export function extractSessionId(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const direct = parsed.session_id;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const inner = parsed.event;
  if (
    isRecord(inner) &&
    typeof inner.session_id === "string" &&
    inner.session_id.length > 0
  ) {
    return inner.session_id;
  }
  return null;
}

/**
 * Incrementally map one NDJSON line from `claude --output-format stream-json` to UI events.
 */
export function mapStreamJsonLine(line: string): StreamJsonEvent[] {
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

  const out: StreamJsonEvent[] = [];

  if (event.type === "stream_event") {
    const inner = event.event;
    if (!isRecord(inner)) {
      out.push({ kind: "raw", event });
      return out;
    }
    const delta = inner.delta;
    if (!isRecord(delta)) {
      out.push({ kind: "raw", event });
      return out;
    }
    if (delta.type === "text_delta") {
      const t = delta.text;
      if (typeof t === "string" && t.length > 0) {
        out.push({ kind: "assistant_text", text: t });
      }
      return out;
    }
    if (
      delta.type === undefined &&
      typeof delta.text === "string" &&
      delta.text.length > 0
    ) {
      out.push({ kind: "assistant_text", text: delta.text });
      return out;
    }
    out.push({ kind: "raw", event });
    return out;
  }

  if (event.type === "assistant") {
    const message = event.message;
    if (!isRecord(message)) {
      out.push({ kind: "raw", event });
      return out;
    }
    const content = message.content;
    if (typeof content === "string" && content.length > 0) {
      out.push({ kind: "assistant_text", text: content });
      return out;
    }
    if (!Array.isArray(content)) {
      out.push({ kind: "raw", event });
      return out;
    }
    for (const block of content) {
      if (!isRecord(block)) continue;
      if (block.type === "text") {
        const t = block.text;
        if (typeof t === "string" && t.length > 0) {
          out.push({ kind: "assistant_text", text: t });
        }
      } else if (block.type === "tool_use") {
        const name = block.name;
        out.push({
          kind: "tool_use",
          id: typeof block.id === "string" ? block.id : undefined,
          name: typeof name === "string" ? name : "tool",
          input: block.input,
        });
      }
    }
    return out;
  }

  if (event.type === "user") {
    const message = event.message;
    if (!isRecord(message)) {
      out.push({ kind: "raw", event });
      return out;
    }
    const content = message.content;
    if (!Array.isArray(content)) {
      out.push({ kind: "raw", event });
      return out;
    }
    for (const block of content) {
      if (!isRecord(block) || block.type !== "tool_result") continue;
      const raw = block.content;
      let text: string;
      if (typeof raw === "string") {
        text = raw;
      } else if (Array.isArray(raw)) {
        text = raw
          .filter(isRecord)
          .filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text as string)
          .join("\n");
      } else {
        text = "";
      }
      out.push({
        kind: "tool_result",
        toolUseId:
          typeof block.tool_use_id === "string" ? block.tool_use_id : undefined,
        content: text,
        isError: block.is_error === true,
      });
    }
    return out;
  }

  if (event.type === "result") {
    const usageRaw = event.usage;
    const usage: Record<string, number> = isRecord(usageRaw)
      ? Object.fromEntries(
          Object.entries(usageRaw).filter(
            (e): e is [string, number] => typeof e[1] === "number",
          ),
        )
      : {};
    const cost = event.total_cost_usd;
    let resultText: string | undefined;
    if (typeof event.result === "string") {
      resultText = event.result;
    } else if (isRecord(event.result)) {
      const r = event.result;
      const sub = r.result;
      if (typeof sub === "string") {
        resultText = sub;
      } else {
        const sub2 = r.output;
        if (typeof sub2 === "string") {
          resultText = sub2;
        }
      }
    }
    out.push({
      kind: "result",
      result: resultText,
      usage,
      total_cost_usd: typeof cost === "number" ? cost : Number(cost ?? 0),
      isError: event.is_error === true,
    });
    return out;
  }

  out.push({ kind: "raw", event });
  return out;
}
