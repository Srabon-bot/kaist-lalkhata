import Dexie, { type EntityTable } from "dexie";
import type { ItemTranslations } from "./schema";

export type EntryType = "credit_sale" | "cash_sale" | "repayment";

export interface Confidence {
  customer: number;
  item: number;
  amount: number;
}

export interface LedgerEntry {
  id?: number; // local Dexie primary key only — never sent to the server
  uuid: string; // stable cross-device identity, used as the sync primary key
  type: EntryType;
  customerId: number | null; // local FK — null only for anonymous cash sales
  item: string | null;
  // bn/en/ko renderings of `item` so the ledger/history views can show it in
  // whatever language the UI is currently switched to (customer names stay
  // as originally spoken — only item text is meant to translate). Local-only
  // for now: not part of the server sync payload (src/lib/sync.ts), so a
  // fresh pull on another device only carries `item`, not the translations —
  // extending db/schema.sql to sync this is a deliberately separate step
  // since it touches the live production database. Null for entries
  // recorded before this field existed, or where item itself is null.
  itemTranslations: ItemTranslations | null;
  amountTaka: number;
  createdAt: number; // epoch ms
  confidence: Confidence | null; // null for manually-entered rows
  transcript: string | null;
  edited: boolean; // user changed a field on the confirmation card
  deletedAt: number | null; // soft-delete marker (see rollbackEntry) — a hard
  // local delete would have nothing left to sync to other devices
}

/** Item text in the ledger/history's current display language, falling back
 * to whatever language it was originally recorded in when no translation is
 * stored (older entries, or a hand-edited item with translations cleared). */
export function displayItem(entry: LedgerEntry, lang: "bn" | "en" | "ko"): string | null {
  return entry.itemTranslations?.[lang] ?? entry.item;
}

export interface Customer {
  id?: number; // local Dexie primary key only — never sent to the server
  uuid: string; // stable cross-device identity
  name: string; // display form, e.g. "রহিম ভাই"
  normalizedName: string; // lowercase/trimmed, unique index for dedupe
  balanceTaka: number; // positive = owes the shop (baki) — local-only cache,
  // always recomputed from synced entries after a merge, never synced itself
  createdAt: number;
  updatedAt: number;
}

class LalKhataDB extends Dexie {
  entries!: EntityTable<LedgerEntry, "id">;
  customers!: EntityTable<Customer, "id">;

  constructor() {
    super("lal-khata");
    this.version(1).stores({
      entries: "++id, type, customerId, createdAt",
      customers: "++id, &normalizedName, balanceTaka",
    });
    // v2 added a `pendingRecordings` table for PRD F8 (queue an utterance
    // recorded offline, extract once back online) — needed only because
    // extraction used to require a network call to Gemini/Gemma. Local
    // rule-based extraction (src/lib/localExtraction.ts) has no network
    // dependency at all, so there's nothing left to queue; queuePendingRecording
    // and friends were removed. Left as a no-op store (not nulled out) so
    // existing users' already-created object store doesn't need a
    // migration of its own — it just sits unused.
    this.version(2).stores({
      pendingRecordings: "++id, createdAt",
    });
    // v3 added a local `accounts` table for a device-only auth prototype;
    // superseded by the server-backed accounts table in db/schema.sql once
    // auth moved server-side for cross-device login — dropped here rather
    // than left as dead, unused local state.
    this.version(4).stores({
      accounts: null,
      entries: "++id, &uuid, type, customerId, createdAt",
      customers: "++id, &uuid, &normalizedName, balanceTaka",
    });
  }
}

export const db = new LalKhataDB();

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True for an entry that hasn't been rolled back — every read path that
 * lists/sums entries for display should filter through this (a soft-deleted
 * row stays in Dexie only so its tombstone can sync to other devices). */
export function isLive(entry: LedgerEntry): boolean {
  return entry.deletedAt == null;
}

/** Finds a customer by (normalized) name, creating one if it doesn't exist yet. */
export async function getOrCreateCustomer(rawName: string): Promise<Customer> {
  const normalizedName = normalizeName(rawName);
  const existing = await db.customers.where("normalizedName").equals(normalizedName).first();
  if (existing) return existing;

  const now = Date.now();
  const id = await db.customers.add({
    uuid: crypto.randomUUID(),
    name: rawName.trim(),
    normalizedName,
    balanceTaka: 0,
    createdAt: now,
    updatedAt: now,
  });
  return (await db.customers.get(id))!;
}

