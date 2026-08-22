import { describe, expect, it } from "vitest";

import { extractSessionId, mapStreamJsonLine } from "@/lib/claude-stream-json";

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
        content: [
          { type: "tool_use", name: "Read", input: { path: "/x" } },
        ],
      },
    });
    const out = mapStreamJsonLine(line);
    expect(out).toContainEqual({
      kind: "tool_use",
      name: "Read",
      input: { path: "/x" },
    });
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
    expect(out).toEqual([{ kind: "assistant_text", text: "Plain string reply" }]);
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
