import { z } from "zod";

const COOKIE_NAME = "dashboard_session";

const PayloadSchema = z.object({
  sub: z.string(),
  exp: z.number(),
});

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(s: string): string | undefined {
  try {
    const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i)!;
    }
    return new TextDecoder().decode(out);
  } catch {
    return undefined;
  }
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let out = 0;
  for (let i = 0; i < ea.length; i++) {
    out |= ea[i]! ^ eb[i]!;
  }
  return out === 0;
}

function encodePayload(payload: z.infer<typeof PayloadSchema>): string {
  return utf8ToBase64Url(JSON.stringify(payload));
}

export async function createSessionCookieValue(
  secret: string,
  subject: string,
  ttlMs: number,
): Promise<string> {
  const exp = Date.now() + ttlMs;
  const payloadB64 = encodePayload({ sub: subject, exp });
  const sig = await hmacSha256Base64Url(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

export async function verifySessionCookieValue(
  secret: string,
  value: string | undefined,
): Promise<{ ok: true; subject: string } | { ok: false }> {
  if (value === undefined || value.length === 0) return { ok: false };
  const parts = value.split(".");
  if (parts.length !== 2) return { ok: false };
  const [payloadB64, sig] = parts;
  if (payloadB64 === undefined || sig === undefined) return { ok: false };
  const expected = await hmacSha256Base64Url(secret, payloadB64);
  if (!timingSafeEqualUtf8(sig, expected)) return { ok: false };
  const json = base64UrlToUtf8(payloadB64);
  if (json === undefined) return { ok: false };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false };
  }
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  if (parsed.data.exp < Date.now()) return { ok: false };
  return { ok: true, subject: parsed.data.sub };
}

export const SESSION_COOKIE = COOKIE_NAME;

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
