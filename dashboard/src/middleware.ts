import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getRateLimitIdentity, isAuthorizedRequest } from "@/lib/auth-request";
import { getDashboardEnv } from "@/lib/dashboard-env";
import { checkRateLimit } from "@/lib/rate-limit";

const PUBLIC_PATHS = new Set<string>(["/login", "/api/auth/login", "/api/auth/logout"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$/i.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Static assets and the login page itself need neither auth nor rate limiting. API paths in
  // PUBLIC_PATHS (login/logout) still go through the block below — they skip only the auth
  // check, not the rate limit, so login attempts can't bypass throttling by using the one
  // endpoint that doesn't require a session yet.
  if (isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch {
    return NextResponse.json({ error: "Server misconfigured (env)" }, { status: 503 });
  }

  // Rate limit BEFORE any auth check, for both API and page routes: an unauthenticated request
  // must never get to skip the throttle by virtue of failing auth first. The API branch below
  // already did this; the page branch used to check auth first, so hammering a protected page
  // with no session cookie got an unthrottled 302 every time -- never a 429.
  const id = await getRateLimitIdentity(request);
  const rl = checkRateLimit(
    id,
    env.DASHBOARD_RATE_LIMIT_MAX,
    env.DASHBOARD_RATE_LIMIT_WINDOW_MS,
  );

  if (pathname.startsWith("/api/")) {
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    if (!(await isAuthorizedRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  if (!(await isAuthorizedRequest(request))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
