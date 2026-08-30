import type { AgentMemoryEntry } from "./types.js";

/**
 * Tier 3 (pluggable, non-goal here): an extension point for a real graph/hybrid-retrieval
 * backend later, kept a no-op in core -- matching how core already treats "GBrain" as external
 * config only (`config/defaults.json`'s `knowledge_base.gbrain`), never a concrete dependency.
 * A caller (an org overlay, a future personal extension) supplies a real adapter; core never
 * ships one.
 */
export interface MemoryAdapter {
  sync(entries: AgentMemoryEntry[]): Promise<void>;
}

export const noopAdapter: MemoryAdapter = {
  async sync() {
    /* no external backend configured */
  },
};
