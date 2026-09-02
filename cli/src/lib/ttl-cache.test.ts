import { afterEach, describe, expect, test } from "bun:test";
import { TtlCache, ttlMsFromEnv } from "./ttl-cache.js";

describe("TtlCache", () => {
  test("computes once and returns the cached value within the TTL window", () => {
    let calls = 0;
    const cache = new TtlCache(() => {
      calls++;
      return "value";
    }, 1000);

    expect(cache.get(0)).toBe("value");
    expect(cache.get(500)).toBe("value");
    expect(cache.get(999)).toBe("value");
    expect(calls).toBe(1);
  });

  test("recomputes once the TTL has elapsed", () => {
    let calls = 0;
    const cache = new TtlCache(() => {
      calls++;
      return calls;
    }, 1000);

    expect(cache.get(0)).toBe(1);
    expect(cache.get(1000)).toBe(2); // >= ttlMs counts as expired
    expect(cache.get(1999)).toBe(2);
    expect(cache.get(2000)).toBe(3);
    expect(calls).toBe(3);
  });

  test("invalidate() forces a recompute on the next get(), even inside the TTL window", () => {
    let calls = 0;
    const cache = new TtlCache(() => {
      calls++;
      return calls;
    }, 1000);

    expect(cache.get(0)).toBe(1);
    cache.invalidate();
    expect(cache.get(10)).toBe(2);
    expect(calls).toBe(2);
  });

  test("a computed value of undefined is not distinguishable from 'never computed' -- recomputes every call", () => {
    // Documented edge case, not a bug fix: TtlCache is meant for cacheable data (arrays, objects,
    // strings), which is never actually undefined. A compute() that legitimately returns
    // undefined defeats the "already have a value" check, so it just never caches -- correctness
    // is preserved (never returns a stale wrong value), only the IO-saving benefit is lost.
    let calls = 0;
    const cache = new TtlCache<string | undefined>(() => {
      calls++;
      return undefined;
    }, 1000);
    cache.get(0);
    cache.get(1);
    expect(calls).toBe(2);
  });
});

describe("ttlMsFromEnv", () => {
  const ENV_VAR = "JSTACK_TEST_TTL_MINUTES";
  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  test("defaults when the env var is unset", () => {
    expect(ttlMsFromEnv(ENV_VAR, 5)).toBe(5 * 60_000);
  });

  test("uses the env var when it's a positive number", () => {
    process.env[ENV_VAR] = "10";
    expect(ttlMsFromEnv(ENV_VAR, 5)).toBe(10 * 60_000);
  });

  test("falls back to the default when the env var is non-numeric", () => {
    process.env[ENV_VAR] = "not-a-number";
    expect(ttlMsFromEnv(ENV_VAR, 5)).toBe(5 * 60_000);
  });

  test("falls back to the default when the env var is zero or negative", () => {
    process.env[ENV_VAR] = "0";
    expect(ttlMsFromEnv(ENV_VAR, 5)).toBe(5 * 60_000);
    process.env[ENV_VAR] = "-1";
    expect(ttlMsFromEnv(ENV_VAR, 5)).toBe(5 * 60_000);
  });
});
