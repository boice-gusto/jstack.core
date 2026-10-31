/**
 * A small generic memoizer for expensive-but-static reads (skill-catalog walks today; any other
 * "re-read a tree of files on every call" spot could reuse it): caches `compute()`'s result for
 * `ttlMs`, then re-runs it on the next call after expiry.
 *
 * Deliberately NOT a decorator/proxy over the original function -- `TtlCache.get()` is explicit
 * about when a cached value might be returned, which matters for a caller like `skills/index`
 * that wants "is this fresh" to be visible in code, not hidden behind a normal-looking call.
 */
export class TtlCache<T> {
  private value: T | undefined;
  private computedAt = 0;

  constructor(
    private readonly compute: () => T,
    private readonly ttlMs: number,
  ) {}

  get(nowMs: number = Date.now()): T {
    if (this.value === undefined || nowMs - this.computedAt >= this.ttlMs) {
      this.value = this.compute();
      this.computedAt = nowMs;
    }
    return this.value;
  }

  /** Forces the next `get()` to recompute, regardless of TTL -- for a caller that knows the
   * underlying data just changed (e.g. a skill was just added) and shouldn't wait out the TTL. */
  invalidate(): void {
    this.value = undefined;
    this.computedAt = 0;
  }
}

/**
 * Reads an env-var TTL override in minutes, falling back to `defaultMinutes` when unset,
 * non-numeric, or non-positive.
 */
export function ttlMsFromEnv(envVar: string, defaultMinutes: number): number {
  const raw = process.env[envVar];
  const minutes = raw !== undefined ? Number(raw) : Number.NaN;
  const effectiveMinutes =
    Number.isFinite(minutes) && minutes > 0 ? minutes : defaultMinutes;
  return effectiveMinutes * 60_000;
}
