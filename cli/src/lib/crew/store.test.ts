import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrewStore, deriveTaskDisplayStatus } from "./store.js";

function freshStore(): CrewStore {
  return new CrewStore(mkdtempSync(join(tmpdir(), "crew-test-")));
}

describe("outbox is G1's authority", () => {
  test("records and recalls a post", () => {
    const s = freshStore();
    expect(s.outboxHas("D1ABCDEFG", "1.1")).toBe(false);
    s.recordOutbox({
      channelId: "D1ABCDEFG",
      ts: "1.1",
      taskId: "t1",
      step: "ack",
    });
    expect(s.outboxHas("D1ABCDEFG", "1.1")).toBe(true);
    s.close();
  });

  test("double-record is idempotent, so a crash-retry cannot corrupt it", () => {
    const s = freshStore();
    s.recordOutbox({
      channelId: "D1ABCDEFG",
      ts: "1.1",
      taskId: "t1",
      step: "ack",
    });
    s.recordOutbox({
      channelId: "D1ABCDEFG",
      ts: "1.1",
      taskId: "t1",
      step: "ack",
    });
    expect(s.stats().outbox).toBe(1);
    s.close();
  });
});

describe("watermark only advances", () => {
  test("moves forward", () => {
    const s = freshStore();
    s.setWatermark("D1ABCDEFG", "100.0");
    expect(s.getWatermark("D1ABCDEFG")).toBe("100.0");
    s.setWatermark("D1ABCDEFG", "200.0");
    expect(s.getWatermark("D1ABCDEFG")).toBe("200.0");
    s.close();
  });

  test("never goes backwards -- a stale page must not replay history", () => {
    const s = freshStore();
    s.setWatermark("D1ABCDEFG", "200.0");
    s.setWatermark("D1ABCDEFG", "100.0");
    expect(s.getWatermark("D1ABCDEFG")).toBe("200.0");
    s.close();
  });
});

describe("budget reserves atomically", () => {
  test("two concurrent dispatches at the cap yield exactly one reservation", () => {
    const s = freshStore();
    expect(s.reserve(1.0, 1.5)).toBe(true); // 1.0 <= 1.5
    expect(s.reserve(1.0, 1.5)).toBe(false); // 2.0 > 1.5, refused
    expect(s.spentToday()).toBe(1.0);
    s.close();
  });

  test("hard stop actually stops -- a read-then-spend check would have allowed both", () => {
    const s = freshStore();
    let granted = 0;
    for (let i = 0; i < 50; i++) if (s.reserve(1.0, 20)) granted++;
    expect(granted).toBe(20);
    expect(s.spentToday()).toBe(20);
    s.close();
  });

  test("settle releases the unused part of a reservation", () => {
    const s = freshStore();
    s.reserve(1.0, 20);
    s.settle(1.0, 0.12); // reserved a dollar, actually spent 12c
    expect(s.spentToday()).toBeCloseTo(0.12, 5);
    s.close();
  });

  test("a crashed worker's reservation can be released, not leaked until midnight", () => {
    const s = freshStore();
    s.reserve(1.0, 20);
    s.settle(1.0, 0); // crash: no cost reported
    expect(s.spentToday()).toBe(0);
    s.close();
  });
});

describe("tasks are idempotent per source message", () => {
  test("a redelivered event cannot spawn a second run", () => {
    const s = freshStore();
    expect(s.createTask("t1", "D1ABCDEFG", "1.1", "1.1", "sess-1")).toBe(true);
    expect(s.createTask("t2", "D1ABCDEFG", "1.1", "1.1", "sess-2")).toBe(false);
    s.close();
  });
});

describe("explain answers 'why did Ralph not respond'", () => {
  test("returns the decision trace for one message", () => {
    const s = freshStore();
    s.logEvent({
      tickId: "k1",
      kind: "read",
      channelId: "D1ABCDEFG",
      msgTs: "1.1",
    });
    s.logEvent({
      tickId: "k1",
      kind: "drop",
      channelId: "D1ABCDEFG",
      msgTs: "1.1",
      ruleId: "G3_no_sigil",
    });
    const rows = s.explain("D1ABCDEFG", "1.1");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.rule_id).toBe("G3_no_sigil");
    s.close();
  });
});