export interface RecordEntryInput {
  type: EntryType;
  customerName: string | null;
  item: string | null;
  itemTranslations: ItemTranslations | null;
  amountTaka: number;
  confidence: Confidence | null;
  transcript: string | null;
  edited: boolean;
}

/** Records a ledger entry and applies its effect on the customer's baki balance. */
export async function recordEntry(input: RecordEntryInput): Promise<LedgerEntry> {
  return db.transaction("rw", db.entries, db.customers, async () => {
    let customerId: number | null = null;

    if (input.customerName && input.customerName.trim()) {
      const customer = await getOrCreateCustomer(input.customerName);
      customerId = customer.id!;

      const delta =
        input.type === "credit_sale" ? input.amountTaka : input.type === "repayment" ? -input.amountTaka : 0;

      if (delta !== 0) {
        await db.customers.update(customerId, {
          balanceTaka: customer.balanceTaka + delta,
          updatedAt: Date.now(),
        });
      }
    }

    const entry: LedgerEntry = {
      uuid: crypto.randomUUID(),
      type: input.type,
      customerId,
      item: input.item,
      itemTranslations: input.itemTranslations,
      amountTaka: input.amountTaka,
      createdAt: Date.now(),
      confidence: input.confidence,
      transcript: input.transcript,
      edited: input.edited,
      deletedAt: null,
    };
    const id = await db.entries.add(entry);
    return { ...entry, id };
  });
}

/** Records a বাকি শোধ (baki repaid) action from a customer's page. */
export async function repayBaki(customerId: number, amountTaka: number): Promise<void> {
  const customer = await db.customers.get(customerId);
  if (!customer) throw new Error("Unknown customer");

  await db.transaction("rw", db.entries, db.customers, async () => {
    await db.entries.add({
      uuid: crypto.randomUUID(),
      type: "repayment",
      customerId,
      item: null,
      itemTranslations: null,
      amountTaka,
      createdAt: Date.now(),
      confidence: null,
      transcript: null,
      edited: false,
      deletedAt: null,
    });
    await db.customers.update(customerId, {
      balanceTaka: customer.balanceTaka - amountTaka,
      updatedAt: Date.now(),
    });
  });
}

/** Undoes a ledger entry: reverses its effect on the customer's baki balance
 * (if any), then soft-deletes it (deletedAt set, row kept) rather than
 * removing it outright — a hard local delete would have nothing left to
 * sync as a deletion to this account's other devices. Every read path
 * filters soft-deleted rows out via isLive(). */
export async function rollbackEntry(entryId: number): Promise<void> {
  await db.transaction("rw", db.entries, db.customers, async () => {
    const entry = await db.entries.get(entryId);
    if (!entry || !isLive(entry)) return;

    if (entry.customerId != null) {
      const customer = await db.customers.get(entry.customerId);
      if (customer) {
        const reverseDelta =
          entry.type === "credit_sale" ? -entry.amountTaka : entry.type === "repayment" ? entry.amountTaka : 0;
        if (reverseDelta !== 0) {
          await db.customers.update(entry.customerId, {
            balanceTaka: customer.balanceTaka + reverseDelta,
            updatedAt: Date.now(),
          });
        }
      }
    }

    await db.entries.update(entryId, { deletedAt: Date.now() });
  });
}

/** The Haal Khata ritual's "start the new year" moment: archives every live
 * entry via the same soft-delete rollbackEntry uses, so the book's
 * daily/weekly/history views come up empty for the fresh year. Customer
 * balances are left untouched — a settled customer is already back to zero
 * from repayBaki, and anyone still owing carries that baki into the new
 * book, exactly like the real ritual (this is why it's a soft delete, not a
 * hard wipe: the old book's entries stay around to sync/reconcile, they're
 * just no longer shown as the live ledger). */
export async function startNewYear(): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.entries, async () => {
    const liveEntries = await db.entries.filter(isLive).toArray();
    await db.entries.bulkUpdate(liveEntries.map((e) => ({ key: e.id!, changes: { deletedAt: now } })));
  });
}

export function startOfThisYear(): number {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DailyTotals {
  cashTaka: number;
  creditTaka: number;
  repaidTaka: number;
}

export function computeTotals(entries: LedgerEntry[]): DailyTotals {
  return entries.reduce<DailyTotals>(
    (acc, e) => {
      if (e.type === "cash_sale") acc.cashTaka += e.amountTaka;
      else if (e.type === "credit_sale") acc.creditTaka += e.amountTaka;
      else if (e.type === "repayment") acc.repaidTaka += e.amountTaka;
      return acc;
    },
    { cashTaka: 0, creditTaka: 0, repaidTaka: 0 },
  );
}
