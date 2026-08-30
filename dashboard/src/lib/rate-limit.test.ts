import { beforeEach, describe, expect, it } from "vitest";

import {
  __rateLimitBucketCountForTesting,
  __rateLimitMaxBucketsForTesting,
  __resetRateLimitForTesting,
  checkRateLimit,
} from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitForTesting();
  });

  it("allows up to max requests per window, then blocks", () => {
    expect(checkRateLimit("a", 2, 10_000)).toEqual({ ok: true });
    expect(checkRateLimit("a", 2, 10_000)).toEqual({ ok: true });
    const third = checkRateLimit("a", 2, 10_000);
    expect(third.ok).toBe(false);
  });

  it("resets the window once windowMs has elapsed", async () => {
    checkRateLimit("b", 1, 5);
    expect(checkRateLimit("b", 1, 5).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    expect(checkRateLimit("b", 1, 5).ok).toBe(true);
  });

  it("sweeps expired buckets instead of growing the map forever", async () => {
    const SWEEP_INTERVAL_CALLS = 1000;
    for (let i = 0; i < SWEEP_INTERVAL_CALLS - 1; i++) {
      checkRateLimit(`client-${i}`, 5, 10);
    }
    expect(__rateLimitBucketCountForTesting()).toBe(SWEEP_INTERVAL_CALLS - 1);

    await new Promise((r) => setTimeout(r, 20));

    // The SWEEP_INTERVAL_CALLS-th call triggers the sweep: every bucket whose window has
    // already elapsed gets deleted, so the map doesn't grow unbounded with distinct clients.
    checkRateLimit("trigger-sweep", 5, 10);
    expect(__rateLimitBucketCountForTesting()).toBe(1);
  });

  it("sweep is selective: a just-inserted bucket survives alongside already-expired ones", async () => {
    // sweepExpired takes a single windowMs (the triggering call's), applied uniformly to every
    // bucket -- production always calls checkRateLimit with one shared, env-configured windowMs,
    // never a per-call-varying one, so this test does the same rather than exercising a
    // combination the real code never produces.
    const SWEEP_INTERVAL_CALLS = 1000;
    for (let i = 0; i < SWEEP_INTERVAL_CALLS - 2; i++) {
      checkRateLimit(`expiring-${i}`, 5, 10);
    }

    await new Promise((r) => setTimeout(r, 20));

    // Inserted right before the sweep-triggering call, with no sleep in between: fresh relative
    // to windowMs=10 at sweep time, unlike the 998 buckets above that are now 20ms+ old.
    checkRateLimit("still-fresh", 5, 10);
    checkRateLimit("trigger-sweep", 5, 10);
    // Only "still-fresh" and "trigger-sweep" (both just inserted) should remain -- not a
    // blanket wipe of everything, and not a wipe of everything except the trigger call itself.
    expect(__rateLimitBucketCountForTesting()).toBe(2);
    expect(checkRateLimit("still-fresh", 1, 10).ok).toBe(false);
  });

  it("caps memory during an in-window flood: a hard bucket-count ceiling bounds worst-case growth", () => {
    const MAX = __rateLimitMaxBucketsForTesting();
    // Simulate a flood of distinct spoofed identities, all within one window (windowMs huge
    // enough that none of them naturally expire or get swept during this test).
    for (let i = 0; i < MAX + 500; i++) {
      checkRateLimit(`flood-${i}`, 5, 10_000_000);
    }
    // Without a cap, this would be MAX + 500 live buckets. With it, growth stops at MAX.
    expect(__rateLimitBucketCountForTesting()).toBe(MAX);
  });
});
