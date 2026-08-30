import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAgentMemory, writeAgentMemory } from "./markdown-store.js";
import { MemoryValidationError } from "../memory-store.js";

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), "agent-memory-md-test-"));
}

describe("writeAgentMemory / readAgentMemory", () => {
  test("round-trips an entry through markdown frontmatter", () => {
    const root = freshRoot();
    const written = writeAgentMemory(root, "ralph", {
      kind: "fact",
      source: "user-stated",
      content: "The user's Q3 deadline is October 15.",
      tags: ["deadline", "q3"],
      confidence: 8,
    });
    const [read] = readAgentMemory(root, "ralph");
    expect(read).toEqual(written);
  });

  test("defaults confidence to 5 and tags to [] when omitted", () => {
    const root = freshRoot();
    const entry = writeAgentMemory(root, "ralph", {
      kind: "preference",
      source: "observed",
      content: "Prefers terse replies.",
    });
    expect(entry.confidence).toBe(5);
    expect(entry.tags).toEqual([]);
  });

  test("rejects empty content", () => {
    const root = freshRoot();
    expect(() =>
      writeAgentMemory(root, "ralph", {
        kind: "fact",
        source: "observed",
        content: "   ",
      }),
    ).toThrow(MemoryValidationError);
  });

  test("rejects content that looks like a secret", () => {
    const root = freshRoot();
    expect(() =>
      writeAgentMemory(root, "ralph", {
        kind: "fact",
        source: "observed",
        content: "API key is sk-abcdefghijklmnopqrstuvwx",
      }),
    ).toThrow(MemoryValidationError);
  });

  test("rejects out-of-range confidence", () => {
    const root = freshRoot();
    expect(() =>
      writeAgentMemory(root, "ralph", {
        kind: "fact",
        source: "observed",
        content: "fine",
        confidence: 11,
      }),
    ).toThrow(MemoryValidationError);
  });

  test("readAgentMemory returns [] for an agent with no memory yet", () => {
    expect(readAgentMemory(freshRoot(), "nobody")).toEqual([]);
  });

  test("entries from different agents don't leak into each other's reads", () => {
    const root = freshRoot();
    writeAgentMemory(root, "ralph", {
      kind: "fact",
      source: "observed",
      content: "ralph fact",
    });
    writeAgentMemory(root, "scout", {
      kind: "fact",
      source: "observed",
      content: "scout fact",
    });
    expect(readAgentMemory(root, "ralph")).toHaveLength(1);
    expect(readAgentMemory(root, "scout")).toHaveLength(1);
    expect(readAgentMemory(root, "ralph")[0]?.content).toBe("ralph fact");
  });

  test("returns entries sorted oldest first", async () => {
    const root = freshRoot();
    writeAgentMemory(root, "ralph", {
      kind: "fact",
      source: "observed",
      content: "first",
    });
    await Bun.sleep(5);
    writeAgentMemory(root, "ralph", {
      kind: "fact",
      source: "observed",
      content: "second",
    });
    const entries = readAgentMemory(root, "ralph");
    expect(entries.map((e) => e.content)).toEqual(["first", "second"]);
  });
});
