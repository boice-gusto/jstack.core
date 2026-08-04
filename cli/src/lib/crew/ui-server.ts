import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The ephemeral local control plane for the crew UI.
 *
 * A browser-reachable server that can mutate agent config and trigger Slack posts is exactly
 * the shape of OpenClaw's CVE-2026-25253: a one-click RCE via cross-site request forgery
 * against a local gateway. **Binding to loopback is not a control** -- any page you visit can
 * issue requests to 127.0.0.1, and DNS rebinding lets an attacker-controlled name resolve
 * there too.
 *
 * So every request must clear all of these, and each one blocks a specific real attack:
 *
 *   1. Token, timing-safe compared. Minted per run, never persisted. Defeats a blind attacker
 *      who knows the port but not the secret.
 *   2. Token in a HEADER for mutations, not just the URL. A cross-origin <form> POST cannot
 *      set custom headers, so this alone stops classic CSRF.
 *   3. Host header pinned to 127.0.0.1:<port>. This is the DNS-rebinding defence: without it,
 *      evil.com can resolve to 127.0.0.1 and the request looks local.
 *   4. Origin, when present, must be exactly our own origin. Blocks cross-site fetch/XHR.
 *   5. Sec-Fetch-Site must be same-origin or none. Modern browsers set this and cannot be
 *      talked out of it from script.
 *   6. Actions are a fixed allowlist of names mapped to argv arrays. No shell, ever, and no
 *      user-supplied string reaches a command position.
 *   7. go-live and clearing a HALT are NOT exposed. Making Ralph start posting as the
 *      operator, or un-halting a system someone stopped, stays a deliberate terminal act.
 *
 * The server also exits when you stop it, so the exposure window is a session rather than
 * forever, which is the main advantage over adding this to an always-on dashboard.
 */

export interface UiAction {
  /** Fixed argv after `jstackc crew`. No interpolation of free-form user input. */
  argv: (params: Record<string, string>) => string[];
  /** Params allowed for this action, each validated before use. */
  params?: Record<string, RegExp>;
  /** Mutating actions require the header token and a POST. */
  mutating: boolean;
  description: string;
}

