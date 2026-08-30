import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rebuildAgentIndex, searchAgentIndex } from "./fts-index.js";
import type { AgentMemoryEntry } from "./types.js";

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), "agent-memory-fts-test-"));
}

function entry(overrides: Partial<AgentMemoryEntry> = {}): AgentMemoryEntry {
  return {
    id: `id-${Math.random().toString(36).slice(2, 8)}`,
    agentId: "ralph",
    kind: "fact",
    source: "observed",
    tags: [],
    confidence: 5,
    createdAt: new Date().toISOString(),
    content: "placeholder",
    ...overrides,
  };
}

describe("rebuildAgentIndex / searchAgentIndex", () => {
  test("finds an entry by a keyword in its content", () => {
    const root = freshRoot();
    rebuildAgentIndex(root, "ralph", [
      entry({ content: "The Q3 deadline is October 15." }),
      entry({ content: "Prefers terse replies." }),
    ]);
    const results = searchAgentIndex(root, "ralph", "deadline");
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toContain("October 15");
  });

  test("searches never cross agent boundaries", () => {
    const root = freshRoot();
    rebuildAgentIndex(root, "ralph", [
      entry({ agentId: "ralph", content: "shared keyword apple" }),
    ]);
    rebuildAgentIndex(root, "scout", [
      entry({ agentId: "scout", content: "shared keyword apple" }),
    ]);
    expect(searchAgentIndex(root, "ralph", "apple")).toHaveLength(1);
    expect(searchAgentIndex(root, "scout", "apple")).toHaveLength(1);
  });

  test("rebuild replaces the prior set for that agent rather than accumulating", () => {
    const root = freshRoot();
    rebuildAgentIndex(root, "ralph", [entry({ content: "one apple" })]);
    rebuildAgentIndex(root, "ralph", [entry({ content: "two banana" })]);
    expect(searchAgentIndex(root, "ralph", "apple")).toHaveLength(0);
    expect(searchAgentIndex(root, "ralph", "banana")).toHaveLength(1);
  });

  test("returns [] for a query with no usable search terms instead of throwing", () => {
    const root = freshRoot();
    rebuildAgentIndex(root, "ralph", [entry({ content: "anything" })]);
    expect(searchAgentIndex(root, "ralph", "!!! *** :::")).toEqual([]);
  });

  test("a query containing FTS5-special characters does not throw a syntax error", () => {
    const root = freshRoot();
    rebuildAgentIndex(root, "ralph", [
      entry({ content: 'quoted "phrase" test' }),
    ]);
    expect(() =>
      searchAgentIndex(root, "ralph", '"quoted phrase" AND (broken'),
    ).not.toThrow();
  });

  test("respects the limit parameter", () => {
    const root = freshRoot();
    rebuildAgentIndex(
      root,
      "ralph",
      Array.from({ length: 10 }, (_, i) =>
        entry({ content: `apple entry ${i}` }),
      ),
    );
    expect(searchAgentIndex(root, "ralph", "apple", 3)).toHaveLength(3);
  });
});
