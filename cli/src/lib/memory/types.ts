import type { MemoryKind, MemorySource } from "../memory-store.js";

export type { MemoryKind, MemorySource };

/**
 * Per-agent memory, distinct from `memory-store.ts`'s project-scoped jsonl store for `self/*`
 * skills: this is keyed by agent id, lives under a daemon's `state_dir` (not a project root),
 * and is meant to be recalled during a session turn (session.ts), not read back by the user via
 * a `self/lookback`-style skill. Reuses `MemoryKind`/`MemorySource` from that store rather than
 * inventing a second taxonomy for the same concepts.
 */
export interface AgentMemoryEntry {
  id: string;
  agentId: string;
  kind: MemoryKind;
  source: MemorySource;
  tags: string[];
  confidence: number;
  createdAt: string;
  content: string;
}

export interface AgentMemoryInput {
  kind: MemoryKind;
  source: MemorySource;
  content: string;
  tags?: string[];
  confidence?: number;
}
