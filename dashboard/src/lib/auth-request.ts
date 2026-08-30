import type { NextRequest } from "next/server";

import { getDashboardEnv } from "@/lib/dashboard-env";
import { SESSION_COOKIE, timingSafeEqualUtf8, verifySessionCookieValue } from "@/lib/session";

function extractApiKey(request: NextRequest): string | undefined {
  const header = request.headers.get("x-api-key");
  if (header !== null && header.length > 0) return header;
  const auth = request.headers.get("authorization");
  if (auth === null) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m?.[1]?.trim();
}

/**
 * What a request is authenticated as, resolved once. `isAuthorizedRequest` and
 * `getRateLimitIdentity` used to each independently run the same 5-step check (env lookup,
 * api-key compare, session-secret presence, cookie read, HMAC verify) -- `middleware.ts` calls
 * both on the same request, so a request with a session cookie had its HMAC verified twice per
 * request. Resolving identity once and deriving both the authorization boolean and the
 * rate-limit key from that one result removes the duplicate verification.
 */
export type RequestIdentity =
  | { kind: "no-env" }
  | { kind: "api-key"; key: string }
  | { kind: "session"; subject: string }
  | { kind: "anon" };

export async function resolveRequestIdentity(request: NextRequest): Promise<RequestIdentity> {
  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch {
    return { kind: "no-env" };
  }
  const key = extractApiKey(request);
  if (key !== undefined && timingSafeEqualUtf8(key, env.DASHBOARD_API_KEY)) {
    return { kind: "api-key", key };
  }
  const secret = env.DASHBOARD_SESSION_SECRET;
  if (secret !== undefined && secret.length > 0) {
    const cookie = request.cookies.get(SESSION_COOKIE)?.value;
    const v = await verifySessionCookieValue(secret, cookie);
    if (v.ok) return { kind: "session", subject: v.subject };
  }
  return { kind: "anon" };
}

export function isAuthorizedIdentity(identity: RequestIdentity): boolean {
  return identity.kind === "api-key" || identity.kind === "session";
}

/** Resolves identity itself; only needed by callers (tests, one-off checks) that don't already
 * have a `RequestIdentity` from `resolveRequestIdentity` in hand. `middleware.ts` doesn't use
 * this -- it resolves identity once and reads `isAuthorizedIdentity`/`rateLimitKeyForIdentity`
 * off the same result. */
export async function isAuthorizedRequest(request: NextRequest): Promise<boolean> {
  return isAuthorizedIdentity(await resolveRequestIdentity(request));
}

export function extractClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimitKeyForIdentity(identity: RequestIdentity, ip: string): string {
  switch (identity.kind) {
    case "no-env":
      return `${ip}:no-env`;
    case "api-key":
      return `${ip}:key:${identity.key.slice(0, 8)}`;
    case "session":
      return `${ip}:session:${identity.subject}`;
    case "anon":
      return `${ip}:anon`;
  }
}

/** Resolves identity itself; see the note on `isAuthorizedRequest` above -- `middleware.ts`
 * doesn't call this either, for the same reason. */
export async function getRateLimitIdentity(request: NextRequest): Promise<string> {
  return rateLimitKeyForIdentity(await resolveRequestIdentity(request), extractClientIp(request));
}
