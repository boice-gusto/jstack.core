import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/agent-stream-runner", () => ({
  runAgentStream: vi.fn(),
}));

import { runAgentStream } from "@/lib/agent-stream-runner";
import { useWizardStore } from "./wizard-store.js";

const mockRunAgentStream = runAgentStream as unknown as ReturnType<typeof vi.fn>;

function resetStore(): void {
  useWizardStore.setState({
    stepIndex: 0,
    transcript: [],
    stepContext: "existing notes",
    run: { status: "idle" },
    structuredJsonText: null,
  });
}

beforeEach(resetStore);
afterEach(() => {
  mockRunAgentStream.mockReset();
});

describe("wizard-store nextStep — mid-stream server error", () => {
  it("does not advance the step or commit the failed exchange when the stream reports an error event", async () => {
    // Simulates a server-side "error" SSE event: onEvent is called, then runAgentStream
    // resolves normally (it only throws on network/HTTP/read failures).
    mockRunAgentStream.mockImplementation(async (_body, onEvent) => {
      onEvent({ type: "error", message: "the model call failed" });
      return { exitCode: 0 };
    });

    await useWizardStore.getState().nextStep();

    const state = useWizardStore.getState();
    expect(state.stepIndex).toBe(0);
    expect(state.transcript).toEqual([]);
    expect(state.stepContext).toBe("existing notes");
    expect(state.run.status).toBe("error");
  });

  it("advances the step normally when the stream completes without an error event", async () => {
    mockRunAgentStream.mockImplementation(async (_body, onEvent) => {
      onEvent({ type: "text", text: "a real answer" });
      return { exitCode: 0 };
    });

    await useWizardStore.getState().nextStep();

    const state = useWizardStore.getState();
    expect(state.stepIndex).toBe(1);
    expect(state.transcript.length).toBe(2);
    expect(state.stepContext).toBe("");
    expect(state.run.status).toBe("done");
  });
});
