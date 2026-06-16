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
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch {
    return NextResponse.json({ error: "Server misconfigured (env)" }, { status: 503 });
  }

  if (pathname.startsWith("/api/")) {
    const id = await getRateLimitIdentity(request);
    const rl = checkRateLimit(
      id,
      env.DASHBOARD_RATE_LIMIT_MAX,
      env.DASHBOARD_RATE_LIMIT_WINDOW_MS,
    );
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
    if (!(await isAuthorizedRequest(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!(await isAuthorizedRequest(request))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const id = await getRateLimitIdentity(request);
  const rl = checkRateLimit(
    id,
    env.DASHBOARD_RATE_LIMIT_MAX,
    env.DASHBOARD_RATE_LIMIT_WINDOW_MS,
  );
  if (!rl.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
