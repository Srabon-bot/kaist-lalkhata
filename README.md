# হাল খাতা — Haal Khata

**Voice-first bookkeeper for Bangladesh's mudi dokans, built with Gemma.**

Say a transaction out loud — "রহিম ভাইকে ৫০ টাকার ডাল বাকি দিলাম" (*gave Rahim
bhai 50 taka of lentils on credit*) — and Gemma turns it into a structured
ledger entry: customer, item, amount, cash-or-credit. No typing, no forms.

**Live app:** https://haal-khata.vercel.app

## Why

~4.5 million mudi dokans operate in Bangladesh; 94% of middle-class
households still shop at them, and 73%+ of sales run on credit (*baki*),
tracked by hand in a paper ledger prone to disputes and lost records. Haal
Khata replaces the pen with a voice, in a format shopkeepers already
recognize — see the in-app "Why Haal Khata?" story for the 430-year-old
tradition it's named after.

## How it works

- **Entry:** browser speech-to-text → transcript sent to a Gemma proxy
  (`/api/gemma`, Vercel Edge Function) → structured JSON (type, customer,
  item, amount, confidence) → a confirmation card before anything's saved.
- **Offline-first:** every device keeps its own IndexedDB (Dexie) copy —
  instant reads/writes, fully usable with no connection.
- **Accounts + sync:** email/password or Google sign-in; a Postgres
  (Neon) database is the account-wide source of truth every device
  reconciles against, so the same khata works across a shopkeeper's phone
  and a helper's phone. Full design in [`PLAN.md`](./PLAN.md).
- **Rollback, not delete:** entries are soft-deleted so a correction on one
  device syncs cleanly to every other device instead of just vanishing.

## Known limitation

`gemma-4-26b-a4b-it` is a "thinking" model — internal reasoning pushes
latency to 15–26s, and Vercel's Edge Runtime caps execution at ~25s, so
the slowest requests occasionally time out and ask the user to retry.
Platform/model constraint, not a bug — retrying almost always succeeds.

## Tech stack

React 19 · TypeScript · Vite · Tailwind · Dexie (IndexedDB) ·
react-router-dom · Neon Postgres · Vercel (Edge Functions + hosting) ·
Gemini API (`gemma-4-26b-a4b-it`)

## Run it locally

```bash
npm install
cp .env.example .env   # GEMINI_API_KEY, DATABASE_URL, SESSION_SECRET
psql $DATABASE_URL -f db/schema.sql
vercel dev              # app + /api/* routes together
```

`npm run dev` also works for UI-only work, but `/api/*` (auth, sync,
Gemma) only run under `vercel dev`. See [`PLAN.md`](./PLAN.md) for the
full accounts/sync setup.

## Team

Made by **Team 6** — U222, U224, U202.
