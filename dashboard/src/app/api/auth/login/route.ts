import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionCookieValue, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/session";
import { getDashboardEnv } from "@/server/env";

const LoginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request): Promise<Response> {
  let env: ReturnType<typeof getDashboardEnv>;
  try {
    env = getDashboardEnv();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid env";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const user = env.DASHBOARD_ADMIN_USER?.trim();
  const pass = env.DASHBOARD_ADMIN_PASSWORD;
  const secret = env.DASHBOARD_SESSION_SECRET?.trim();
  if (
    user === undefined ||
    user.length === 0 ||
    pass === undefined ||
    pass.length === 0 ||
    secret === undefined ||
    secret.length === 0
  ) {
    return NextResponse.json(
      { error: "Login is not configured (set DASHBOARD_ADMIN_USER, DASHBOARD_ADMIN_PASSWORD, DASHBOARD_SESSION_SECRET)" },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = LoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.username !== user || parsed.data.password !== pass) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionCookieValue(secret, user, SESSION_TTL_MS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
