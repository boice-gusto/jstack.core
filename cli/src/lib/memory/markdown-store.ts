import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { detectSecret, MemoryValidationError } from "../memory-store.js";
import type { AgentMemoryEntry, AgentMemoryInput } from "./types.js";

/**
 * Tier 1 (source of truth): one markdown file per memory entry, human-editable and git-friendly
 * if the caller points `memoryRoot` at a versioned directory. Deliberately a hand-rolled
 * frontmatter format, not a YAML library -- every field here is a single scalar or a
 * comma-joined tag list (matching this repo's own skill-frontmatter rule that frontmatter
 * values must be inline scalars, `cli/CLAUDE.md`), so a full YAML parser would be more
 * dependency than the format needs.
 */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

export function agentMemoryDir(memoryRoot: string, agentId: string): string {
  return join(memoryRoot, agentId);
}

function serialize(entry: AgentMemoryEntry): string {
  const fm = [
    `id: ${entry.id}`,
    `agentId: ${entry.agentId}`,
    `kind: ${entry.kind}`,
    `source: ${entry.source}`,
    `tags: ${entry.tags.join(", ")}`,
    `confidence: ${entry.confidence}`,
    `createdAt: ${entry.createdAt}`,
  ].join("\n");
  return `---\n${fm}\n---\n${entry.content}\n`;
}

function parse(raw: string): AgentMemoryEntry | null {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return null;
  const [, fmBlock, body] = m;
  const fields: Record<string, string> = {};
  for (const line of fmBlock!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const { id, agentId, kind, source, tags, confidence, createdAt } = fields;
  if (!id || !agentId || !kind || !source || !createdAt) return null;
  const confidenceNum = Number(confidence);
  if (!Number.isFinite(confidenceNum)) return null;
  return {
    id,
    agentId,
    kind: kind as AgentMemoryEntry["kind"],
    source: source as AgentMemoryEntry["source"],
    tags: tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [],
    confidence: confidenceNum,
    createdAt,
    content: (body ?? "").trim(),
  };
}

/**
 * Writes one memory entry as a new markdown file. Refuses (like `memory-store.ts`'s
 * `validateMemoryEntry`) anything that looks like a credential -- this store is plain-text
 * markdown on disk, same threat model as that jsonl store.
 */
export function writeAgentMemory(
  memoryRoot: string,
  agentId: string,
  input: AgentMemoryInput,
): AgentMemoryEntry {
  if (input.content.trim().length === 0) {
    throw new MemoryValidationError("content must be a non-empty string");
  }
  const secretHit = detectSecret(input.content);
  if (secretHit) {
    throw new MemoryValidationError(
      `refusing to store: content looks like it contains a ${secretHit}. Rotate it immediately -- ` +
        "this store is plain-text markdown on disk, not a secrets manager.",
    );
  }
  if (
    input.confidence !== undefined &&
    (!Number.isInteger(input.confidence) ||
      input.confidence < 1 ||
      input.confidence > 10)
  ) {
    throw new MemoryValidationError(
      "confidence must be an integer from 1 to 10 when provided",
    );
  }

  const dir = agentMemoryDir(memoryRoot, agentId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  const entry: AgentMemoryEntry = {
    id: `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
    agentId,
    kind: input.kind,
    source: input.source,
    tags: input.tags ?? [],
    confidence: input.confidence ?? 5,
    createdAt: new Date().toISOString(),
    content: input.content.trim(),
  };
  writeFileSync(join(dir, `${entry.id}.md`), serialize(entry));
  return entry;
}

/** Reads every entry for one agent, tolerating a missing directory (no memory yet) and
 * skipping any file that doesn't parse -- a hand-edited or partially-written file must not
 * take down every other entry's recall. */
export function readAgentMemory(
  memoryRoot: string,
  agentId: string,
): AgentMemoryEntry[] {
  const dir = agentMemoryDir(memoryRoot, agentId);
  if (!existsSync(dir)) return [];
  const entries: AgentMemoryEntry[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    try {
      const parsed = parse(readFileSync(join(dir, file), "utf8"));
      if (parsed) entries.push(parsed);
    } catch {
      /* skip an unreadable/malformed file rather than fail the whole read */
    }
  }
  entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return entries;
}
