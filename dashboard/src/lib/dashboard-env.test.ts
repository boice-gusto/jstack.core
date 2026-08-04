import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * getDashboardEnv() caches its parse result at module scope, so each case needs a fresh module
 * instance (vi.resetModules) to see a different process.env.
 */
async function freshGetDashboardEnv() {
  vi.resetModules();
  const mod = await import("./dashboard-env.js");
  return mod.getDashboardEnv;
}

beforeEach(() => {
  vi.stubEnv("DASHBOARD_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DASHBOARD_ALLOW_INSECURE_COOKIES", () => {
  it("defaults to false when unset", async () => {
    const getDashboardEnv = await freshGetDashboardEnv();
    expect(getDashboardEnv().DASHBOARD_ALLOW_INSECURE_COOKIES).toBe(false);
  });

  it('the literal string "false" does not turn it on (the z.coerce.boolean() trap)', async () => {
    vi.stubEnv("DASHBOARD_ALLOW_INSECURE_COOKIES", "false");
    const getDashboardEnv = await freshGetDashboardEnv();
    expect(getDashboardEnv().DASHBOARD_ALLOW_INSECURE_COOKIES).toBe(false);
  });

  it('"true" turns it on', async () => {
    vi.stubEnv("DASHBOARD_ALLOW_INSECURE_COOKIES", "true");
    const getDashboardEnv = await freshGetDashboardEnv();
    expect(getDashboardEnv().DASHBOARD_ALLOW_INSECURE_COOKIES).toBe(true);
  });

  it('"1" turns it on', async () => {
    vi.stubEnv("DASHBOARD_ALLOW_INSECURE_COOKIES", "1");
    const getDashboardEnv = await freshGetDashboardEnv();
    expect(getDashboardEnv().DASHBOARD_ALLOW_INSECURE_COOKIES).toBe(true);
  });
});
