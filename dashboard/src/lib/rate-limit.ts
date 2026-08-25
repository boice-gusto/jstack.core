type Bucket = { count: number; windowStart: number };

// Single-process, in-memory limiter: assumes one dashboard instance. If this ever runs as
// multiple replicas behind a load balancer, each instance tracks independent state -- a client
// spread across N instances effectively gets N times the limit. Would need a shared store
// (e.g. Redis) to be correct under horizontal scaling; not needed today, so not built.
const buckets = new Map<string, Bucket>();

/**
 * `buckets` is keyed partly by a client-supplied header (see auth-request.ts's
 * getRateLimitIdentity, which falls back to raw x-forwarded-for), and nothing ever deleted a
 * stale entry -- so a client that varies that header per request grows this process-lifetime
 * Map forever, an unbounded-memory DoS independent of whether the header can be trusted. Sweep
 * expired entries every SWEEP_INTERVAL_CALLS calls rather than on every call, so the amortized
 * per-request cost stays O(1).
 *
 * The sweep alone only bounds IDLE growth: it deletes a bucket once its window has already
 * elapsed, so a flood of distinct identities arriving FASTER than windowMs still grows the map
 * unbounded for the duration of the flood (the sweep can't catch up until entries actually
 * expire). MAX_BUCKETS is the actual DoS bound: once the map is full, a new identity evicts the
 * single oldest entry (by insertion order) before being added, capping worst-case memory
 * regardless of flood rate.
 */
const SWEEP_INTERVAL_CALLS = 1000;
const MAX_BUCKETS = 50_000;
let callsSinceSweep = 0;

function sweepExpired(now: number, windowMs: number): void {
  for (const [k, b] of buckets) {
    if (now - b.windowStart >= windowMs) {
      buckets.delete(k);
    }
  }
}

function evictOldestIfAtCapacity(): void {
  if (buckets.size < MAX_BUCKETS) return;
  const oldestKey = buckets.keys().next().value;
  if (oldestKey !== undefined) buckets.delete(oldestKey);
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
    evictOldestIfAtCapacity();
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

/** Test-only: the hard cap, so a test doesn't have to hardcode (and drift from) the real value. */
export function __rateLimitMaxBucketsForTesting(): number {
  return MAX_BUCKETS;
}

/** Test-only: clear all state so tests don't leak into each other via this module-level Map. */
export function __resetRateLimitForTesting(): void {
  buckets.clear();
  callsSinceSweep = 0;
}
