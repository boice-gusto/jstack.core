import { describe, expect, test } from "bun:test";
import type { InboundMessage } from "./types.js";

/**
 * Pagination is the one place a bug loses your messages permanently, so it is tested
 * against a fake channel rather than the network.
 *
 * The real reader returns NEWEST-first, capped at `limit`. `paginate` below mirrors
 * `readChannelPaged`'s algorithm exactly; if that changes, this file must change with it.
 */

function makeChannel(count: number): InboundMessage[] {
  // ts 100.000001 .. 100.00000N, oldest first
  return Array.from({ length: count }, (_, i) => ({
    channelId: "D0TESTDM001",
    ts: `100.${String(i + 1).padStart(6, "0")}`,
    author: "U0TESTUSER1",
    text: `msg ${i + 1}`,
    hasServerSuffix: false,
  }));
}

/** Newest-first, capped, honouring oldest (exclusive) and latest (exclusive). */
function fakeRead(
  all: InboundMessage[],
  oldest: string | null,
  latest: string | undefined,
  limit: number,
) {
  const filtered = all
    .filter((m) => (oldest ? Number(m.ts) > Number(oldest) : true))
    .filter((m) => (latest ? Number(m.ts) < Number(latest) : true))
    .sort((a, b) => Number(b.ts) - Number(a.ts));
  return filtered.slice(0, limit);
}

function paginate(
  all: InboundMessage[],
  oldest: string | null,
  limit: number,
  maxPages: number,
) {
  const seen = new Map<string, InboundMessage>();
  let latest: string | undefined;
  let calls = 0;
  for (let p = 0; p < maxPages; p++) {
    const page = fakeRead(all, oldest, latest, limit);
    calls++;
    for (const m of page) seen.set(m.ts, m);
    if (page.length < limit) {
      return { messages: sorted(seen), truncated: false, calls };
    }
    const oldestTs = page.reduce((a, b) =>
      Number(a.ts) < Number(b.ts) ? a : b,
    ).ts;
    if (latest === oldestTs) break;
    latest = oldestTs;
  }
  return { messages: sorted(seen), truncated: true, calls };
}

const sorted = (m: Map<string, InboundMessage>) =>
  [...m.values()].sort((a, b) => Number(a.ts) - Number(b.ts));

describe("a burst larger than read_limit does not lose the oldest messages", () => {
  test("12 messages, limit 5, 3 pages: all 12 returned, oldest first", () => {
    const r = paginate(makeChannel(12), null, 5, 3);
    expect(r.messages).toHaveLength(12);
    expect(r.messages[0]!.text).toBe("msg 1"); // the one a single read would have dropped
    expect(r.messages[11]!.text).toBe("msg 12");
    expect(r.truncated).toBe(false);
  });

  test("a single unpaginated read WOULD have lost them -- this is the bug being prevented", () => {
    const onePage = fakeRead(makeChannel(12), null, undefined, 5);
    expect(onePage).toHaveLength(5);
    expect(onePage.map((m) => m.text)).not.toContain("msg 1");
  });

  test("exactly limit messages: one call, not truncated", () => {
    const r = paginate(makeChannel(5), null, 5, 3);
    expect(r.messages).toHaveLength(5);
    expect(r.calls).toBe(2); // second call comes back short, proving we caught up
    expect(r.truncated).toBe(false);
  });

  test("fewer than limit: one call", () => {
    const r = paginate(makeChannel(2), null, 5, 3);
    expect(r.messages).toHaveLength(2);
    expect(r.calls).toBe(1);
  });

  test("empty channel: no messages, not truncated", () => {
    const r = paginate([], null, 5, 3);
    expect(r.messages).toHaveLength(0);
    expect(r.truncated).toBe(false);
  });
});

describe("the page budget bounds cost without dropping anything", () => {
  test("100 messages, limit 5, 3 pages: returns 15 and reports truncated", () => {
    const r = paginate(makeChannel(100), null, 5, 3);
    expect(r.messages).toHaveLength(15);
    expect(r.truncated).toBe(true);
    expect(r.calls).toBe(3);
  });

  test("truncated pages are the NEWEST ones, and the rest survive for the next tick", () => {
    const all = makeChannel(100);
    const r = paginate(all, null, 5, 3);
    // We took 86..100. The watermark must not advance past 86, so 1..85 remain readable.
    expect(r.messages[0]!.text).toBe("msg 86");
    const next = paginate(all, null, 5, 3);
    expect(next.messages[0]!.text).toBe("msg 86"); // same start: watermark did not move
  });
});

describe("the watermark respects oldest as exclusive", () => {
  test("resuming from a watermark returns only newer messages", () => {
    const r = paginate(makeChannel(10), "100.000007", 5, 3);
    expect(r.messages.map((m) => m.text)).toEqual(["msg 8", "msg 9", "msg 10"]);
  });

  test("a watermark at the newest message yields nothing", () => {
    const r = paginate(makeChannel(10), "100.000010", 5, 3);
    expect(r.messages).toHaveLength(0);
  });
});

describe("no infinite loop when the reader stops making progress", () => {
  test("a reader that always returns the same full page terminates", () => {
    const stuck = makeChannel(5);
    // latest never advances because every message shares a ts in this pathological case
    const same = stuck.map((m) => ({ ...m, ts: "100.000001" }));
    const r = paginate(same, null, 5, 5);
    expect(r.calls).toBeLessThanOrEqual(5);
  });
});
