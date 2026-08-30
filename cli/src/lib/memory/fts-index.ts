import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentMemoryEntry } from "./types.js";

/**
 * Tier 2 (fast recall): a SQLite FTS5 index built FROM the markdown tier, not authoritative on
 * its own -- `rebuildAgentIndex` always repopulates it from `readAgentMemory`'s current files, so
 * a corrupted or deleted index.db is never a data-loss event, only a rebuild. Rebuild-on-every-
 * write (called from index.ts's `rememberAgentMemory`) rather than incremental upsert: at the
 * scale one agent's personal memory actually reaches (tens to low hundreds of entries), a full
 * rebuild is microseconds and avoids having to keep two representations of "what's the current
 * entry set" in sync by hand.
 */

function indexPath(memoryRoot: string): string {
  return join(memoryRoot, "index.db");
}

function openDb(memoryRoot: string): Database {
  mkdirSync(memoryRoot, { recursive: true, mode: 0o700 });
  const db = new Database(indexPath(memoryRoot), { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      id UNINDEXED,
      agentId UNINDEXED,
      kind UNINDEXED,
      source UNINDEXED,
      tags,
      confidence UNINDEXED,
      createdAt UNINDEXED,
      content
    );
  `);
  return db;
}

export function rebuildAgentIndex(
  memoryRoot: string,
  agentId: string,
  entries: AgentMemoryEntry[],
): void {
  const db = openDb(memoryRoot);
  try {
    db.query("DELETE FROM memory_fts WHERE agentId = ?").run(agentId);
    const insert = db.query(
      "INSERT INTO memory_fts (id, agentId, kind, source, tags, confidence, createdAt, content) VALUES (?,?,?,?,?,?,?,?)",
    );
    for (const e of entries) {
      insert.run(
        e.id,
        e.agentId,
        e.kind,
        e.source,
        e.tags.join(" "),
        e.confidence,
        e.createdAt,
        e.content,
      );
    }
  } finally {
    db.close();
  }
}

/** Extracts bare alphanumeric terms and OR-joins them for an FTS5 MATCH query, so arbitrary
 * user text (which may contain quotes, `*`, `:`, or other FTS5 query-syntax characters) can
 * never produce a malformed MATCH expression -- a syntax error here would surface as a search
 * failure on every prompt, not a rare edge case. */
function toMatchQuery(query: string): string | null {
  const terms = query.match(/[\p{L}\p{N}]+/gu);
  if (!terms || terms.length === 0) return null;
  return terms.map((t) => `"${t}"`).join(" OR ");
}

export function searchAgentIndex(
  memoryRoot: string,
  agentId: string,
  query: string,
  limit = 5,
): AgentMemoryEntry[] {
  const match = toMatchQuery(query);
  if (!match) return [];
  const db = openDb(memoryRoot);
  try {
    const rows = db
      .query<
        {
          id: string;
          agentId: string;
          kind: string;
          source: string;
          tags: string;
          confidence: number;
          createdAt: string;
          content: string;
        },
        [string, string, number]
      >(
        "SELECT id, agentId, kind, source, tags, confidence, createdAt, content FROM memory_fts " +
          "WHERE agentId = ? AND memory_fts MATCH ? ORDER BY bm25(memory_fts) LIMIT ?",
      )
      .all(agentId, match, limit);
    return rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      kind: r.kind as AgentMemoryEntry["kind"],
      source: r.source as AgentMemoryEntry["source"],
      tags: r.tags.split(" ").filter((t) => t.length > 0),
      confidence: r.confidence,
      createdAt: r.createdAt,
      content: r.content,
    }));
  } finally {
    db.close();
  }
}
