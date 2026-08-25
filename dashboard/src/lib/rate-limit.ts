type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

/**
 * `buckets` is keyed partly by a client-supplied header (see auth-request.ts's
 * getRateLimitIdentity, which falls back to raw x-forwarded-for), and nothing ever deleted a
 * stale entry -- so a client that varies that header per request grows this process-lifetime
 * Map forever, an unbounded-memory DoS independent of whether the header can be trusted. Sweep
 * expired entries every SWEEP_INTERVAL_CALLS calls rather than on every call, so the amortized
 * per-request cost stays O(1).
 */
const SWEEP_INTERVAL_CALLS = 1000;
let callsSinceSweep = 0;

function sweepExpired(now: number, windowMs: number): void {
  for (const [k, b] of buckets) {
    if (now - b.windowStart >= windowMs) {
      buckets.delete(k);
    }
  }
}

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  callsSinceSweep += 1;
  if (callsSinceSweep >= SWEEP_INTERVAL_CALLS) {
    callsSinceSweep = 0;
    sweepExpired(now, windowMs);
  }
  const b = buckets.get(key);
  if (b === undefined) {
    buckets.set(key, { count: 1, windowStart: now });
    return { ok: true };
  }
  if (now - b.windowStart >= windowMs) {
    b.count = 1;
    b.windowStart = now;
    return { ok: true };
  }
  if (b.count >= max) {
    return { ok: false, retryAfterMs: windowMs - (now - b.windowStart) };
  }
  b.count += 1;
  return { ok: true };
}

/** Test-only: current tracked-bucket count, to verify the sweep actually bounds memory. */
export function __rateLimitBucketCountForTesting(): number {
  return buckets.size;
}

/** Test-only: clear all state so tests don't leak into each other via this module-level Map. */
export function __resetRateLimitForTesting(): void {
  buckets.clear();
  callsSinceSweep = 0;
}
