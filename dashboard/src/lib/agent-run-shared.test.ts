import { describe, expect, it } from "vitest";

import {
  appendStderrToDraft,
  extractResultCost,
  extractResultTokenTotal,
  extractToolEventName,
  nextRunStateForDraft,
  pushSeries,
  type RunState,
} from "./agent-run-shared";

/**
 * `chat-store.ts` and `wizard-store.ts` used to each hand-roll this exact logic (a
 * confirmed-in-production drift: wizard-store once silently dropped error/stderr events
 * chat-store already surfaced). These pure functions had zero direct test coverage before
 * being extracted -- both stores are otherwise only exercised by shelling out to a real
 * agent process, which a unit test can't do.
 */
describe("nextRunStateForDraft", () => {
  it("transitions idle -> streaming with the given draft", () => {
    const result = nextRunStateForDraft({ status: "idle" }, "hello");
    expect(result).toEqual({ status: "streaming", draft: "hello" });
  });

  it("keeps status 'error' but refreshes the draft, never reviving 'streaming'", () => {
    const errorState: RunState = { status: "error", message: "boom", draft: "old" };
    const result = nextRunStateForDraft(errorState, "new draft");
    expect(result).toEqual({ status: "error", message: "boom", draft: "new draft" });
  });

  it("keeps updating a streaming draft", () => {
    const result = nextRunStateForDraft({ status: "streaming", draft: "a" }, "ab");
    expect(result).toEqual({ status: "streaming", draft: "ab" });
  });
});

describe("appendStderrToDraft", () => {
  it("returns the draft unchanged for an empty (or whitespace-only) chunk", () => {
    expect(appendStderrToDraft("existing", "   \n")).toBe("existing");
    expect(appendStderrToDraft("", "")).toBe("");
  });

  it("appends a fenced stderr block to an empty draft with no leading blank line", () => {
    expect(appendStderrToDraft("", "oops")).toBe("```stderr\noops\n```");
  });

  it("appends a fenced stderr block to a non-empty draft with a separating blank line", () => {
    expect(appendStderrToDraft("hello", "oops")).toBe("hello\n\n```stderr\noops\n```");
  });

  it("caps a single chunk at 8000 characters", () => {
    const huge = "x".repeat(9000);
    const result = appendStderrToDraft("", huge);
    expect(result).toBe(`\`\`\`stderr\n${"x".repeat(8000)}\n\`\`\``);
  });
});

describe("extractResultCost", () => {
  it("returns the numeric cost when present", () => {
    expect(extractResultCost({ total_cost_usd: 0.042 })).toBe(0.042);
  });

  it("returns null when absent or non-numeric", () => {
    expect(extractResultCost({})).toBeNull();
    expect(extractResultCost({ total_cost_usd: "0.04" })).toBeNull();
  });
});

describe("extractResultTokenTotal", () => {
  it("sums numeric usage fields", () => {
    expect(
      extractResultTokenTotal({ usage: { input_tokens: 10, output_tokens: 5 } }),
    ).toBe(15);
  });

  it("returns null when the total is zero, missing, or usage is not an object", () => {
    expect(extractResultTokenTotal({ usage: { input_tokens: 0 } })).toBeNull();
    expect(extractResultTokenTotal({})).toBeNull();
    expect(extractResultTokenTotal({ usage: [1, 2, 3] })).toBeNull();
    expect(extractResultTokenTotal({ usage: null })).toBeNull();
  });

  it("ignores non-numeric fields mixed into usage", () => {
    expect(
      extractResultTokenTotal({ usage: { input_tokens: 10, model: "claude" } }),
    ).toBe(10);
  });
});

describe("extractToolEventName", () => {
  it("returns the event's name when it's a string", () => {
    expect(extractToolEventName({ name: "Read" })).toBe("Read");
  });

  it("falls back to 'unknown_tool' when name is missing or non-string", () => {
    expect(extractToolEventName({})).toBe("unknown_tool");
    expect(extractToolEventName({ name: 42 })).toBe("unknown_tool");
  });
});

describe("pushSeries", () => {
  it("appends a value", () => {
    expect(pushSeries([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("caps at the max length (default 24), dropping the oldest values", () => {
    const series = Array.from({ length: 24 }, (_, i) => i);
    expect(pushSeries(series, 99)).toEqual([...series.slice(1), 99]);
    expect(pushSeries(series, 99)).toHaveLength(24);
  });

  it("respects a custom max", () => {
    expect(pushSeries([1, 2, 3], 4, 2)).toEqual([3, 4]);
  });
});
