import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recallAgentMemory, rememberAgentMemory } from "./index.js";
import type { AgentMemoryEntry } from "./types.js";
import type { MemoryAdapter } from "./adapter.js";

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), "agent-memory-index-test-"));
}

describe("rememberAgentMemory / recallAgentMemory", () => {
  test("a fact written in one call is recallable by keyword afterward", () => {
    const root = freshRoot();
    rememberAgentMemory(root, "ralph", {
      kind: "fact",
      source: "user-stated",
      content: "The user's Q3 deadline is October 15.",
    });
    const recalled = recallAgentMemory(root, "ralph", "deadline");
    expect(recalled).toHaveLength(1);
    expect(recalled[0]?.content).toContain("October 15");
  });

  test("invalid input (e.g. a secret) throws before touching the index", () => {
    const root = freshRoot();
    expect(() =>
      rememberAgentMemory(root, "ralph", {
        kind: "fact",
        source: "observed",
        content: "token sk-abcdefghijklmnopqrstuvwx",
      }),
    ).toThrow();
    expect(recallAgentMemory(root, "ralph", "token")).toEqual([]);
  });

  test("notifies the tier-3 adapter with the new entry, but a rejecting adapter doesn't fail the write", async () => {
    const root = freshRoot();
    const synced: AgentMemoryEntry[] = [];
    const failingAdapter: MemoryAdapter = {
      sync: async () => {
        throw new Error("backend unreachable");
      },
    };
    const entry = rememberAgentMemory(
      root,
      "ralph",
      {
        kind: "fact",
        source: "observed",
        content: "written despite adapter failure",
      },
      failingAdapter,
    );
    expect(entry.content).toBe("written despite adapter failure");
    // Give the fire-and-forget rejection a tick to settle so it doesn't surface as an
    // unhandled rejection in a later test.
    await Bun.sleep(5);

    const okAdapter: MemoryAdapter = {
      sync: async (entries) => {
        synced.push(...entries);
      },
    };
    rememberAgentMemory(
      root,
      "ralph",
      { kind: "fact", source: "observed", content: "second" },
      okAdapter,
    );
    await Bun.sleep(5);
    expect(synced.map((e) => e.content)).toEqual(["second"]);
  });

  test("recall returns [] for an agent with no memory", () => {
    expect(recallAgentMemory(freshRoot(), "nobody", "anything")).toEqual([]);
  });
});
