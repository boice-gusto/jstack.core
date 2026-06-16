/**
 * Parse newline-delimited SSE chunks into complete `data: ...` events.
 * Yields parsed JSON objects from each `data:` line (Claude dashboard stream).
 */
export async function* parseSseJsonStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trimStart();
        if (payload.length === 0) continue;
        try {
          const parsed: unknown = JSON.parse(payload);
          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            yield parsed as Record<string, unknown>;
          }
        } catch {
          // skip malformed line
        }
      }
    }
    if (buffer.trim().length > 0) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trimStart();
        try {
          const parsed: unknown = JSON.parse(payload);
          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            yield parsed as Record<string, unknown>;
          }
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
