import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

/**
 * The ledger. G1's authority lives here, so durability matters more than anything
 * else in this file: a lost outbox means Ralph cannot tell his own posts from yours.
 *
 * Single writer (one tick at a time, enforced by the lockfile in tick.ts).
 */

export const SCHEMA_VERSION = 1;

export function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

export interface OutboxRow {
  channelId: string;
  ts: string;
  taskId: string;
  step: string;
}

export class CrewStore {
  private db: Database;

  constructor(stateDir: string) {
    const dir = expandHome(stateDir);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const path = join(dir, "crew.db");
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new Database(path, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS watermark (
        channel_id TEXT NOT NULL, thread_ts TEXT NOT NULL DEFAULT '',
        last_ts TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY (channel_id, thread_ts)
      );
      CREATE TABLE IF NOT EXISTS seen (
        channel_id TEXT NOT NULL, ts TEXT NOT NULL, author TEXT,
        rule_id TEXT, seen_at INTEGER NOT NULL,
        PRIMARY KEY (channel_id, ts)
      );
      CREATE TABLE IF NOT EXISTS outbox (
        channel_id TEXT NOT NULL, ts TEXT NOT NULL,
        task_id TEXT NOT NULL, step TEXT NOT NULL, posted_at INTEGER NOT NULL,
        PRIMARY KEY (channel_id, ts)
      );
      CREATE TABLE IF NOT EXISTS task (
        id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, source_ts TEXT NOT NULL,
        agent_id TEXT NOT NULL DEFAULT '',
        thread_ts TEXT,          -- the thread this task owns; follow-ups arrive here
        session_id TEXT,         -- claude --session-id, so --resume keeps the memory
        turns INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL, cost_usd REAL NOT NULL DEFAULT 0,
        started_at INTEGER, ended_at INTEGER, last_at INTEGER, error TEXT,
        UNIQUE (channel_id, source_ts)
      );
      CREATE INDEX IF NOT EXISTS task_thread ON task(channel_id, thread_ts);
      CREATE TABLE IF NOT EXISTS spend (day TEXT PRIMARY KEY, usd REAL NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS event (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, tick_id TEXT NOT NULL,
        channel_id TEXT, msg_ts TEXT, kind TEXT NOT NULL, rule_id TEXT, detail TEXT
      );
      CREATE INDEX IF NOT EXISTS event_msg ON event(channel_id, msg_ts);
    `);
    const row = this.db
      .query<{ value: string }, []>(
        "SELECT value FROM meta WHERE key='schema_version'",
      )
      .get();
    if (!row) {
      this.db
        .query("INSERT INTO meta (key,value) VALUES ('schema_version',?)")
        .run(String(SCHEMA_VERSION));
    } else if (Number(row.value) > SCHEMA_VERSION) {
      throw new Error(
        `crew.db was written by a newer version (schema ${row.value} > ${SCHEMA_VERSION}). Upgrade jstack or move the file aside.`,
      );
    }
  }

  // -- G1's authority --------------------------------------------------------
  outboxHas(channelId: string, ts: string): boolean {
    return !!this.db
      .query("SELECT 1 FROM outbox WHERE channel_id=? AND ts=?")
      .get(channelId, ts);
  }

  recordOutbox(r: OutboxRow): void {
    this.db
      .query(
        "INSERT OR IGNORE INTO outbox (channel_id,ts,task_id,step,posted_at) VALUES (?,?,?,?,?)",
      )
      .run(r.channelId, r.ts, r.taskId, r.step, Date.now());
  }

  // -- watermark -------------------------------------------------------------
  getWatermark(channelId: string): string | null {
    const r = this.db
      .query<{ last_ts: string }, [string]>(
        "SELECT last_ts FROM watermark WHERE channel_id=? AND thread_ts=''",
      )
      .get(channelId);
    return r?.last_ts ?? null;
  }

  /** Only ever advances. Called after every message in the page is durably recorded. */
  setWatermark(channelId: string, ts: string): void {
    const cur = this.getWatermark(channelId);
    if (cur && Number(cur) >= Number(ts)) return;
    this.db
      .query(
        "INSERT INTO watermark (channel_id,thread_ts,last_ts,updated_at) VALUES (?,'',?,?) " +
          "ON CONFLICT(channel_id,thread_ts) DO UPDATE SET last_ts=excluded.last_ts, updated_at=excluded.updated_at",
      )
      .run(channelId, ts, Date.now());
  }

  getThreadWatermark(channelId: string, threadTs: string): string | null {
    const r = this.db
      .query<{ last_ts: string }, [string, string]>(
        "SELECT last_ts FROM watermark WHERE channel_id=? AND thread_ts=?",
      )
      .get(channelId, threadTs);
    return r?.last_ts ?? null;
  }

  setThreadWatermark(channelId: string, threadTs: string, ts: string): void {
    const cur = this.getThreadWatermark(channelId, threadTs);
    if (cur && Number(cur) >= Number(ts)) return;
    this.db
      .query(
        "INSERT INTO watermark (channel_id,thread_ts,last_ts,updated_at) VALUES (?,?,?,?) " +
          "ON CONFLICT(channel_id,thread_ts) DO UPDATE SET last_ts=excluded.last_ts, updated_at=excluded.updated_at",
      )
      .run(channelId, threadTs, ts, Date.now());
  }

  markSeen(
    channelId: string,
    ts: string,
    author: string,
    ruleId: string | null,
  ): void {
    this.db
      .query(
        "INSERT OR IGNORE INTO seen (channel_id,ts,author,rule_id,seen_at) VALUES (?,?,?,?,?)",
      )
      .run(channelId, ts, author, ruleId, Date.now());
  }

  // -- budget ----------------------------------------------------------------
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  spentToday(): number {
    const r = this.db
      .query<{ usd: number }, [string]>("SELECT usd FROM spend WHERE day=?")
      .get(this.today());
    return r?.usd ?? 0;
  }

  /** Reserve in one statement. A read-then-spend check lets two ticks both pass. */
  reserve(amount: number, dailyCap: number): boolean {
    const day = this.today();
    this.db
      .query("INSERT OR IGNORE INTO spend (day,usd) VALUES (?,0)")
      .run(day);
    const res = this.db
      .query("UPDATE spend SET usd = usd + ? WHERE day = ? AND usd + ? <= ?")
      .run(amount, day, amount, dailyCap);
    return res.changes === 1;
  }

  /** Settle a reservation down (or up) to what the child actually reported. */
  settle(reserved: number, actual: number): void {
    this.db
      .query("UPDATE spend SET usd = MAX(0, usd - ? + ?) WHERE day = ?")
      .run(reserved, actual, this.today());
  }

  /**
   * Record spend that was NOT reserved in advance: the polling reads and reactions.
   *
   * These were previously summed for display and then dropped on the floor, so
   * `budget.daily_usd` governed worker tasks only and idle polling was entirely uncapped. That
   * is the larger number: an idle tick costs roughly $0.02 because the Slack read goes through
   * a model, so at a 60s interval polling alone runs to about $33/day against a $20 cap that
   * never saw it. Unlike `reserve`, this cannot refuse -- the money is already spent -- so it
   * records unconditionally and the caller checks the cap BEFORE the next poll.
   */
  addSpend(usd: number): void {
    if (!(usd > 0)) return;
    const day = this.today();
    this.db
      .query("INSERT OR IGNORE INTO spend (day,usd) VALUES (?,0)")
      .run(day);
    this.db.query("UPDATE spend SET usd = usd + ? WHERE day = ?").run(usd, day);
  }

  // -- tasks -----------------------------------------------------------------
  createTask(
    id: string,
    channelId: string,
    sourceTs: string,
    threadTs: string,
    sessionId: string,
    agentId = "",
  ): boolean {
    try {
      this.db
        .query(
          "INSERT INTO task (id,channel_id,source_ts,agent_id,thread_ts,session_id,turns,state,started_at,last_at) " +
            "VALUES (?,?,?,?,?,?,1,'running',?,?)",
        )
        .run(
          id,
          channelId,
          sourceTs,
          agentId,
          threadTs,
          sessionId,
          Date.now(),
          Date.now(),
        );
      return true;
    } catch {
      return false; // UNIQUE(channel_id, source_ts): already handled
    }
  }

  /** The task that owns a thread, so a follow-up resumes its session instead of starting fresh. */
  findTaskByThread(
    channelId: string,
    threadTs: string,
  ): {
    id: string;
    sessionId: string | null;
    turns: number;
    agentId: string;
  } | null {
    const r = this.db
      .query<
        {
          id: string;
          session_id: string | null;
          turns: number;
          agent_id: string;
        },
        [string, string]
      >(
        "SELECT id, session_id, turns, agent_id FROM task WHERE channel_id=? AND thread_ts=? ORDER BY started_at DESC LIMIT 1",
      )
      .get(channelId, threadTs);
    return r
      ? {
          id: r.id,
          sessionId: r.session_id,
          turns: r.turns,
          agentId: r.agent_id,
        }
      : null;
  }

  /** Threads worth polling: recent, so an old conversation stops costing reads forever. */
  activeThreads(
    channelId: string,
    sinceMs: number,
  ): Array<{ id: string; threadTs: string }> {
    return this.db
      .query<{ id: string; thread_ts: string }, [string, number]>(
        "SELECT id, thread_ts FROM task WHERE channel_id=? AND thread_ts IS NOT NULL AND last_at >= ? " +
          "ORDER BY last_at DESC LIMIT 5",
      )
      .all(channelId, sinceMs)
      .map((r) => ({ id: r.id, threadTs: r.thread_ts }));
  }

  /** Record the session id the child actually used, so the next follow-up can resume it. */
  /**
   * Look a task up by the handle printed in its Slack message footer.
   *
   * That handle was decorative until now: it was rendered on every reply but nothing could
   * resolve it, so continuity was available only by staying inside the thread. This is what
   * makes `#<handle>` recall -- and the CLI handoff -- possible.
   */
  findTaskById(id: string): {
    id: string;
    agentId: string;
    sessionId: string;
    threadTs: string;
  } | null {
    const r = this.db
      .query<
        { id: string; agent_id: string; session_id: string; thread_ts: string },
        [string]
      >("SELECT id, agent_id, session_id, thread_ts FROM task WHERE id = ?")
      .get(id);
    if (!r) return null;
    return {
      id: r.id,
      agentId: r.agent_id ?? "",
      sessionId: r.session_id ?? "",
      threadTs: r.thread_ts ?? "",
    };
  }

  setTaskSession(id: string, sessionId: string): void {
    this.db
      .query(
        "UPDATE task SET session_id=? WHERE id=? AND (session_id IS NULL OR session_id='')",
      )
      .run(sessionId, id);
  }

  /**
   * Stop polling a thread. Called when Slack says `thread_not_found`, which is permanent:
   * without this, every tick pays for a read of a thread that will never exist again.
   */
  retireThread(id: string): void {
    this.db.query("UPDATE task SET thread_ts=NULL WHERE id=?").run(id);
  }

  bumpTurn(id: string, costUsd: number): void {
    this.db
      .query(
        "UPDATE task SET turns = turns + 1, cost_usd = cost_usd + ?, last_at = ? WHERE id = ?",
      )
      .run(costUsd, Date.now(), id);
  }

  finishTask(id: string, state: string, costUsd: number, error?: string): void {
    this.db
      .query(
        "UPDATE task SET state=?, cost_usd=?, ended_at=?, error=? WHERE id=?",
      )
      .run(state, costUsd, Date.now(), error ?? null, id);
  }

  // -- events ----------------------------------------------------------------
  logEvent(e: {
    tickId: string;
    kind: string;
    channelId?: string;
    msgTs?: string;
    ruleId?: string;
    detail?: string;
  }): void {
    this.db
      .query(
        "INSERT INTO event (ts,tick_id,channel_id,msg_ts,kind,rule_id,detail) VALUES (?,?,?,?,?,?,?)",
      )
      .run(
        Date.now(),
        e.tickId,
        e.channelId ?? null,
        e.msgTs ?? null,
        e.kind,
        e.ruleId ?? null,
        e.detail ? e.detail.slice(0, 2048) : null,
      );
  }

  explain(channelId: string, msgTs: string): Array<Record<string, unknown>> {
    return this.db
      .query(
        "SELECT ts,kind,rule_id,detail FROM event WHERE channel_id=? AND msg_ts=? ORDER BY id",
      )
      .all(channelId, msgTs) as Array<Record<string, unknown>>;
  }

  recentTasks(limit = 25): Array<Record<string, unknown>> {
    return this.db
      .query(
        "SELECT id, agent_id, state, turns, cost_usd, source_ts, started_at FROM task " +
          "ORDER BY started_at DESC LIMIT ?",
      )
      .all(limit) as Array<Record<string, unknown>>;
  }

  recentEvents(limit = 60): Array<Record<string, unknown>> {
    return this.db
      .query(
        "SELECT ts, kind, rule_id, detail FROM event ORDER BY id DESC LIMIT ?",
      )
      .all(limit) as Array<Record<string, unknown>>;
  }

  lastTickAt(): number | null {
    const r = this.db
      .query<{ ts: number }, []>("SELECT MAX(ts) ts FROM event")
      .get();
    return r?.ts ?? null;
  }

  stats(): {
    tasks: number;
    outbox: number;
    spentToday: number;
    watermarks: number;
  } {
    const one = (q: string) =>
      this.db.query<{ n: number }, []>(q).get()?.n ?? 0;
    return {
      tasks: one("SELECT COUNT(*) n FROM task"),
      outbox: one("SELECT COUNT(*) n FROM outbox"),
      spentToday: this.spentToday(),
      watermarks: one("SELECT COUNT(*) n FROM watermark"),
    };
  }

  close(): void {
    this.db.close();
  }
}

/**
 * The config snapshot the daemon reads, deliberately OUTSIDE any TCC-protected folder.
 *
 * Lives here rather than in `crewd.ts` because that file is an ENTRYPOINT: it ends in
 * `process.exit(await main())`, so importing it to borrow a path helper would run a tick as a
 * side effect of loading the CLI.
 */
export function snapshotPath(): string {
  return join(expandHome("~/.jstack/crew"), "config.snapshot.json");
}
