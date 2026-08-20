import type { AgentStreamBody } from "@/lib/agent-request-schema";

/**
 * One decoded SSE payload from `POST /api/agent/stream` (see
 * `dashboard/src/app/api/agent/stream/route.ts` for the `type` values it
 * sends: "start", "text", "tool_use", "result", "stderr", "error", "done",
 * "raw"). Deliberately loose — callers narrow by `type` themselves, the same
 * way the two stores already did before this was extracted.
 */
export type AgentStreamEvent = Record<string, unknown>;

export type RunAgentStreamResult = {
  /** Child process exit code from the "done" event, or null if absent/non-numeric. */
  exitCode: number | null;
};

/**
 * Thrown by `runAgentStream` for any failure in the HTTP/stream mechanics
 * (network failure, non-2xx response, missing response body, or a mid-stream
 * read failure). `message` is already formatted for direct display, so
 * callers can just do `set({ error: e.message })` (or fold it into a `run`
 * union) without re-deriving text per failure mode.
 */
export class AgentStreamError extends Error {}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

/**
 * Shared fetch -> SSE decode -> buffer-split -> per-line JSON parse ->
 * dispatch mechanics for the agent stream endpoint. This owns HTTP/stream
 * plumbing only; it does not know about chat vs. wizard state. Callers
 * supply `onEvent` and own all app-specific reducer logic (draft
 * accumulation, tool timelines, step advancement, etc).
 *
 * Includes a "tail" parse of any trailing buffered line once the reader
 * reports `done` (a line without a trailing newline would otherwise be
 * silently dropped).
 */
export async function runAgentStream(
  body: AgentStreamBody,
  onEvent: (evt: AgentStreamEvent) => void,
): Promise<RunAgentStreamResult> {
  let res: Response;
  try {
    res = await fetch("/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AgentStreamError(e instanceof Error ? e.message : "Network error");
  }

  if (!res.ok) {
    const text = await safeReadText(res);
    throw new AgentStreamError(`Agent request failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const reader = res.body?.getReader();
  if (reader === undefined) {
    throw new AgentStreamError("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let exitCode: number | null = null;

  const parseLine = (line: string): void => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || !trimmed.startsWith("data:")) {
      return;
    }
    const jsonStr = trimmed.slice(5).trim();
    try {
      const evt = JSON.parse(jsonStr) as AgentStreamEvent;
      if (evt.type === "done") {
        const code = evt.code;
        exitCode = typeof code === "number" ? code : null;
      }
      onEvent(evt);
    } catch {
      // ignore malformed chunk
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        parseLine(line);
      }
    }
    // Trailing partial line (no terminating newline) after the reader closes.
    const tail = buffer.trim();
    if (tail.length > 0) {
      parseLine(tail);
    }
  } catch (e) {
    throw new AgentStreamError(e instanceof Error ? e.message : "Stream read error");
  }

  return { exitCode };
}
