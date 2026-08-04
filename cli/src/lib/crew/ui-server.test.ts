import { describe, expect, test } from "bun:test";
import {
  ACTIONS,
  BLOCKED_FROM_UI,
  guardRequest,
  mintToken,
  tokenMatches,
  validateParams,
} from "./ui-server.js";

/**
 * These are the tests that justify letting a browser page touch the crew at all.
 *
 * A local control plane that can mutate agents and trigger Slack posts is the shape of
 * OpenClaw's CVE-2026-25253 (one-click RCE via cross-site request forgery against a loopback
 * gateway). Each test below names the attack it blocks; if one of these regresses, the UI
 * should not ship.
 */

const PORT = 7391;
const TOKEN = "test-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function req(
  opts: {
    method?: string;
    host?: string | null;
    origin?: string | null;
    site?: string | null;
    token?: string | null;
    headerToken?: string | null;
    path?: string;
  } = {},
): Request {
  const h = new Headers();
  if (opts.host !== null) h.set("host", opts.host ?? `127.0.0.1:${PORT}`);
  if (opts.origin) h.set("origin", opts.origin);
  if (opts.site) h.set("sec-fetch-site", opts.site);
  if (opts.headerToken) h.set("x-crew-token", opts.headerToken);
  const q = opts.token ? `?t=${encodeURIComponent(opts.token)}` : "";
  return new Request(`http://127.0.0.1:${PORT}${opts.path ?? "/api"}${q}`, {
    method: opts.method ?? "GET",
    headers: h,
  });
}

const guard = (r: Request, mutating: boolean) =>
  guardRequest(r, { token: TOKEN, port: PORT, mutating });

