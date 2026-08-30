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

describe("Codex backend defaults", () => {
  it("CODEX_BIN defaults to 'codex' and sandbox defaults to workspace-write", async () => {
    const getDashboardEnv = await freshGetDashboardEnv();
    const env = getDashboardEnv();
    expect(env.CODEX_BIN).toBe("codex");
    expect(env.DASHBOARD_AGENT_CODEX_SANDBOX).toBe("workspace-write");
  });

  it("rejects an invalid sandbox value", async () => {
    vi.stubEnv("DASHBOARD_AGENT_CODEX_SANDBOX", "not-a-real-mode");
    const getDashboardEnv = await freshGetDashboardEnv();
    expect(() => getDashboardEnv()).toThrow();
  });
});
