import { getSql } from "../_db";
import { getSessionAccountId } from "../_session";
import { json } from "../_http";

export const config = { runtime: "edge" };

interface UsernameBody {
  name?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const accountId = await getSessionAccountId(req);
  if (!accountId) return json({ error: "UNAUTHENTICATED" }, 401);

  let body: UsernameBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const name = (body.name ?? "").trim();
  if (!name) return json({ error: "invalid_request" }, 400);

  const sql = getSql();
  await sql`UPDATE accounts SET display_name = ${name} WHERE id = ${accountId}`;

  return json({ ok: true, displayName: name });
}
