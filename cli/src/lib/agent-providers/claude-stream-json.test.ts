import { describe, expect, it } from "bun:test";

import { extractSessionId, mapStreamJsonLine } from "./claude-stream-json.js";

describe("mapStreamJsonLine", () => {
  it("returns empty for blank or invalid JSON", () => {
    expect(mapStreamJsonLine("")).toEqual([]);
    expect(mapStreamJsonLine("  \n")).toEqual([]);
    expect(mapStreamJsonLine("not json")).toEqual([]);
  });

  it("maps assistant message with text blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Hello" }],
      },
    });
    const out = mapStreamJsonLine(line);
    expect(out).toEqual([{ kind: "assistant_text", text: "Hello" }]);
  });

  it("maps tool_use blocks", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "Read", input: { path: "/x" } }],
      },
    });
    const out = mapStreamJsonLine(line);
    expect(out).toContainEqual({
      kind: "tool_use",
      name: "Read",
      input: { path: "/x" },
    });
  });

  // Real shape captured from `claude -p --forward-subagent-text`: every event type gets a
  // top-level `parent_tool_use_id` once it originated inside a Task-tool sub-agent's own
  // conversation, set to the id of that Task's own tool_use event -- absent (undefined) for
  // ordinary main-thread events.
  it("tags assistant_text with parentToolUseId when the event came from a forwarded sub-agent", () => {
    const line = JSON.stringify({
      type: "assistant",
      parent_tool_use_id: "toolu_01FgPUr59c6HoQNSc6P2SAPS",
      message: { content: [{ type: "text", text: "PONG" }] },
    });
    expect(mapStreamJsonLine(line)).toEqual([
      {
        kind: "assistant_text",
        text: "PONG",
        parentToolUseId: "toolu_01FgPUr59c6HoQNSc6P2SAPS",
      },
    ]);
  });

  it("leaves parentToolUseId undefined for an ordinary main-thread event", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "text", text: "hi" }] },
    });
    const out = mapStreamJsonLine(line)[0];
    expect(
      out && "parentToolUseId" in out ? out.parentToolUseId : undefined,
    ).toBeUndefined();
  });

  it("tags a sub-agent's own tool_use and tool_result with parentToolUseId", () => {
    const toolUse = mapStreamJsonLine(
      JSON.stringify({
        type: "assistant",
        parent_tool_use_id: "toolu_parent",
        message: {
          content: [
            { type: "tool_use", id: "toolu_child", name: "Read", input: {} },
          ],
        },
      }),
    );
    expect(toolUse).toEqual([
      {
        kind: "tool_use",
        id: "toolu_child",
        name: "Read",
        input: {},
        parentToolUseId: "toolu_parent",
      },
    ]);

    const toolResult = mapStreamJsonLine(
      JSON.stringify({
        type: "user",
        parent_tool_use_id: "toolu_parent",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "toolu_child", content: "ok" },
          ],
        },
      }),
    );
    expect(toolResult).toEqual([
      {
        kind: "tool_result",
        toolUseId: "toolu_child",
        content: "ok",
        isError: false,
        parentToolUseId: "toolu_parent",
      },
    ]);
  });

  it("maps result events with usage and cost", () => {
    const line = JSON.stringify({
      type: "result",
      usage: { input_tokens: 10, output_tokens: 5 },
      total_cost_usd: 0.02,
    });
    const out = mapStreamJsonLine(line);
    expect(out).toEqual([
      {
        kind: "result",
        result: undefined,
        usage: { input_tokens: 10, output_tokens: 5 },
        total_cost_usd: 0.02,
        isError: false,
      },
    ]);
  });

  it("maps is_error: true onto the result event", () => {
    const line = JSON.stringify({
      type: "result",
      usage: {},
      total_cost_usd: 0,
      is_error: true,
    });
    const out = mapStreamJsonLine(line);
    expect(out).toEqual([
      {
        kind: "result",
        result: undefined,
        usage: {},
        total_cost_usd: 0,
        isError: true,
      },
    ]);
  });

  it("wraps unknown top-level types as raw", () => {
    const line = JSON.stringify({ type: "system", foo: 1 });
    const out = mapStreamJsonLine(line);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("raw");
  });

  it("maps stream_event text_delta", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { delta: { type: "text_delta", text: "partial" } },
    });
    const out = mapStreamJsonLine(line);
    expect(out).toEqual([{ kind: "assistant_text", text: "partial" }]);
  });

  it("maps assistant message with string content", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: { content: "Plain string reply" },
    });
    const out = mapStreamJsonLine(line);
    expect(out).toEqual([
      { kind: "assistant_text", text: "Plain string reply" },
    ]);
  });

  it("extracts nested result.result string", () => {
    const line = JSON.stringify({
      type: "result",
      result: { result: "Final answer only here" },
      usage: {},
      total_cost_usd: 0,
    });
    const out = mapStreamJsonLine(line);
    expect(out).toEqual([
      {
        kind: "result",
        result: "Final answer only here",
        usage: {},
        total_cost_usd: 0,
        isError: false,
      },
    ]);
  });
});

describe("extractSessionId", () => {
  it("returns null for blank or invalid JSON", () => {
    expect(extractSessionId("")).toBeNull();
    expect(extractSessionId("  \n")).toBeNull();
    expect(extractSessionId("not json")).toBeNull();
  });

  it("reads a top-level session_id", () => {
    const line = JSON.stringify({ type: "system", session_id: "abc-123" });
    expect(extractSessionId(line)).toBe("abc-123");
  });

  it("reads session_id nested under a stream_event's event object", () => {
    const line = JSON.stringify({
      type: "stream_event",
      event: { type: "message_start", session_id: "nested-456" },
    });
    expect(extractSessionId(line)).toBe("nested-456");
  });

  it("returns null when no session_id is present anywhere", () => {
    const line = JSON.stringify({ type: "result", usage: {} });
    expect(extractSessionId(line)).toBeNull();
  });

  it("ignores a non-string session_id", () => {
    const line = JSON.stringify({ session_id: 12345 });
    expect(extractSessionId(line)).toBeNull();
  });
});
