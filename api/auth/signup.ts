// Vercel Edge Function — creates a password account. Mirrors api/gemma.ts's
// runtime/response conventions.
import { getSql } from "../_db";
import { createSessionToken, sessionCookieHeader } from "../_session";
import { hashPassword } from "../../src/lib/passwordHash";
import { json } from "../_http";

export const config = { runtime: "edge" };

interface SignupBody {
  email?: string;
  password?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: SignupBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  // Mirrors the client's own strength gate (src/lib/passwordStrength.ts) —
  // re-checked here since a request could bypass the UI entirely.
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
    return json({ error: "invalid_request" }, 400);
  }

  const sql = getSql();
  const normalizedEmail = email.toLowerCase();

  const existing = await sql`SELECT id FROM accounts WHERE normalized_email = ${normalizedEmail}`;
  if (existing.length > 0) return json({ error: "EMAIL_TAKEN" }, 409);

  const { hash, salt } = await hashPassword(password);
  const rows = await sql`
    INSERT INTO accounts (email, normalized_email, provider, password_hash, password_salt)
    VALUES (${email}, ${normalizedEmail}, 'password', ${hash}, ${salt})
    RETURNING id, email, display_name
  `;
  const account = rows[0] as { id: string; email: string; display_name: string | null };

  const token = await createSessionToken(account.id);
  return json(
    { accountId: account.id, email: account.email, displayName: account.display_name, isNew: true },
    200,
    { "set-cookie": sessionCookieHeader(req, token) },
  );
}
