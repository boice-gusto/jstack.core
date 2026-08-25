import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

async function freshRoute() {
  vi.resetModules();
  const mod = await import("./route.js");
  return mod.POST;
}

beforeEach(() => {
  vi.stubEnv("DASHBOARD_API_KEY", "test-key");
  // A binary that can never be spawned: forces child_process.spawn to emit 'error' (ENOENT).
  vi.stubEnv("CLAUDE_BIN", "/definitely/does/not/exist/claude-binary-xyz");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function req(): NextRequest {
  return new NextRequest(new URL("/api/agent/stream", "http://localhost:3333"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
}

describe("POST /api/agent/stream — spawn failure", () => {
  it("sends an error event and closes the SSE stream when the child process fails to spawn", async () => {
    const POST = await freshRoute();
    const res = await POST(req());
    expect(res.body).not.toBeNull();
    const reader = res.body!.getReader();

    // Bounded by a timeout rather than relying on the stream closing: on this repo's runtime
    // (Bun), 'close' fires after 'error' even for a spawn ENOENT, so this doesn't reproduce a
    // hang either before or after the route's 'error' handler was hardened to close the stream
    // itself. The assertion here is about what the response actually contains, not about proving
    // a hang -- see the 'error' handler in route.ts for why it no longer depends on 'close'
    // following 'error' (a relationship Node's own docs don't guarantee).
    const drained = (async () => {
      let sawErrorEvent = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return { sawErrorEvent, closed: true };
        const text = new TextDecoder().decode(value);
        if (text.includes('"type":"error"')) sawErrorEvent = true;
      }
    })();

    const result = await Promise.race([
      drained,
      new Promise<{ sawErrorEvent: boolean; closed: boolean }>((resolve) =>
        setTimeout(() => resolve({ sawErrorEvent: false, closed: false }), 2000),
      ),
    ]);

    expect(result.closed).toBe(true);
    expect(result.sawErrorEvent).toBe(true);
  });
});
