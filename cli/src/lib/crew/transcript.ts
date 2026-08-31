import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expandHome } from "./store.js";
import type { ToolCallEvent } from "./slack.js";

/**
 * Per-session message transcript, append-only JSONL (same shape of durability choice as
 * memory-store.ts's project-scoped log) -- a manual session's `turns`/`cost_usd` columns in
 * CrewStore say HOW MUCH happened, never WHAT was said, so switching back to a session or
 * reopening the app had nothing to show but that bookkeeping. This is what the UI actually
 * renders as chat history.
 */
export type TranscriptEntry =
  | { role: "user"; text: string; at: string }
  | {
      role: "assistant";
      text: string;
      costUsd: number;
      toolEvents: ToolCallEvent[];
      at: string;
    }
  | { role: "error"; text: string; at: string };

function transcriptPath(stateDir: string, sessionId: string): string {
  // sessionId is always a taskId()-shaped handle (session.ts) or a UUID (claude/codex session
  // id) -- neither can contain a path separator, so no sanitization beyond that assumption is
  // needed to keep this inside the transcripts directory.
  return join(expandHome(stateDir), "transcripts", `${sessionId}.jsonl`);
}

export function appendTranscriptEntry(
  stateDir: string,
  sessionId: string,
  entry: TranscriptEntry,
): void {
  const path = transcriptPath(stateDir, sessionId);
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(entry)}\n`, { flag: "a" });
}

/** Tolerates a missing file (no history yet) and skips any line that doesn't parse, the same
 * way memory-store.ts's jsonl reader does -- a truncated last line from an interrupted write
 * must not cost every earlier entry. */
export function readTranscript(
  stateDir: string,
  sessionId: string,
): TranscriptEntry[] {
  const path = transcriptPath(stateDir, sessionId);
  if (!existsSync(path)) return [];
  const entries: TranscriptEntry[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line.trim().length === 0) continue;
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      /* skip a malformed line rather than fail the whole read */
    }
  }
  return entries;
}
