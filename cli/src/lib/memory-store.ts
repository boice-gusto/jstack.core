import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Local, jsonl-based durable memory for the self/* skills (remember, diary, eval, lookback).
 *
 * Exists because self/remember previously had NO local persistence at all -- every "durable
 * memory" claim resolved to an external product (GBrain) reached only via a configured URL, and
 * the repo's own docs stated jstack does not call GBrain's API. This gives self/* a real,
 * jstack-owned fallback that works with zero external dependencies, modeled on gstack's
 * gstack-learnings-log / gstack-decision-log (validated fields, append-only jsonl, "latest wins"
 * dedup by key at read time) but implemented as tested TypeScript instead of a shell script.
 */

export const MEMORY_REL = ".jstack/memory.jsonl";

export const MEMORY_KINDS = [
  "fact",
  "decision",
  "preference",
  "pattern",
] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const MEMORY_SOURCES = ["user-stated", "observed", "inferred"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export interface MemoryEntryInput {
  kind: MemoryKind;
  key: string;
  insight: string;
  source: MemorySource;
  skill?: string;
  confidence?: number;
}

export interface MemoryEntry extends MemoryEntryInput {
  written_at: string;
}

export class MemoryValidationError extends Error {}

const KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

// Deliberately simple, pattern-based secret detection -- a guardrail against the most common
// accidental-paste shapes, not an exhaustive scanner. Mirrors the categories jstack's own audit
// tooling already greps for (AKIA/sk-/ghp_/private-key headers) rather than inventing a new list.
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI/Anthropic-style secret key", pattern: /sk-[A-Za-z0-9]{20,}/ },
  { name: "Slack token", pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "bearer token", pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/i },
];

export function detectSecret(text: string): string | null {
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

export function validateMemoryEntry(input: unknown): MemoryEntryInput {
  if (typeof input !== "object" || input === null) {
    throw new MemoryValidationError("entry must be a JSON object");
  }
  const j = input as Record<string, unknown>;

  if (
    typeof j.kind !== "string" ||
    !MEMORY_KINDS.includes(j.kind as MemoryKind)
  ) {
    throw new MemoryValidationError(
      `kind must be one of: ${MEMORY_KINDS.join(", ")} (got ${JSON.stringify(j.kind)})`,
    );
  }
  if (typeof j.key !== "string" || !KEY_PATTERN.test(j.key)) {
    throw new MemoryValidationError(
      "key must be a non-empty string of letters, digits, hyphens, or underscores only",
    );
  }
  if (typeof j.insight !== "string" || j.insight.trim().length === 0) {
    throw new MemoryValidationError("insight must be a non-empty string");
  }
  if (
    typeof j.source !== "string" ||
    !MEMORY_SOURCES.includes(j.source as MemorySource)
  ) {
    throw new MemoryValidationError(
      `source must be one of: ${MEMORY_SOURCES.join(", ")} (got ${JSON.stringify(j.source)})`,
    );
  }
  let confidence: number | undefined;
  if (j.confidence !== undefined) {
    const c = Number(j.confidence);
    if (!Number.isInteger(c) || c < 1 || c > 10) {
      throw new MemoryValidationError(
        "confidence must be an integer from 1 to 10 when provided",
      );
    }
    confidence = c;
  }
  if (j.skill !== undefined && typeof j.skill !== "string") {
    throw new MemoryValidationError("skill must be a string when provided");
  }

  const secretHit = detectSecret(j.insight);
  if (secretHit) {
    throw new MemoryValidationError(
      `refusing to store: insight looks like it contains a ${secretHit}. Rotate it immediately -- ` +
        "this store is plain-text jsonl on disk, not a secrets manager.",
    );
  }

  return {
    kind: j.kind as MemoryKind,
    key: j.key,
    insight: j.insight,
    source: j.source as MemorySource,
    skill: j.skill as string | undefined,
    confidence,
  };
}

function memoryPath(projectRoot: string): string {
  return join(projectRoot, MEMORY_REL);
}

export function appendMemoryEntry(
  projectRoot: string,
  input: unknown,
): MemoryEntry {
  const validated = validateMemoryEntry(input);
  const entry: MemoryEntry = {
    ...validated,
    written_at: new Date().toISOString(),
  };
  const path = memoryPath(projectRoot);
  mkdirSync(join(projectRoot, ".jstack"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(entry)}\n`, { flag: "a" });
  return entry;
}

/** Reads all entries, tolerating a missing file (empty history) and skipping malformed lines. */
export function readAllMemoryEntries(projectRoot: string): MemoryEntry[] {
  const path = memoryPath(projectRoot);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  const entries: MemoryEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as MemoryEntry);
    } catch {
      // Skip a malformed line rather than fail the whole read -- append-only logs can pick up a
      // truncated last line from an interrupted write; that shouldn't cost every earlier entry.
    }
  }
  return entries;
}

export interface MemorySearchOptions {
  kind?: MemoryKind;
  key?: string;
  skill?: string;
  limit?: number;
}

/**
 * Search with "latest wins" dedup: if the same (kind, key) was logged more than once, only the
 * most recent entry is returned, mirroring gstack-learnings-search's read-time dedup so a
 * superseded fact doesn't show up twice.
 */
export function searchMemoryEntries(
  projectRoot: string,
  opts: MemorySearchOptions = {},
): MemoryEntry[] {
  // readAllMemoryEntries returns entries in file (write) order, oldest first. Track that index
  // explicitly as the dedup/sort tiebreaker -- written_at alone isn't reliable, since fast
  // successive writes can share the same millisecond and make a timestamp-only sort a no-op.
  const all = readAllMemoryEntries(projectRoot);
  const latestByKindKey = new Map<
    string,
    { entry: MemoryEntry; index: number }
  >();
  all.forEach((entry, index) => {
    latestByKindKey.set(`${entry.kind} ${entry.key}`, { entry, index });
  });
  let results = Array.from(latestByKindKey.values());
  if (opts.kind) results = results.filter((r) => r.entry.kind === opts.kind);
  if (opts.key) results = results.filter((r) => r.entry.key === opts.key);
  if (opts.skill) results = results.filter((r) => r.entry.skill === opts.skill);
  results.sort((a, b) => b.index - a.index);
  if (opts.limit !== undefined) results = results.slice(0, opts.limit);
  return results.map((r) => r.entry);
}