describe("durability", () => {
  test("state survives reopening the database", () => {
    const dir = mkdtempSync(join(tmpdir(), "crew-persist-"));
    const a = new CrewStore(dir);
    a.recordOutbox({
      channelId: "D1ABCDEFG",
      ts: "9.9",
      taskId: "t",
      step: "result",
    });
    a.setWatermark("D1ABCDEFG", "9.9");
    a.close();

    const b = new CrewStore(dir);
    expect(b.outboxHas("D1ABCDEFG", "9.9")).toBe(true);
    expect(b.getWatermark("D1ABCDEFG")).toBe("9.9");
    b.close();
  });
});

describe("thread memory", () => {
  test("a follow-up finds the task that owns the thread, with its session id", () => {
    const s = freshStore();
    s.createTask("t1", "D1ABCDEFG", "100.0", "100.0", "sess-abc");
    const found = s.findTaskByThread("D1ABCDEFG", "100.0");
    expect(found?.id).toBe("t1");
    expect(found?.sessionId).toBe("sess-abc"); // this is what --resume needs
    expect(found?.turns).toBe(1);
    s.close();
  });

  test("turns increment, so max_messages_per_task can bound a runaway conversation", () => {
    const s = freshStore();
    s.createTask("t1", "D1ABCDEFG", "100.0", "100.0", "sess");
    s.bumpTurn("t1", 0.02);
    s.bumpTurn("t1", 0.02);
    expect(s.findTaskByThread("D1ABCDEFG", "100.0")?.turns).toBe(3);
    s.close();
  });

  test("only recently active threads are polled, so old ones stop costing reads", () => {
    const s = freshStore();
    s.createTask("t1", "D1ABCDEFG", "100.0", "100.0", "sess");
    expect(s.activeThreads("D1ABCDEFG", Date.now() - 60_000)).toHaveLength(1);
    expect(s.activeThreads("D1ABCDEFG", Date.now() + 60_000)).toHaveLength(0);
    s.close();
  });

  test("thread watermarks are independent of the channel watermark", () => {
    const s = freshStore();
    s.setWatermark("D1ABCDEFG", "500.0");
    s.setThreadWatermark("D1ABCDEFG", "100.0", "120.0");
    expect(s.getWatermark("D1ABCDEFG")).toBe("500.0");
    expect(s.getThreadWatermark("D1ABCDEFG", "100.0")).toBe("120.0");
    s.close();
  });
});

describe("polling spend is recorded, not just displayed", () => {
  /**
   * The gap this closes: `reserve`/`settle` wrapped worker tasks only, so read cost was summed
   * for the log line and then dropped. `budget.daily_usd` therefore governed the SMALLER half
   * of the bill. An idle tick costs ~$0.02 because the Slack read goes through a model, so at a
   * 60s interval polling alone runs to about $33/day against a $20 cap that never saw it.
   */
  test("addSpend accumulates and is visible to spentToday", () => {
    const s = freshStore();
    expect(s.spentToday()).toBe(0);
    s.addSpend(0.023);
    s.addSpend(0.023);
    expect(s.spentToday()).toBeCloseTo(0.046, 6);
    s.close();
  });

  test("it ignores zero and negative amounts rather than corrupting the day's total", () => {
    const s = freshStore();
    s.addSpend(0);
    s.addSpend(-5);
    s.addSpend(Number.NaN);
    expect(s.spentToday()).toBe(0);
    s.close();
  });

  test("recorded poll spend counts against the same cap a task reserves from", () => {
    // The two paths must share one budget, or the cap is per-path and means nothing.
    const s = freshStore();
    s.addSpend(9.5);
    // 9.5 already spent on polling leaves no room for a $1 task under a $10 cap.
    expect(s.reserve(1, 10)).toBe(false);
    // Under a larger cap the same reservation succeeds, so it is the budget doing the work
    // rather than the reservation simply always failing after addSpend.
    expect(s.reserve(1, 20)).toBe(true);
    s.close();
  });
});

