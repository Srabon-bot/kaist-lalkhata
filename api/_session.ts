// Stateless signed-cookie sessions — no server-side session table, just an
// HMAC-SHA256-signed token (Web Crypto, works on Vercel's Edge runtime the
// same as passwordHash.ts does client-side). Trades server-side revocation
// for zero extra DB round-trips per request; fine for this app's scope.

const COOKIE_NAME = "hk_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionPayload {
  accountId: string;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(accountId: string): Promise<string> {
  const payload: SessionPayload = { accountId, exp: Date.now() + SESSION_TTL_MS };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await hmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes as BufferSource);
  return `${toBase64Url(payloadBytes)}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;

  try {
    const key = await hmacKey();
    const payloadBytes = fromBase64Url(payloadPart);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signaturePart) as BufferSource,
      payloadBytes as BufferSource,
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

/** Returns the authenticated account id from the request's session cookie, or null. */
export async function getSessionAccountId(req: Request): Promise<string | null> {
  const token = readCookie(req, COOKIE_NAME);
  if (!token) return null;
  const payload = await verifySessionToken(token);
  return payload?.accountId ?? null;
}

function isHttps(req: Request): boolean {
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return true;
  }
}

/** `Set-Cookie` header value that logs the account in. Drops `Secure` for
 * plain-http local testing (e.g. `vercel dev` without --https) — real
 * deployments are always https, where it's included. */
export function sessionCookieHeader(req: Request, token: string): string {
  const attrs = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`];
  if (isHttps(req)) attrs.push("Secure");
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; ${attrs.join("; ")}`;
}

export function clearSessionCookieHeader(req: Request): string {
  const attrs = [`Path=/`, `HttpOnly`, `SameSite=Lax`, `Max-Age=0`];
  if (isHttps(req)) attrs.push("Secure");
  return `${COOKIE_NAME}=; ${attrs.join("; ")}`;
}
