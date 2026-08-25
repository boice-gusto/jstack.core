import { beforeEach, describe, expect, it } from "vitest";

import {
  __rateLimitBucketCountForTesting,
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
});
