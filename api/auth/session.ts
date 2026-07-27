import { getSql } from "../_db";
import { getSessionAccountId } from "../_session";
import { json } from "../_http";

export const config = { runtime: "edge" };

/** Checked on app load — is there a valid session cookie for a real
 * account? Drives whether a second device lands straight in the app or
 * needs to log in first. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const accountId = await getSessionAccountId(req);
  if (!accountId) return json({ authenticated: false });

  const sql = getSql();
  const rows = await sql`SELECT id, email, display_name FROM accounts WHERE id = ${accountId}`;
  const account = rows[0] as { id: string; email: string; display_name: string | null } | undefined;
  if (!account) return json({ authenticated: false });

  return json({ authenticated: true, accountId: account.id, email: account.email, displayName: account.display_name });
}
