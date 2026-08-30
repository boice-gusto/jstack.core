import { readAgentMemory, writeAgentMemory } from "./markdown-store.js";
import { rebuildAgentIndex, searchAgentIndex } from "./fts-index.js";
import { noopAdapter, type MemoryAdapter } from "./adapter.js";
import type { AgentMemoryEntry, AgentMemoryInput } from "./types.js";

export type { AgentMemoryEntry, AgentMemoryInput, MemoryAdapter };
export { agentMemoryDir } from "./markdown-store.js";

/**
 * The three tiers wired together: write markdown (tier 1, source of truth) -> rebuild the FTS
 * index from it (tier 2, fast recall) -> fire-and-forget notify the pluggable adapter (tier 3,
 * no-op by default). A write failure at tier 1 (validation, secret detection) throws before
 * either later tier runs; a tier-3 failure never blocks the write that already succeeded on
 * disk -- an external sync backend being down must not make memory writes fail.
 */
export function rememberAgentMemory(
  memoryRoot: string,
  agentId: string,
  input: AgentMemoryInput,
  adapter: MemoryAdapter = noopAdapter,
): AgentMemoryEntry {
  const entry = writeAgentMemory(memoryRoot, agentId, input);
  rebuildAgentIndex(memoryRoot, agentId, readAgentMemory(memoryRoot, agentId));
  adapter.sync([entry]).catch(() => {
    /* tier 3 is best-effort; the write already succeeded at tier 1/2 */
  });
  return entry;
}

/** Fast recall via the tier-2 index. Returns [] for a query with no usable search terms or an
 * agent with no memory yet -- never throws on "nothing found." */
export function recallAgentMemory(
  memoryRoot: string,
  agentId: string,
  query: string,
  limit = 5,
): AgentMemoryEntry[] {
  return searchAgentIndex(memoryRoot, agentId, query, limit);
}

export { readAgentMemory } from "./markdown-store.js";
