import { clearSessionCookieHeader } from "../_session";
import { json } from "../_http";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookieHeader(req) });
}
