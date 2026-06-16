import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

/** Always clears the session cookie so clients can recover from expired sessions. */
export async function POST(): Promise<Response> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
