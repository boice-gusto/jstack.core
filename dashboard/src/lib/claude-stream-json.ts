export type StreamJsonEvent =
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_use"; name: string; input: unknown }
  | {
      kind: "result";
      result?: string;
      usage: Record<string, number>;
      total_cost_usd: number;
    }
  | { kind: "raw"; event: Record<string, unknown> };

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
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
          name: typeof name === "string" ? name : "tool",
          input: block.input,
        });
      }
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
    });
    return out;
  }

  out.push({ kind: "raw", event });
  return out;
}