describe("token", () => {
  test("mints something long and URL-safe", () => {
    const t = mintToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test("comparison rejects a wrong token of the same length, and of a different length", () => {
    expect(tokenMatches(TOKEN, TOKEN)).toBe(true);
    expect(tokenMatches(TOKEN, TOKEN.slice(0, -1) + "X")).toBe(false);
    expect(tokenMatches(TOKEN, "short")).toBe(false);
    expect(tokenMatches(TOKEN, null)).toBe(false);
  });
});

describe("reads require the token", () => {
  test("a valid token in the query passes", () => {
    expect(guard(req({ token: TOKEN }), false).ok).toBe(true);
  });

  test("no token is rejected -- knowing the port must not be enough", () => {
    const r = guard(req({}), false);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  test("a wrong token is rejected", () => {
    expect(guard(req({ token: "nope" }), false).ok).toBe(false);
  });
});

describe("CSRF: a cross-origin form POST cannot mutate", () => {
  // This is the attack that made the OpenClaw CVE one click.
  test("POST with the token only in the URL is rejected: mutations need the header", () => {
    const r = guard(req({ method: "POST", token: TOKEN }), true);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
  });

  test("POST with the header token passes", () => {
    expect(guard(req({ method: "POST", headerToken: TOKEN }), true).ok).toBe(
      true,
    );
  });

  test("GET cannot mutate even with a valid header token", () => {
    const r = guard(req({ method: "GET", headerToken: TOKEN }), true);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(405);
  });
});

describe("DNS rebinding: a hostile name resolving to 127.0.0.1 is rejected", () => {
  test("an unexpected Host is refused even with a good token", () => {
    const r = guard(
      req({ host: "evil.example.com", headerToken: TOKEN, method: "POST" }),
      true,
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.reason).toContain("Host");
  });

  test("a missing Host is refused", () => {
    expect(guard(req({ host: null, token: TOKEN }), false).ok).toBe(false);
  });

  test("localhost and 127.0.0.1 on the right port are both accepted", () => {
    expect(
      guard(req({ host: `localhost:${PORT}`, token: TOKEN }), false).ok,
    ).toBe(true);
    expect(
      guard(req({ host: `127.0.0.1:${PORT}`, token: TOKEN }), false).ok,
    ).toBe(true);
  });

  test("the right host on the WRONG port is refused", () => {
    expect(guard(req({ host: "127.0.0.1:9999", token: TOKEN }), false).ok).toBe(
      false,
    );
  });
});

describe("cross-site requests are refused by fetch metadata and Origin", () => {
  test("Sec-Fetch-Site: cross-site is refused", () => {
    const r = guard(
      req({ method: "POST", headerToken: TOKEN, site: "cross-site" }),
      true,
    );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  test("Sec-Fetch-Site: same-site is still refused -- only same-origin or none", () => {
    expect(
      guard(
        req({ method: "POST", headerToken: TOKEN, site: "same-site" }),
        true,
      ).ok,
    ).toBe(false);
  });

  test("same-origin passes", () => {
    expect(
      guard(
        req({ method: "POST", headerToken: TOKEN, site: "same-origin" }),
        true,
      ).ok,
    ).toBe(true);
  });

  test("a foreign Origin is refused", () => {
    const r = guard(
      req({
        method: "POST",
        headerToken: TOKEN,
        origin: "https://evil.example.com",
      }),
      true,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("Origin");
  });

  test("our own Origin passes", () => {
    expect(
      guard(
        req({
          method: "POST",
          headerToken: TOKEN,
          origin: `http://127.0.0.1:${PORT}`,
        }),
        true,
      ).ok,
    ).toBe(true);
  });
});

describe("the action allowlist is the boundary", () => {
  test("dangerous subcommands are not exposed at all", () => {
    const exposed = Object.values(ACTIONS).flatMap((a) =>
      a.argv({ id: "x", ts: "1.1", workspace: "/tmp", text: "x" }),
    );
    for (const blocked of BLOCKED_FROM_UI) {
      expect(exposed).not.toContain(blocked);
    }
  });

  test("go-live specifically is unreachable: starting to post as the operator stays a terminal act", () => {
    expect(Object.keys(ACTIONS)).not.toContain("goLive");
    expect(BLOCKED_FROM_UI).toContain("go-live");
  });

  test("every action builds an argv array, so nothing goes through a shell", () => {
    for (const [name, a] of Object.entries(ACTIONS)) {
      const argv = a.argv({
        id: "ralph",
        ts: "1785141296.398489",
        workspace: "/tmp/x",
        text: "hi",
        reason: "r",
      });
      expect(Array.isArray(argv), name).toBe(true);
      for (const part of argv) expect(typeof part).toBe("string");
    }
  });

  test("reads are marked non-mutating and writes mutating, so the guard picks the right rules", () => {
    expect(ACTIONS.status!.mutating).toBe(false);
    expect(ACTIONS.explain!.mutating).toBe(false);
    expect(ACTIONS.agentRemove!.mutating).toBe(true);
    expect(ACTIONS.panic!.mutating).toBe(true);
  });
});

describe("params are validated, so no user string reaches a command position unchecked", () => {
  test("a well-formed agent id passes", () => {
    const r = validateParams(ACTIONS.agentEnable!, { id: "scout" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.params.id).toBe("scout");
  });

  test("shell metacharacters in an id are rejected", () => {
    for (const bad of [
      "scout; rm -rf /",
      "scout && id",
      "$(whoami)",
      "`id`",
      "scout|cat",
      "../etc",
    ]) {
      expect(validateParams(ACTIONS.agentEnable!, { id: bad }).ok).toBe(false);
    }
  });

  test("a flag-looking id is rejected, so it cannot become an option", () => {
    expect(validateParams(ACTIONS.agentEnable!, { id: "--help" }).ok).toBe(
      false,
    );
    expect(validateParams(ACTIONS.agentEnable!, { id: "-rf" }).ok).toBe(false);
  });

  test("a relative or traversing workspace is rejected", () => {
    expect(
      validateParams(ACTIONS.agentAdd!, {
        id: "scout",
        workspace: "relative/path",
      }).ok,
    ).toBe(false);
    expect(
      validateParams(ACTIONS.agentAdd!, {
        id: "scout",
        workspace: "/tmp/../../etc",
      }).ok,
    ).toBe(false);
    expect(
      validateParams(ACTIONS.agentAdd!, { id: "scout", workspace: "/tmp/.." })
        .ok,
    ).toBe(false);
    expect(
      validateParams(ACTIONS.agentAdd!, {
        id: "scout",
        workspace: "/Users/me/GitHub/repo",
      }).ok,
    ).toBe(true);
    // A dot inside a name is fine; only a `..` path segment is refused.
    expect(
      validateParams(ACTIONS.agentAdd!, {
        id: "scout",
        workspace: "/Users/me/jstack.core",
      }).ok,
    ).toBe(true);
  });

  test("an id shorter than the minimum is rejected", () => {
    expect(validateParams(ACTIONS.agentEnable!, { id: "a" }).ok).toBe(false);
  });

  test("a malformed timestamp is rejected", () => {
    expect(validateParams(ACTIONS.explain!, { ts: "not-a-ts" }).ok).toBe(false);
    expect(
      validateParams(ACTIONS.explain!, { ts: "1785141296.398489" }).ok,
    ).toBe(true);
  });

  test("unknown keys are dropped rather than forwarded", () => {
    const r = validateParams(ACTIONS.agentEnable!, {
      id: "scout",
      sneaky: "--dangerous",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.params)).toEqual(["id"]);
  });

  test("a non-string value is rejected", () => {
    expect(
      validateParams(ACTIONS.agentEnable!, { id: 42 as unknown as string }).ok,
    ).toBe(false);
  });
});
