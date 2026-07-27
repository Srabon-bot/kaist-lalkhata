-- Haal Khata — server-side schema (Neon Postgres)
--
-- Run this once against a fresh database (Neon SQL Editor, or `psql
-- $DATABASE_URL -f db/schema.sql`) before the auth/sync API routes will
-- work. Safe to re-run — every statement is idempotent.
--
-- Design notes:
--  - entries/customers use client-generated UUID primary keys (not
--    serial/identity) so a device can create a row offline and it merges
--    cleanly with every other device's rows on next sync, no server
--    round-trip needed to mint an id.
--  - created_at/updated_at stay epoch-ms BIGINT, matching the client's
--    existing Date.now() convention exactly (see src/lib/db.ts) — avoids
--    any timezone/precision translation between client and server.
--  - entries are soft-deleted (deleted_at set, row kept) rather than
--    hard-deleted, so a "roll back" on one device has something to sync
--    to every other device. Hard-deleting would just make the row
--    reappear on next pull from a device that already has it.
--  - balance_taka on customers is a cache, recomputed client-side from
--    synced entries after every merge — it is not treated as a
--    conflict-prone field in its own right.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  normalized_email TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL CHECK (provider IN ('password', 'google')),
  password_hash TEXT,
  password_salt TEXT,
  google_sub TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS customers_account_idx ON customers (account_id);

CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit_sale', 'cash_sale', 'repayment')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  item TEXT,
  amount_taka NUMERIC NOT NULL,
  created_at BIGINT NOT NULL,
  confidence JSONB,
  transcript TEXT,
  edited BOOLEAN NOT NULL DEFAULT false,
  deleted_at BIGINT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entries_account_idx ON entries (account_id);
CREATE INDEX IF NOT EXISTS entries_account_created_idx ON entries (account_id, created_at);
