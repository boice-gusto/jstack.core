import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent-stream-runner", () => ({
  runAgentStream: vi.fn(),
}));

import { runAgentStream } from "@/lib/agent-stream-runner";
import { useChatStore } from "./chat-store.js";

const mockRunAgentStream = runAgentStream as unknown as ReturnType<typeof vi.fn>;

function resetStore(): void {
  useChatStore.setState({
    messages: [{ id: "u1", role: "user", content: "hello" }],
    run: { status: "idle" },
    streamEvents: [],
    toolEvents: [],
    structuredJsonText: null,
    claudeSessionId: null,
  });
}

beforeEach(resetStore);
afterEach(() => {
  mockRunAgentStream.mockReset();
});

describe("chat-store runAgent — mid-stream server error", () => {
  it("does not commit a partial draft as a successful reply when the stream reports an error event", async () => {
    // Simulates a server-side "error" SSE event after some text had already streamed in:
    // onEvent is called for both, then runAgentStream resolves normally (it only throws on
    // network/HTTP/read failures) -- the exact shape that used to let the final set() commit
    // the partial draft as if the run had succeeded.
    mockRunAgentStream.mockImplementation(async (_body, onEvent) => {
      onEvent({ type: "text", text: "partial answer" });
      onEvent({ type: "error", message: "the model call failed" });
      return { exitCode: 0 };
    });

    await useChatStore.getState().runAgent();

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1); // only the original user message
    expect(state.run.status).toBe("error");
  });

  it("commits the reply normally when the stream completes without an error event", async () => {
    mockRunAgentStream.mockImplementation(async (_body, onEvent) => {
      onEvent({ type: "text", text: "a real answer" });
      return { exitCode: 0 };
    });

    await useChatStore.getState().runAgent();

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]?.content).toBe("a real answer");
    expect(state.run.status).toBe("done");
  });
});
