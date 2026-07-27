# Haal Khata — auth + cross-device sync

How accounts, sessions, and ledger sync fit together. Referenced from
comments across `db/schema.sql`, `src/lib/db.ts`, `src/lib/sync.ts`,
`src/lib/api.ts`, `src/components/AuthModal.tsx`, and `api/**`.

## Why

The app started fully local (Dexie/IndexedDB only, one device, no login).
Shopkeepers wanted the same khata on a second phone, which local-only
storage can't do — this adds a real account (email/password or Google) and
a Postgres-backed ledger that every device syncs against, while keeping
the app fully usable offline on any single device.

## Accounts

`db/schema.sql` — one `accounts` table, `provider` is `'password'` or
`'google'`:

- Password accounts store `password_hash` + `password_salt` (PBKDF2-SHA256,
  100k iterations, `src/lib/passwordHash.ts`). Hashing happens server-side
  only (`api/auth/signup.ts`, `login.ts`) — the client sends the raw
  password over HTTPS and nothing else; `src/lib/passwordStrength.ts` is a
  client-side UX gate only, re-checked server-side since a request can
  bypass the UI.
- Google accounts store `google_sub`, no password fields. The client gets
  an OAuth access token via Google Identity Services
  (`src/lib/googleAuth.ts`, token-client popup flow, no client secret
  needed) and sends *only the token* to `api/auth/google.ts`, which
  independently calls Google's userinfo endpoint (`api/_google.ts`) to
  resolve the real email/sub — the client's claims are never trusted
  directly.
- Signup, login, and Google all resolve to the same shape: create/find the
  `accounts` row, mint a session, return `{ accountId, email, displayName,
  isNew, suggestedName? }`. `isNew` (or a missing `displayName`) tells
  `WelcomePage` to show `UsernameModal` before entering the app; a
  returning account skips straight in.

## Sessions

Stateless signed cookies (`api/_session.ts`) — no session table. An
HMAC-SHA256-signed `{ accountId, exp }` payload (Web Crypto, `SESSION_SECRET`
env var), stored as an `HttpOnly`, `SameSite=Lax`, 30-day cookie
(`hk_session`). Every `src/lib/api.ts` call sends `credentials: "include"`
so it round-trips automatically; `GET /api/auth/session` is how the app
would check "is there already a valid cookie" (e.g. on load), and
`POST /api/auth/logout` clears it. Trades server-side revocation for zero
extra DB round-trips per request — acceptable at this app's scale.

Local device gating (`ENTERED_KEY`/`SHOP_NAME_KEY`/`ACCOUNT_ID_KEY` in
`localStorage`, see `WelcomePage.tsx`/`App.tsx`) is separate from the
session cookie: it's what lets a device skip the welcome page on repeat
visits without hitting the network at all. The cookie is what makes a
*second* device's login work like a real "welcome back" instead of a
fresh signup.

## Ledger sync

Each device keeps its own Dexie/IndexedDB copy for instant, offline-first
reads and writes (`src/lib/db.ts`); the server (`db/schema.sql` `customers`
+ `entries` tables) is the account-wide source of truth every device
reconciles against via `api/sync.ts` and `src/lib/sync.ts`.

**Identity.** Every `LedgerEntry`/`Customer` has both a local Dexie
auto-increment `id` (never leaves the device) and a client-generated
`uuid` (`crypto.randomUUID()`, stable across devices). The server's tables
use that `uuid` as their real primary key — a device can create a row
fully offline and it merges cleanly on next sync, no round-trip needed to
mint an id.

**Deletes.** `rollbackEntry` never hard-deletes; it sets `deletedAt` and
keeps the row (`isLive()` filters it out of every read path — Khata,
History, Summary, CustomerDetail all use it). A hard local delete would
leave nothing to sync as a tombstone to the account's other devices.

**Balances.** `Customer.balanceTaka` is a derived cache, recomputed
client-side from that customer's live entries after every merge — never
synced or treated as a conflict-prone field in its own right
(`pullFromServer` in `sync.ts`).

**Customer identity conflicts.** The server keys customers by
`(account_id, normalized_name)`, not by the client's proposed `uuid` — if
two devices independently create "Rahim" while both offline, they resolve
to one server row on push, and `api/sync.ts`'s `push()` returns a
`customerIdMap` so the pushing device can reconcile its own local row
against the id that "won."

**Push** (`POST /api/sync`, `pushToServer`/`pushToServerBeacon`): sends
every local entry/customer, upserted (`ON CONFLICT ... DO UPDATE`) —
idempotent, so re-sending unmerged rows after a dropped connection is
safe. Entries are otherwise immutable once created; the only field a later
push can legitimately change is `deletedAt` (a rollback).

**Pull** (`GET /api/sync`, `pullFromServer`): fetches the account's full
ledger — a full snapshot beats incremental diffing in complexity at this
app's expected size (a single shop's khata) — and merges it into Dexie,
then recomputes every customer's `balanceTaka` from the merged, live
entries.

**Lifecycle** (`initSync()`, wired into `Layout.tsx` since it only mounts
once a session has entered):
- On mount, if online: pull then push (`syncNow`).
- On the `online` event (reconnect after an offline spell): `syncNow`
  again.
- On `visibilitychange` (tab hidden): push only — no need to pull just to
  go to the background.
- On `pagehide` (tab actually closing): `navigator.sendBeacon`, built from
  a synchronous in-memory mirror (`liveQuery` subscriptions kept live for
  the tab's lifetime) rather than a fresh async IndexedDB read the unload
  could outrun.
- Disposed (listeners removed) on logout, which also clears the session
  cookie (`Layout.handleClosed` → `POST /api/auth/logout`).

## Setup

1. `psql $DATABASE_URL -f db/schema.sql` against a fresh Neon database (or
   the Neon SQL Editor) — idempotent, safe to re-run.
2. Env vars: `DATABASE_URL` (Neon connection string), `SESSION_SECRET`
   (any random string, signs session cookies) — both server-only, not
   `VITE_`-prefixed. `VITE_GOOGLE_CLIENT_ID` is optional; without it the
   Google button shows a "not set up yet" message instead of failing.
3. All `api/**` routes run on Vercel's Edge runtime (`export const config
   = { runtime: "edge" }`) — Web Crypto and `@neondatabase/serverless`'s
   HTTP driver both work there without a persistent connection to manage.
