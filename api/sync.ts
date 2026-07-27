// Vercel Edge Function — the server side of "sync on connect and on close"
// (see src/lib/sync.ts for the client half). GET pulls the account's whole
// ledger (small enough per the free-tier sizing in PLAN.md that a full
// snapshot beats incremental diffing in complexity); POST pushes whatever
// the client has queued locally since its last sync.
import { getSql } from "./_db";
import { getSessionAccountId } from "./_session";
import { json } from "./_http";

export const config = { runtime: "edge" };

interface CustomerPayload {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: number;
  updatedAt: number;
}

interface EntryPayload {
  id: string;
  type: "credit_sale" | "cash_sale" | "repayment";
  customerId: string | null;
  item: string | null;
  amountTaka: number;
  createdAt: number;
  confidence: unknown;
  transcript: string | null;
  edited: boolean;
  deletedAt: number | null;
}

interface PushBody {
  customers?: CustomerPayload[];
  entries?: EntryPayload[];
}

export default async function handler(req: Request): Promise<Response> {
  const accountId = await getSessionAccountId(req);
  if (!accountId) return json({ error: "UNAUTHENTICATED" }, 401);

  if (req.method === "GET") return pull(accountId);
  if (req.method === "POST") return push(req, accountId);
  return json({ error: "method_not_allowed" }, 405);
}

async function pull(accountId: string): Promise<Response> {
  const sql = getSql();
  const customerRows = await sql`
    SELECT id, name, normalized_name, created_at, updated_at
    FROM customers WHERE account_id = ${accountId}
  `;
  const entryRows = await sql`
    SELECT id, type, customer_id, item, amount_taka, created_at, confidence, transcript, edited, deleted_at
    FROM entries WHERE account_id = ${accountId}
  `;

  return json({
    customers: customerRows.map((c) => ({
      id: c.id,
      name: c.name,
      normalizedName: c.normalized_name,
      createdAt: Number(c.created_at),
      updatedAt: Number(c.updated_at),
    })),
    entries: entryRows.map((e) => ({
      id: e.id,
      type: e.type,
      customerId: e.customer_id,
      item: e.item,
      amountTaka: Number(e.amount_taka),
      createdAt: Number(e.created_at),
      confidence: e.confidence,
      transcript: e.transcript,
      edited: e.edited,
      deletedAt: e.deleted_at == null ? null : Number(e.deleted_at),
    })),
  });
}

async function push(req: Request, accountId: string): Promise<Response> {
  let body: PushBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }

  const sql = getSql();

  // Customers first (entries reference them), keyed by (account, normalized
  // name) rather than id — two devices that independently created the same
  // customer while both offline resolve to one row; the id map below
  // rewrites the client's proposed id to whichever id "won" server-side.
  const customerIdMap = new Map<string, string>();
  for (const c of body.customers ?? []) {
    const rows = await sql`
      INSERT INTO customers (id, account_id, name, normalized_name, created_at, updated_at)
      VALUES (${c.id}, ${accountId}, ${c.name}, ${c.normalizedName}, ${c.createdAt}, ${c.updatedAt})
      ON CONFLICT (account_id, normalized_name)
      DO UPDATE SET name = EXCLUDED.name, updated_at = GREATEST(customers.updated_at, EXCLUDED.updated_at)
      RETURNING id
    `;
    customerIdMap.set(c.id, rows[0].id as string);
  }

  for (const e of body.entries ?? []) {
    const resolvedCustomerId = e.customerId ? (customerIdMap.get(e.customerId) ?? e.customerId) : null;
    await sql`
      INSERT INTO entries (id, account_id, type, customer_id, item, amount_taka, created_at, confidence, transcript, edited, deleted_at)
      VALUES (${e.id}, ${accountId}, ${e.type}, ${resolvedCustomerId}, ${e.item}, ${e.amountTaka}, ${e.createdAt}, ${JSON.stringify(e.confidence)}, ${e.transcript}, ${e.edited}, ${e.deletedAt})
      ON CONFLICT (id) DO UPDATE SET deleted_at = EXCLUDED.deleted_at
    `;
  }

  return json({ ok: true, customerIdMap: Object.fromEntries(customerIdMap) });
}
