// Cross-device sync: pull the account's ledger on connect (app load, and
// whenever the `online` event fires after a spell offline), push local
// changes on connect and again whenever the tab is closed/hidden or the
// user logs off — see PLAN.md for the full design and why entries are
// soft-deleted, customers keyed by name, and balances recomputed rather
// than synced directly.
import { liveQuery } from "dexie";
import { db, isLive, type LedgerEntry, type Customer, type Confidence } from "./db";

interface SyncEntryPayload {
  id: string;
  type: LedgerEntry["type"];
  customerId: string | null;
  item: string | null;
  amountTaka: number;
  createdAt: number;
  confidence: Confidence | null;
  transcript: string | null;
  edited: boolean;
  deletedAt: number | null;
}

interface SyncCustomerPayload {
  id: string;
  name: string;
  normalizedName: string;
  createdAt: number;
  updatedAt: number;
}

interface SyncPullResponse {
  customers: SyncCustomerPayload[];
  entries: SyncEntryPayload[];
}

// A synchronous, always-fresh mirror of the local tables — kept via Dexie's
// own liveQuery (not the React hook) so the pagehide beacon handler can
// build a payload without an async IndexedDB read racing the tab actually
// closing. Subscribed once, for the lifetime of the tab.
let latestEntries: LedgerEntry[] = [];
let latestCustomers: Customer[] = [];
liveQuery(() => db.entries.toArray()).subscribe((rows) => {
  latestEntries = rows;
});
liveQuery(() => db.customers.toArray()).subscribe((rows) => {
  latestCustomers = rows;
});

function buildPushPayload(entries: LedgerEntry[], customers: Customer[]): { customers: SyncCustomerPayload[]; entries: SyncEntryPayload[] } {
  const byLocalId = new Map(customers.map((c) => [c.id!, c]));
  return {
    customers: customers.map((c) => ({
      id: c.uuid,
      name: c.name,
      normalizedName: c.normalizedName,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    entries: entries.map((e) => ({
      id: e.uuid,
      type: e.type,
      customerId: e.customerId != null ? (byLocalId.get(e.customerId)?.uuid ?? null) : null,
      item: e.item,
      amountTaka: e.amountTaka,
      createdAt: e.createdAt,
      confidence: e.confidence,
      transcript: e.transcript,
      edited: e.edited,
      deletedAt: e.deletedAt,
    })),
  };
}

/** Best-effort push kicked off while the app still has time to await it
 * (app load, `online` event, tab hidden) — a normal fetch, not the beacon. */
export async function pushToServer(): Promise<void> {
  const [entries, customers] = await Promise.all([db.entries.toArray(), db.customers.toArray()]);
  const payload = buildPushPayload(entries, customers);
  try {
    await fetch("/api/sync", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Offline or server unreachable — the next successful sync (on
    // reconnect) carries the same local rows again, upserts are idempotent.
  }
}

/** Fire-and-forget push for the moment the tab is actually being torn down
 * (`pagehide`) — uses the synchronous in-memory mirror above rather than
 * awaiting a fresh IndexedDB read the unload might outrun. */
export function pushToServerBeacon(): void {
  if (!navigator.onLine) return;
  const payload = buildPushPayload(latestEntries, latestCustomers);
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  navigator.sendBeacon("/api/sync", blob);
}

export async function pullFromServer(): Promise<void> {
  let data: SyncPullResponse;
  try {
    const res = await fetch("/api/sync", { credentials: "include" });
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return; // offline — nothing to merge this round
  }

  await db.transaction("rw", db.entries, db.customers, async () => {
    const uuidToLocalId = new Map<string, number>();

    for (const c of data.customers) {
      const existing = await db.customers.where("uuid").equals(c.id).first();
      if (existing) {
        await db.customers.update(existing.id!, {
          name: c.name,
          normalizedName: c.normalizedName,
          updatedAt: Math.max(existing.updatedAt, c.updatedAt),
        });
        uuidToLocalId.set(c.id, existing.id!);
      } else {
        const localId = await db.customers.add({
          uuid: c.id,
          name: c.name,
          normalizedName: c.normalizedName,
          balanceTaka: 0, // recomputed below, from entries
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        });
        uuidToLocalId.set(c.id, localId!);
      }
    }

    for (const e of data.entries) {
      const existing = await db.entries.where("uuid").equals(e.id).first();
      const customerLocalId = e.customerId ? (uuidToLocalId.get(e.customerId) ?? null) : null;

      if (existing) {
        // Entries are otherwise immutable once created (see db.ts) — the
        // only field a later sync can legitimately change is a rollback.
        if (e.deletedAt !== existing.deletedAt) {
          await db.entries.update(existing.id!, { deletedAt: e.deletedAt });
        }
      } else {
        await db.entries.add({
          uuid: e.id,
          type: e.type,
          customerId: customerLocalId,
          item: e.item,
          // Not synced (see LedgerEntry.itemTranslations) — a row pulled
          // from another device just falls back to displaying `item` as-is.
          itemTranslations: null,
          amountTaka: e.amountTaka,
          createdAt: e.createdAt,
          confidence: e.confidence,
          transcript: e.transcript,
          edited: e.edited,
          deletedAt: e.deletedAt,
        });
      }
    }

    // Balances are a derived cache, never synced directly (PLAN.md) —
    // recompute every customer fresh from the now-merged, live entries.
    const allCustomers = await db.customers.toArray();
    const allEntries = await db.entries.toArray();
    for (const c of allCustomers) {
      const balance = allEntries
        .filter((e) => e.customerId === c.id && isLive(e))
        .reduce(
          (sum, e) => sum + (e.type === "credit_sale" ? e.amountTaka : e.type === "repayment" ? -e.amountTaka : 0),
          0,
        );
      if (balance !== c.balanceTaka) await db.customers.update(c.id!, { balanceTaka: balance });
    }
  });
}

async function syncNow(): Promise<void> {
  await pullFromServer();
  await pushToServer();
}

/** Wires up connect/close sync for the lifetime of an authenticated
 * session — call once after login (Layout mounts only once entered), and
 * call the returned dispose function on logout/unmount. */
export function initSync(): () => void {
  const handleOnline = () => {
    void syncNow();
  };
  const handleVisibility = () => {
    if (document.hidden) void pushToServer();
  };
  const handlePageHide = () => {
    pushToServerBeacon();
  };

  if (navigator.onLine) void syncNow();
  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("pagehide", handlePageHide);

  return () => {
    window.removeEventListener("online", handleOnline);
    document.removeEventListener("visibilitychange", handleVisibility);
    window.removeEventListener("pagehide", handlePageHide);
  };
}
