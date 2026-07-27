import { getSql } from "../_db";
import { createSessionToken, sessionCookieHeader } from "../_session";
import { verifyPassword } from "../../src/lib/passwordHash";
import { json } from "../_http";

export const config = { runtime: "edge" };

interface LoginBody {
  email?: string;
  password?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) return json({ error: "invalid_request" }, 400);

  const sql = getSql();
  const rows = await sql`
    SELECT id, email, provider, password_hash, password_salt, display_name
    FROM accounts WHERE normalized_email = ${email.toLowerCase()}
  `;
  const account = rows[0] as
    | {
        id: string;
        email: string;
        provider: string;
        password_hash: string | null;
        password_salt: string | null;
        display_name: string | null;
      }
    | undefined;

  if (!account) return json({ error: "NOT_FOUND" }, 404);
  if (account.provider !== "password" || !account.password_hash || !account.password_salt) {
    return json({ error: "WRONG_PROVIDER" }, 409);
  }

  const ok = await verifyPassword(password, account.password_salt, account.password_hash);
  if (!ok) return json({ error: "WRONG_PASSWORD" }, 401);

  const token = await createSessionToken(account.id);
  return json(
    { accountId: account.id, email: account.email, displayName: account.display_name, isNew: false },
    200,
    { "set-cookie": sessionCookieHeader(req, token) },
  );
}
