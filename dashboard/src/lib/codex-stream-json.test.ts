import { describe, expect, it } from "vitest";

import { extractCodexSessionId, mapCodexStreamJsonLine } from "@/lib/codex-stream-json";

describe("mapCodexStreamJsonLine", () => {
  it("returns empty for blank or invalid JSON", () => {
    expect(mapCodexStreamJsonLine("")).toEqual([]);
    expect(mapCodexStreamJsonLine("  \n")).toEqual([]);
    expect(mapCodexStreamJsonLine("not json")).toEqual([]);
  });

  it("maps a completed agent_message item to assistant_text", () => {
    const line = JSON.stringify({
      type: "item.completed",
      item: { id: "item_0", type: "agent_message", text: "PONG" },
    });
    expect(mapCodexStreamJsonLine(line)).toEqual([{ kind: "assistant_text", text: "PONG" }]);
  });

  it("maps a completed command_execution item to tool_use", () => {
    const line = JSON.stringify({
      type: "item.completed",
      item: {
        id: "item_1",
        type: "command_execution",
        command: "/bin/zsh -lc 'echo hi'",
        aggregated_output: "hi\n",
        exit_code: 0,
        status: "completed",
      },
    });
    expect(mapCodexStreamJsonLine(line)).toEqual([
      {
        kind: "tool_use",
        name: "command_execution",
        input: {
          command: "/bin/zsh -lc 'echo hi'",
          exit_code: 0,
          aggregated_output: "hi\n",
        },
      },
    ]);
  });

  it("maps turn.completed to a result event with usage and zero cost", () => {
    const line = JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 21119, cached_input_tokens: 17152, output_tokens: 6 },
    });
    expect(mapCodexStreamJsonLine(line)).toEqual([
      {
        kind: "result",
        result: undefined,
        usage: { input_tokens: 21119, cached_input_tokens: 17152, output_tokens: 6 },
        total_cost_usd: 0,
      },
    ]);
  });

  it("treats thread.started/turn.started/item.started as no-ops", () => {
    expect(mapCodexStreamJsonLine(JSON.stringify({ type: "thread.started", thread_id: "x" }))).toEqual(
      [],
    );
    expect(mapCodexStreamJsonLine(JSON.stringify({ type: "turn.started" }))).toEqual([]);
    expect(
      mapCodexStreamJsonLine(
        JSON.stringify({ type: "item.started", item: { id: "item_1", type: "command_execution" } }),
      ),
    ).toEqual([]);
  });

  it("wraps an unrecognized item type as raw rather than dropping it", () => {
    const line = JSON.stringify({
      type: "item.completed",
      item: { id: "item_2", type: "reasoning", text: "thinking..." },
    });
    const out = mapCodexStreamJsonLine(line);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("raw");
  });

  it("wraps an unknown top-level type as raw", () => {
    const line = JSON.stringify({ type: "some.future.event" });
    const out = mapCodexStreamJsonLine(line);
    expect(out).toEqual([{ kind: "raw", event: { type: "some.future.event" } }]);
  });
});

describe("extractCodexSessionId", () => {
  it("returns null for blank or invalid JSON", () => {
    expect(extractCodexSessionId("")).toBeNull();
    expect(extractCodexSessionId("not json")).toBeNull();
  });

  it("reads thread_id off a thread.started line", () => {
    const line = JSON.stringify({ type: "thread.started", thread_id: "01a04c1b-abc" });
    expect(extractCodexSessionId(line)).toBe("01a04c1b-abc");
  });

  it("returns null when no thread_id is present", () => {
    expect(extractCodexSessionId(JSON.stringify({ type: "turn.started" }))).toBeNull();
  });

  it("ignores a non-string thread_id", () => {
    expect(extractCodexSessionId(JSON.stringify({ thread_id: 12345 }))).toBeNull();
  });
});