describe("findTaskById makes the printed handle resolvable", () => {
  test("a recorded task is found, with its agent and session", () => {
    const s = freshStore();
    s.createTask(
      "ral-aaaa",
      "D0TESTDM001",
      "1785141296.398489",
      "1785141296.398489",
      "sess-uuid-1",
      "ralph",
    );
    const t = s.findTaskById("ral-aaaa");
    expect(t).not.toBeNull();
    expect(t!.agentId).toBe("ralph");
    expect(t!.sessionId).toBe("sess-uuid-1");
    s.close();
  });

  test("an unknown handle returns null rather than throwing", () => {
    const s = freshStore();
    expect(s.findTaskById("ral-zzzz")).toBeNull();
    s.close();
  });

  test("it reports the owning agent, which is what blocks cross-agent recall", () => {
    const s = freshStore();
    s.createTask(
      "sco-bbbb",
      "D0TESTDM001",
      "1785141297.000000",
      "1785141297.000000",
      "sess-uuid-2",
      "scout",
    );
    expect(s.findTaskById("sco-bbbb")!.agentId).toBe("scout");
    s.close();
  });
});

/**
 * `task.state` is written 'running' by `createTask` and only ever moved to a terminal value by
 * `finishTask` -- `bumpTurn` (the follow-up path) never touches it. A task that receives a
 * follow-up and then goes idle would report "running" forever from the raw column alone.
 * `recentTasks()`/`deriveTaskDisplayStatus` derive an honest display status instead.
 */
describe("deriveTaskDisplayStatus", () => {
  test("a finished task's real state passes through, regardless of timing", () => {
    const now = 1_000_000;
    expect(
      deriveTaskDisplayStatus(
        { state: "done", ended_at: now - 999_999, last_at: 0 },
        now,
        100,
      ),
    ).toBe("done");
    expect(
      deriveTaskDisplayStatus(
        { state: "failed", ended_at: now, last_at: now },
        now,
        100,
      ),
    ).toBe("failed");
  });

  test("an unfinished task touched within threadActiveMs reports 'running'", () => {
    const now = 1_000_000;
    expect(
      deriveTaskDisplayStatus(
        { state: "running", ended_at: null, last_at: now - 50 },
        now,
        100,
      ),
    ).toBe("running");
  });

  test("an unfinished task touched longer ago than threadActiveMs reports 'idle', not the stale raw state", () => {
    const now = 1_000_000;
    expect(
      deriveTaskDisplayStatus(
        { state: "running", ended_at: null, last_at: now - 200 },
        now,
        100,
      ),
    ).toBe("idle");
  });

  test("a row with no last_at at all is treated as idle rather than throwing", () => {
    const now = 1_000_000;
    expect(
      deriveTaskDisplayStatus(
        { state: "running", ended_at: null, last_at: null },
        now,
        100,
      ),
    ).toBe("idle");
  });
});

describe("recentTasks — SQL row shape carries what deriveTaskDisplayStatus needs", () => {
  test("a task that only ever got bumpTurn (no finishTask) shows raw state 'running' with a stale last_at", () => {
    const s = freshStore();
    s.createTask("t1", "D1ABCDEFG", "1.1", "1.1", "sess-1");
    s.bumpTurn("t1", 0.01); // follow-up turn; never finished
    const [row] = s.recentTasks() as Array<{
      state: string;
      ended_at: number | null;
      last_at: number;
    }>;
    expect(row!.state).toBe("running");
    expect(row!.ended_at).toBeNull();
    // Confirms the SQL now selects last_at/ended_at -- deriveTaskDisplayStatus needs both to
    // tell a genuinely-active task apart from one that's just never been marked finished.
    const farFuture = row!.last_at + 999_999_999;
    expect(deriveTaskDisplayStatus(row!, farFuture, 3_600_000)).toBe("idle");
    expect(deriveTaskDisplayStatus(row!, row!.last_at + 1, 3_600_000)).toBe(
      "running",
    );
    s.close();
  });

  test("a finished task's row reports its real terminal state via recentTasks regardless of last_at", () => {
    const s = freshStore();
    s.createTask("t2", "D1ABCDEFG", "2.2", "2.2", "sess-2");
    s.finishTask("t2", "done", 0.05);
    const [row] = s.recentTasks() as Array<{
      state: string;
      ended_at: number | null;
      last_at: number;
    }>;
    expect(row!.state).toBe("done");
    expect(row!.ended_at).not.toBeNull();
    expect(
      deriveTaskDisplayStatus(row!, row!.last_at + 999_999_999, 3_600_000),
    ).toBe("done");
    s.close();
  });
});
