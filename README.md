<p align="center">
  <img src="public/icon-source.svg" width="96" height="96" alt="Haal Khata icon — a red-bound ledger book" />
</p>

<h1 align="center">হাল খাতা — Haal Khata</h1>

<p align="center">
  <strong>Voice-first bookkeeper for Bangladesh's mudi dokans — speaks Bangla,<br />
  English, and Korean, and doesn't depend on an external AI API to work.</strong>
</p>

<p align="center">
  <a href="https://haal-khata.vercel.app"><img alt="Live app" src="https://img.shields.io/badge/live-haal--khata.vercel.app-9e2a2b?style=flat-square" /></a>
  <a href="https://github.com/Srabon-bot/kaist-lalkhata"><img alt="Source" src="https://img.shields.io/badge/source-GitHub-26201a?style=flat-square" /></a>
  <img alt="Voice extraction" src="https://img.shields.io/badge/voice%20extraction-100%25%20local%2C%20zero%20API-2e7d4f?style=flat-square" />
  <img alt="Languages" src="https://img.shields.io/badge/languages-বাংলা%20%C2%B7%20English%20%C2%B7%20한국어-3d5a80?style=flat-square" />
</p>

<p align="center">
  <img src="design/patterns/alpona-border.svg" width="100%" height="14" alt="" />
</p>

> Say a transaction out loud — *"রহিম ভাইকে ৫০ টাকার ডাল বাকি দিলাম"* ("gave
> Rahim bhai 50 taka of lentils on credit") — and it turns into a structured
> ledger entry: customer, item, amount, cash-or-credit. No typing, no forms.

## The tradition

*খাতা* (khata) means ledger; *হাল* (haal) means new, or fresh. For over 430
years, Bengali shopkeepers have closed the old account book and opened a new
one every Pohela Boishakh (Bengali New Year) — bound in red cloth, sturdy and
impossible to quietly alter, which is exactly why customers trusted it.
Customers were invited back not to buy, but to settle their *baki* (credit),
and welcomed with sweets when they did. This app carries that same custom —
and its name — into a shopkeeper's pocket. The full story, including why the
book is bound in red, is one tap away in the app itself ("Why Haal Khata?").

## The problem

~4.5 million mudi dokans operate in Bangladesh; 94% of middle-class
households still shop at them, and 73%+ of sales run on credit (*baki*),
tracked by hand in a paper ledger prone to disputes and lost records. Haal
Khata replaces the pen with a voice, in a format shopkeepers already
recognize.

## How it works

- **Entry:** the browser's own speech recognition turns speech into text,
  client-side — then a local, rule-based extraction engine (no network
  call) turns that transcript into structured JSON (type, customer, item,
  amount, confidence). A confirmation card shows the result before
  anything's saved, editable if anything's off.
- **Fully offline-capable:** because extraction runs entirely on-device,
  voice entry works with no connection at all — not "queues until back
  online," just works. Every device also keeps its own IndexedDB (Dexie)
  copy of the ledger for instant reads/writes.
- **Accounts + sync:** email/password or Google sign-in; a Postgres
  (Neon) database is the account-wide source of truth every device
  reconciles against, so the same khata works across a shopkeeper's phone
  and a helper's phone. Full design in [`PLAN.md`](./PLAN.md).
- **Rollback, not delete:** entries are soft-deleted so a correction on one
  device syncs cleanly to every other device instead of just vanishing.

## Why voice entry doesn't call an AI API

The first working version sent every recording to Gemini (Gemma models for
text, then a direct-audio Gemini model) for transcription and extraction —
and it worked well in testing. Then, mid-demo prep, the live site started
failing with a generic error. Digging into the actual upstream response
turned up the real cause: `gemini-3.5-flash`'s free-tier quota on this
project was a hard **20 requests per day** — not per minute, per *day* —
something no amount of reading the docs beforehand had made obvious, and
normal testing burns through that in minutes. Swapping to a different model
bought a few hours, but it's the same wall a few days out with several
judges each trying the app live.

The actual fix was to stop depending on an external API with a quota at
all for a task that's narrow enough not to need one. Voice entry now runs
on a hand-built local extraction engine (`src/lib/localExtraction.ts` +
`numberWords.ts` + `itemDictionary.ts`): rule-based classification
(credit/repayment/cash, keyed off trigger words like *baki*/외상/"on
credit" in whichever of the three languages was spoken), a from-scratch
number-word parser for each language (Bangla numbers are irregular for
every value 1–99 — no lookup shortcut existed, so there's a full
researched table; Korean currency amounts use Sino-Korean numerals
specifically, composed via the real Unicode Hangul rules), and
position-based name/item extraction tuned to how each language actually
marks those roles grammatically (Bangla কে/থেকে/টাকার postpositions,
English prepositions, Korean particles). It also does typo/mishearing
tolerance (Damerau-Levenshtein-style fuzzy matching, so a mis-transcribed
trigger word like "credti" still classifies correctly), and local
vocabulary correction that snaps a noisy guess to this shop's own past
customer names and items — the offline, zero-network equivalent of the
"keyword boosting" cloud speech APIs sell.

The honest tradeoff: this is pattern-matching, not an LLM, so it's less
forgiving of truly unusual phrasing than Gemini was — the mic screen shows
a short structure hint for exactly that reason. What it trades away in
flexibility, it makes up in reliability: zero quota risk, zero network
dependency, and extraction that's instant instead of waiting on a round
trip. Full writeup of the incident and the fix in
[`RULE_BASED_EXTRACTION_PLAN.md`](./RULE_BASED_EXTRACTION_PLAN.md).

Gemma is still used for one much lower-stakes, lower-volume feature — the
optional weekly insight card (`/api/gemma`, one short observation about
the week's totals) — since that's an occasional call, not one per voice
entry.

## Tech stack

React 19 · TypeScript · Vite · Tailwind · Dexie (IndexedDB) ·
react-router-dom · Neon Postgres · Vercel (Edge Functions + hosting) ·
Gemini API (`gemma-4-26b-a4b-it`, weekly insight card only — voice entry
is 100% local, no AI API in that path)

## Run it locally

```bash
npm install
cp .env.example .env   # GEMINI_API_KEY, DATABASE_URL, SESSION_SECRET
psql $DATABASE_URL -f db/schema.sql
npm run dev             # voice entry works fully here — no API needed
```

`npm run dev` alone is enough for voice entry and the rest of the ledger
UI (a dev-only Vite middleware runs `api/*.ts` in-process). Auth, sync, and
the weekly insight card need real env vars set either way. See
[`PLAN.md`](./PLAN.md) for the full accounts/sync setup.

## Team

Made by **Team 6** — U222, U224, U202.

<p align="center">
  <img src="design/patterns/alpona-border.svg" width="100%" height="14" alt="" />
</p>
