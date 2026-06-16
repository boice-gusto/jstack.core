import type { NextRequest } from "next/server";

import { getDashboardEnv } from "@/lib/dashboard-env";
import { SESSION_COOKIE, verifySessionCookieValue } from "@/lib/session";

function extractApiKey(request: NextRequest): string | undefined {
  const header = request.headers.get("x-api-key");
  if (header !== null && header.length > 0) return header;
  const auth = request.headers.get("authorization");
  if (auth === null) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m?.[1]?.trim();
}

export async function isAuthorizedRequest(request: NextRequest): Promise<boolean> {
  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch {
    return false;
  }
  const key = extractApiKey(request);
  if (key !== undefined && key === env.DASHBOARD_API_KEY) return true;
  const secret = env.DASHBOARD_SESSION_SECRET;
  if (secret === undefined || secret.length === 0) return false;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  const v = await verifySessionCookieValue(secret, cookie);
  return v.ok;
}

export async function getRateLimitIdentity(request: NextRequest): Promise<string> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch {
    return `${ip}:no-env`;
  }
  const key = extractApiKey(request);
  if (key !== undefined && key === env.DASHBOARD_API_KEY) {
    return `${ip}:key:${key.slice(0, 8)}`;
  }
  const secret = env.DASHBOARD_SESSION_SECRET;
  if (secret !== undefined) {
    const cookie = request.cookies.get(SESSION_COOKIE)?.value;
    const v = await verifySessionCookieValue(secret, cookie);
    if (v.ok) return `${ip}:session:${v.subject}`;
  }
  return `${ip}:anon`;
}
