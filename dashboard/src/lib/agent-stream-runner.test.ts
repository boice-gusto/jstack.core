import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentStreamError, runAgentStream } from "@/lib/agent-stream-runner";

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i += 1;
      } else {
        controller.close();
      }
    },
  });
  return new Response(stream, { status });
}

function frame(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

const originalFetch = globalThis.fetch;

function stubFetch(impl: () => Promise<Response>): void {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("runAgentStream", () => {
  it("dispatches well-formed SSE frames and returns the exit code from the done event", async () => {
    stubFetch(async () =>
      sseResponse([
        frame({ type: "text", text: "Hello " }),
        frame({ type: "text", text: "world" }),
        frame({ type: "done", code: 0 }),
      ]),
    );

    const events: Record<string, unknown>[] = [];
    const result = await runAgentStream(
      { messages: [{ role: "user", content: "hi" }] },
      (evt) => events.push(evt),
    );

    expect(events).toEqual([
      { type: "text", text: "Hello " },
      { type: "text", text: "world" },
      { type: "done", code: 0 },
    ]);
    expect(result.exitCode).toBe(0);
  });

  it("parses a trailing partial line with no terminating newline (tail parse)", async () => {
    // First frame is properly terminated with "\n\n" and processed in the
    // normal per-line loop. The second frame has no trailing newline at
    // all, simulating a stream that closes mid-frame; it only ever lands in
    // the buffer and must be recovered by the tail parse after the reader
    // reports done.
    stubFetch(async () =>
      sseResponse([
        frame({ type: "text", text: "first" }),
        `data: ${JSON.stringify({ type: "done", code: 1 })}`,
      ]),
    );

    const events: Record<string, unknown>[] = [];
    const result = await runAgentStream(
      { messages: [{ role: "user", content: "hi" }] },
      (evt) => events.push(evt),
    );

    expect(events).toEqual([
      { type: "text", text: "first" },
      { type: "done", code: 1 },
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("dispatches error and stderr events like any other event type", async () => {
    stubFetch(async () =>
      sseResponse([
        frame({ type: "stderr", text: "warning: something" }),
        frame({ type: "error", message: "boom" }),
        frame({ type: "done", code: 1 }),
      ]),
    );

    const events: Record<string, unknown>[] = [];
    const result = await runAgentStream(
      { messages: [{ role: "user", content: "hi" }] },
      (evt) => events.push(evt),
    );

    expect(events.map((e) => e.type)).toEqual(["stderr", "error", "done"]);
    expect(result.exitCode).toBe(1);
  });

  it("throws AgentStreamError with a formatted message on a non-2xx response", async () => {
    stubFetch(async () => new Response("boom", { status: 500 }));

    await expect(
      runAgentStream({ messages: [{ role: "user", content: "hi" }] }, () => {}),
    ).rejects.toThrow(new AgentStreamError("Agent request failed (500): boom"));
  });

  it("throws AgentStreamError on network failure", async () => {
    stubFetch(async () => {
      throw new Error("network down");
    });

    await expect(
      runAgentStream({ messages: [{ role: "user", content: "hi" }] }, () => {}),
    ).rejects.toThrow(new AgentStreamError("network down"));
  });

  it("throws AgentStreamError when the response has no body", async () => {
    stubFetch(async () => new Response(null, { status: 200 }));

    await expect(
      runAgentStream({ messages: [{ role: "user", content: "hi" }] }, () => {}),
    ).rejects.toThrow(new AgentStreamError("No response body"));
  });
});
