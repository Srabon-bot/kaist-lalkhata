import { getSql } from "../_db";
import { createSessionToken, sessionCookieHeader } from "../_session";
import { verifyGoogleAccessToken } from "../_google";
import { json } from "../_http";

export const config = { runtime: "edge" };

interface GoogleBody {
  accessToken?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: GoogleBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (!body.accessToken) return json({ error: "invalid_request" }, 400);

  let identity;
  try {
    identity = await verifyGoogleAccessToken(body.accessToken);
  } catch {
    return json({ error: "GOOGLE_TOKEN_INVALID" }, 401);
  }

  const sql = getSql();
  const normalizedEmail = identity.email.toLowerCase();
  const existingRows = await sql`
    SELECT id, email, display_name FROM accounts WHERE normalized_email = ${normalizedEmail}
  `;

  let account: { id: string; email: string; display_name: string | null };
  let isNew = false;
  if (existingRows.length > 0) {
    account = existingRows[0] as typeof account;
  } else {
    isNew = true;
    const inserted = await sql`
      INSERT INTO accounts (email, normalized_email, provider, google_sub)
      VALUES (${identity.email}, ${normalizedEmail}, 'google', ${identity.sub})
      RETURNING id, email, display_name
    `;
    account = inserted[0] as typeof account;
  }

  const token = await createSessionToken(account.id);
  return json(
    {
      accountId: account.id,
      email: account.email,
      displayName: account.display_name,
      isNew,
      suggestedName: identity.name,
    },
    200,
    { "set-cookie": sessionCookieHeader(req, token) },
  );
}
