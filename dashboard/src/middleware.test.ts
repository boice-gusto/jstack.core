import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * The rate-limit bucket map and the cached env are both module-scoped, so each test needs a
 * fresh middleware module instance (vi.resetModules) or one test's requests would count against
 * the next test's limit.
 */
async function freshMiddleware() {
  vi.resetModules();
  const mod = await import("./middleware.js");
  return mod.middleware;
}

beforeEach(() => {
  vi.stubEnv("DASHBOARD_API_KEY", "test-key");
  vi.stubEnv("DASHBOARD_RATE_LIMIT_MAX", "1");
  vi.stubEnv("DASHBOARD_RATE_LIMIT_WINDOW_MS", "60000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function req(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3333"));
}

describe("middleware — login rate limiting", () => {
  it("rate-limits /api/auth/login instead of exempting it as a public path", async () => {
    const middleware = await freshMiddleware();

    const first = await middleware(req("/api/auth/login"));
    expect(first.status).not.toBe(429);

    const second = await middleware(req("/api/auth/login"));
    expect(second.status).toBe(429);
  });

  it("rate-limits /api/auth/logout the same way", async () => {
    const middleware = await freshMiddleware();

    await middleware(req("/api/auth/logout"));
    const second = await middleware(req("/api/auth/logout"));
    expect(second.status).toBe(429);
  });

  it("still lets login through without requiring auth (only rate limit applies)", async () => {
    const middleware = await freshMiddleware();

    const res = await middleware(req("/api/auth/login"));
    // Not the 401 an authenticated-only route would give; the request is allowed to proceed
    // to the login route handler (which does its own credential check).
    expect(res.status).not.toBe(401);
  });

  it("still requires auth on a real API route (unaffected by the login fix)", async () => {
    const middleware = await freshMiddleware();

    const res = await middleware(req("/api/workspace"));
    expect(res.status).toBe(401);
  });

  it("does not rate-limit static assets", async () => {
    const middleware = await freshMiddleware();

    for (let i = 0; i < 5; i++) {
      const res = await middleware(req("/favicon.ico"));
      expect(res.status).not.toBe(429);
    }
  });
});