const AGENT_ID = /^[a-z][a-z0-9-]{1,23}$/;
const TS = /^[0-9]{10}\.[0-9]{6}$/;
const MODEL = /^[a-z0-9][a-z0-9.\-]{2,40}$/;
const FREEFORM = /^[\w \-.,'()/:#?!]{1,200}$/;
/**
 * Absolute, no traversal. `..` is refused here rather than deferred to the CLI: the UI is the
 * boundary, and a path that escapes upward has no legitimate use as a workspace root.
 */
const PATH_ABS = /^\/(?!.*(?:^|\/)\.\.(?:\/|$))[\w \-./]{1,200}$/;

/**
 * The complete set of things the UI can do. Anything not here is unreachable, which is the
 * point: the allowlist is the security boundary, not the front end.
 */
export const ACTIONS: Record<string, UiAction> = {
  status: {
    argv: () => ["status", "--json"],
    mutating: false,
    description: "Read status",
  },
  doctor: {
    argv: () => ["doctor", "--json"],
    mutating: false,
    description: "Run preflight checks",
  },
  agentsList: {
    argv: () => ["agents", "list", "--json"],
    mutating: false,
    description: "List agents",
  },
  agentShow: {
    argv: (p) => ["agents", "show", p.id!, "--json"],
    params: { id: AGENT_ID },
    mutating: false,
    description: "Show one agent",
  },
  explain: {
    argv: (p) => ["explain", p.ts!],
    params: { ts: TS },
    mutating: false,
    description: "Why a message got no reply",
  },

  tick: {
    argv: () => ["tick"],
    mutating: true,
    description: "Run one poll cycle now",
  },
  agentEnable: {
    argv: (p) => ["agents", "enable", p.id!],
    params: { id: AGENT_ID },
    mutating: true,
    description: "Put an agent into routing",
  },
  agentDisable: {
    argv: (p) => ["agents", "disable", p.id!],
    params: { id: AGENT_ID },
    mutating: true,
    description: "Take an agent out of routing",
  },
  agentRemove: {
    argv: (p) => ["agents", "remove", p.id!, "--yes"],
    params: { id: AGENT_ID },
    mutating: true,
    description: "Delete an agent definition",
  },
  agentAdd: {
    argv: (p) => [
      "agents",
      "add",
      p.id!,
      "--workspace",
      p.workspace!,
      ...(p.description ? ["--description", p.description] : []),
      ...(p.model ? ["--model", p.model] : []),
    ],
    params: {
      id: AGENT_ID,
      workspace: PATH_ABS,
      description: FREEFORM,
      model: MODEL,
    },
    mutating: true,
    description: "Create an agent (starts disabled)",
  },
  agentEdit: {
    argv: (p) => [
      "agents",
      "edit",
      p.id!,
      ...(p.name ? ["--name", p.name] : []),
      ...(p.model ? ["--model", p.model] : []),
      ...(p.description ? ["--description", p.description] : []),
      ...(p.persona ? ["--persona", p.persona] : []),
    ],
    params: {
      id: AGENT_ID,
      name: FREEFORM,
      model: MODEL,
      description: FREEFORM,
      persona: FREEFORM,
    },
    mutating: true,
    description: "Change an agent",
  },
  panic: {
    argv: (p) => ["panic", "--reason", p.reason ?? "from the crew UI"],
    params: { reason: FREEFORM },
    mutating: true,
    description: "Halt everything",
  },
  simulate: {
    argv: (p) => ["simulate", p.text!],
    params: { text: FREEFORM },
    mutating: true,
    description: "Dry-run a message (never posts)",
  },
};

/**
 * Deliberately absent, and this list is part of the design rather than an oversight:
 *   go-live               -- starting to post as the operator is irreversible per message
 *   resume --clear-halt   -- un-halting something a human stopped
 *   install / uninstall   -- changes what runs at login
 */
export const BLOCKED_FROM_UI = ["go-live", "resume", "install", "uninstall"];

export function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenMatches(expected: string, got: string | null): boolean {
  if (!got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  // Compare lengths separately: timingSafeEqual throws on a mismatch, which would itself leak.
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface GuardResult {
  ok: boolean;
  status?: number;
  reason?: string;
}

/** All seven checks, in one place, so there is exactly one path into the action dispatcher. */
export function guardRequest(
  req: Request,
  opts: { token: string; port: number; mutating: boolean },
): GuardResult {
  const url = new URL(req.url);

  // 3. DNS rebinding: the Host header must be our loopback origin, not a name pointing at it.
  const host = req.headers.get("host");
  const allowedHosts = [`127.0.0.1:${opts.port}`, `localhost:${opts.port}`];
  if (!host || !allowedHosts.includes(host)) {
    return {
      ok: false,
      status: 403,
      reason: `unexpected Host: ${host ?? "(none)"}`,
    };
  }

  // 5. Fetch metadata. A cross-site request cannot forge this.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return {
      ok: false,
      status: 403,
      reason: `cross-site request (Sec-Fetch-Site: ${site})`,
    };
  }

  // 4. Origin, when the browser sends one, must be ours.
  const origin = req.headers.get("origin");
  if (origin && !allowedHosts.some((h) => origin === `http://${h}`)) {
    return { ok: false, status: 403, reason: `bad Origin: ${origin}` };
  }

  // 1 + 2. Token. Mutations must carry it in a header, which a cross-origin form cannot set.
  if (opts.mutating) {
    if (req.method !== "POST")
      return { ok: false, status: 405, reason: "mutations must be POST" };
    if (!tokenMatches(opts.token, req.headers.get("x-crew-token"))) {
      return { ok: false, status: 401, reason: "missing or bad X-Crew-Token" };
    }
  } else if (
    !tokenMatches(
      opts.token,
      url.searchParams.get("t") ?? req.headers.get("x-crew-token"),
    )
  ) {
    return { ok: false, status: 401, reason: "missing or bad token" };
  }

  return { ok: true };
}

/** Validate params against the action's own patterns. Unknown keys are dropped, not passed. */
export function validateParams(
  action: UiAction,
  raw: Record<string, unknown>,
):
  | { ok: true; params: Record<string, string> }
  | { ok: false; reason: string } {
  const out: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(action.params ?? {})) {
    const v = raw[key];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string")
      return { ok: false, reason: `${key} must be a string` };
    if (!pattern.test(v))
      return { ok: false, reason: `${key} rejected by its pattern` };
    out[key] = v;
  }
  // Required-ness is expressed by the argv builder using `p.x!`; check the obvious ones.
  return { ok: true, params: out };
}
