import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendTranscriptEntry,
  readTranscript,
  type TranscriptEntry,
} from "./transcript.js";

function freshStateDir(): string {
  return mkdtempSync(join(tmpdir(), "crew-transcript-test-"));
}

describe("appendTranscriptEntry / readTranscript", () => {
  test("round-trips entries in append order", () => {
    const dir = freshStateDir();
    const user: TranscriptEntry = {
      role: "user",
      text: "hi",
      at: "2026-01-01T00:00:00.000Z",
    };
    const assistant: TranscriptEntry = {
      role: "assistant",
      text: "hello",
      costUsd: 0.01,
      toolEvents: [],
      at: "2026-01-01T00:00:01.000Z",
    };
    appendTranscriptEntry(dir, "ral-abcd", user);
    appendTranscriptEntry(dir, "ral-abcd", assistant);
    expect(readTranscript(dir, "ral-abcd")).toEqual([user, assistant]);
  });

  test("keeps tool events attached to the assistant entry", () => {
    const dir = freshStateDir();
    const entry: TranscriptEntry = {
      role: "assistant",
      text: "done",
      costUsd: 0.02,
      toolEvents: [{ name: "Read", input: { file_path: "/x" } }],
      at: "2026-01-01T00:00:00.000Z",
    };
    appendTranscriptEntry(dir, "ral-abcd", entry);
    expect(readTranscript(dir, "ral-abcd")).toEqual([entry]);
  });

  test("readTranscript returns [] for a session with no history yet", () => {
    expect(readTranscript(freshStateDir(), "nope")).toEqual([]);
  });

  test("different sessions do not share a transcript", () => {
    const dir = freshStateDir();
    appendTranscriptEntry(dir, "ral-aaaa", {
      role: "user",
      text: "a",
      at: "t",
    });
    appendTranscriptEntry(dir, "ral-bbbb", {
      role: "user",
      text: "b",
      at: "t",
    });
    expect(readTranscript(dir, "ral-aaaa")).toEqual([
      { role: "user", text: "a", at: "t" },
    ]);
    expect(readTranscript(dir, "ral-bbbb")).toEqual([
      { role: "user", text: "b", at: "t" },
    ]);
  });

  test("skips a malformed line instead of failing the whole read", () => {
    const dir = freshStateDir();
    appendTranscriptEntry(dir, "ral-abcd", {
      role: "user",
      text: "first",
      at: "t",
    });
    // Simulate a truncated write by appending a raw non-JSON line directly.
    appendFileSync(join(dir, "transcripts", "ral-abcd.jsonl"), "not json\n");
    appendTranscriptEntry(dir, "ral-abcd", {
      role: "user",
      text: "third",
      at: "t",
    });
    const entries = readTranscript(dir, "ral-abcd");
    expect(entries.map((e) => e.text)).toEqual(["first", "third"]);
  });
});
