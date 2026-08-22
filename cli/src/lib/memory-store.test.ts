import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MemoryValidationError,
  appendMemoryEntry,
  detectSecret,
  readAllMemoryEntries,
  searchMemoryEntries,
  validateMemoryEntry,
} from "./memory-store.js";

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), "jstack-memory-test-"));
}

describe("validateMemoryEntry", () => {
  test("accepts a minimal valid entry", () => {
    const v = validateMemoryEntry({
      kind: "fact",
      key: "prefers-async-standups",
      insight: "Prefers async standups over live meetings.",
      source: "user-stated",
    });
    expect(v.kind).toBe("fact");
    expect(v.key).toBe("prefers-async-standups");
  });

  test("accepts optional confidence and skill", () => {
    const v = validateMemoryEntry({
      kind: "pattern",
      key: "review-latency",
      insight: "Reviews tend to slip past 2 days without a nudge.",
      source: "observed",
      confidence: 7,
      skill: "self-lookback",
    });
    expect(v.confidence).toBe(7);
    expect(v.skill).toBe("self-lookback");
  });

  test("rejects an invalid kind", () => {
    expect(() =>
      validateMemoryEntry({
        kind: "vibe",
        key: "x",
        insight: "y",
        source: "user-stated",
      }),
    ).toThrow(MemoryValidationError);
  });

  test("rejects a key with spaces or punctuation", () => {
    expect(() =>
      validateMemoryEntry({
        kind: "fact",
        key: "not a valid key!",
        insight: "y",
        source: "user-stated",
      }),
    ).toThrow(MemoryValidationError);
  });

  test("rejects an empty insight", () => {
    expect(() =>
      validateMemoryEntry({
        kind: "fact",
        key: "x",
        insight: "   ",
        source: "user-stated",
      }),
    ).toThrow(MemoryValidationError);
  });

  test("rejects an invalid source", () => {
    expect(() =>
      validateMemoryEntry({
        kind: "fact",
        key: "x",
        insight: "y",
        source: "vibes",
      }),
    ).toThrow(MemoryValidationError);
  });

  test("rejects confidence outside 1-10", () => {
    expect(() =>
      validateMemoryEntry({
        kind: "fact",
        key: "x",
        insight: "y",
        source: "user-stated",
        confidence: 11,
      }),
    ).toThrow(MemoryValidationError);
    expect(() =>
      validateMemoryEntry({
        kind: "fact",
        key: "x",
        insight: "y",
        source: "user-stated",
        confidence: 0,
      }),
    ).toThrow(MemoryValidationError);
  });

  test("refuses an insight containing an obvious secret", () => {
    expect(() =>
      validateMemoryEntry({
        kind: "fact",
        key: "x",
        insight: "my key is AKIAIOSFODNN7EXAMPLE, don't lose it",
        source: "user-stated",
      }),
    ).toThrow(/refusing to store/);
  });
});

describe("detectSecret", () => {
  test("flags common secret shapes", () => {
    expect(
      detectSecret("token: ghp_1234567890abcdef1234567890abcdef1234"),
    ).toBe("GitHub token");
    expect(detectSecret("sk-abcdefghijklmnopqrstuvwx1234567890")).toBe(
      "OpenAI/Anthropic-style secret key",
    );
    expect(detectSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(
      "private key block",
    );
  });

  test("does not flag ordinary text", () => {
    expect(detectSecret("the deploy went fine, no issues")).toBeNull();
  });
});

describe("appendMemoryEntry / readAllMemoryEntries", () => {
  test("writes a jsonl line and reads it back with a written_at stamp", () => {
    const root = tmpRoot();
    const entry = appendMemoryEntry(root, {
      kind: "decision",
      key: "use-bun",
      insight: "Chose Bun over Node for the CLI runtime.",
      source: "user-stated",
    });
    expect(typeof entry.written_at).toBe("string");

    const all = readAllMemoryEntries(root);
    expect(all).toHaveLength(1);
    expect(all[0].key).toBe("use-bun");
  });

  test("is append-only across multiple writes", () => {
    const root = tmpRoot();
    appendMemoryEntry(root, {
      kind: "fact",
      key: "a",
      insight: "first",
      source: "observed",
    });
    appendMemoryEntry(root, {
      kind: "fact",
      key: "b",
      insight: "second",
      source: "observed",
    });
    expect(readAllMemoryEntries(root)).toHaveLength(2);
  });

  test("returns an empty array when no memory file exists yet", () => {
    const root = tmpRoot();
    expect(readAllMemoryEntries(root)).toEqual([]);
  });

  test("skips a malformed trailing line instead of failing the whole read", () => {
    const root = tmpRoot();
    appendMemoryEntry(root, {
      kind: "fact",
      key: "a",
      insight: "first",
      source: "observed",
    });
    const path = join(root, ".jstack", "memory.jsonl");
    const before = readFileSync(path, "utf8");
    appendFileSync(path, "{not valid json\n");
    const after = readAllMemoryEntries(root);
    expect(after).toHaveLength(1);
    expect(before.trim().length).toBeGreaterThan(0);
  });

  test("propagates a validation error and writes nothing on rejection", () => {
    const root = tmpRoot();
    expect(() =>
      appendMemoryEntry(root, {
        kind: "not-a-kind",
        key: "x",
        insight: "y",
        source: "observed",
      }),
    ).toThrow(MemoryValidationError);
    expect(readAllMemoryEntries(root)).toEqual([]);
  });
});

describe("searchMemoryEntries", () => {
  test("filters by kind, key, and skill", () => {
    const root = tmpRoot();
    appendMemoryEntry(root, {
      kind: "fact",
      key: "a",
      insight: "one",
      source: "observed",
      skill: "self-remember",
    });
    appendMemoryEntry(root, {
      kind: "decision",
      key: "b",
      insight: "two",
      source: "user-stated",
      skill: "self-lookback",
    });

    expect(searchMemoryEntries(root, { kind: "fact" })).toHaveLength(1);
    expect(searchMemoryEntries(root, { key: "b" })).toHaveLength(1);
    expect(searchMemoryEntries(root, { skill: "self-remember" })[0].key).toBe(
      "a",
    );
  });

  test("dedups by (kind, key), returning only the latest entry", () => {
    const root = tmpRoot();
    appendMemoryEntry(root, {
      kind: "preference",
      key: "meeting-style",
      insight: "prefers video calls",
      source: "user-stated",
    });
    appendMemoryEntry(root, {
      kind: "preference",
      key: "meeting-style",
      insight: "actually prefers async now",
      source: "user-stated",
    });

    const results = searchMemoryEntries(root, {
      kind: "preference",
      key: "meeting-style",
    });
    expect(results).toHaveLength(1);
    expect(results[0].insight).toBe("actually prefers async now");
  });

  test("respects limit and sorts newest first", () => {
    const root = tmpRoot();
    for (const key of ["a", "b", "c"]) {
      appendMemoryEntry(root, {
        kind: "fact",
        key,
        insight: key,
        source: "observed",
      });
    }
    const results = searchMemoryEntries(root, { limit: 2 });
    expect(results).toHaveLength(2);
    // Newest write (c) sorts first.
    expect(results[0].key).toBe("c");
  });
});
