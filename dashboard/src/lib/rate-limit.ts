type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
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
