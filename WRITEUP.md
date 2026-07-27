## Problem Statement

In Bangladesh, about 4.5 million mudi dokans — neighborhood grocery shops — are the backbone of everyday retail. 94% of middle-class and affluent households still do most of their grocery shopping at one. And critically: more than 73% of what these shops sell goes out on credit, not cash. Shopkeepers track this credit — *baki* — the same way they have for generations: a red cloth-bound paper ledger, the *lal khata*, filled in by hand in a mix of Bangla and Banglish shorthand.

That system works, but it's fragile. Pages get lost or damaged. Handwriting gets illegible under pressure during a busy afternoon. Disputes happen when a customer and shopkeeper remember a debt differently and there's no clean record to settle it. And a real, underappreciated barrier: many shopkeepers, and especially the helpers and family members who often run the counter, are far more comfortable *speaking* than *typing*. A typing-first "digital khata" app — and at least one already exists (Baki.bd) — doesn't solve that last problem. It just moves the same friction onto a smaller keyboard.

## Solution Overview

**Lal Khata** lets a shopkeeper speak a transaction the way they'd naturally say it out loud — *"রহিম ভাইকে ৫০ টাকার ডাল বাকি দিলাম"* ("gave Rahim bhai 50 taka of lentils on credit") — and turns it directly into a structured ledger entry: customer, item, amount, cash-or-credit. No typing, no forms, no menus to learn.

The core loop is deliberately fast: tap the one large mic button, speak, review a confirmation card that shows exactly what was understood (with uncertain fields visually flagged), tap confirm. The entry animates into today's ledger and the running totals update immediately. That loop has to be faster than writing in the paper khata — that's the entire product promise.

Everything else — customer credit pages, daily and weekly summaries, a spoken audio recap of the day, CSV export — hangs off that one loop.

## How Gemma Is Used (and Why)

Gemma is the component doing the actual understanding in this app: turning a messy, mixed-language spoken transcript into typed, confident ledger data. The extraction prompt is strict — return only a fixed JSON schema (`type`, `customer`, `item`, `amount_taka`, per-field `confidence`, `transcript`), never invent an amount that wasn't said, and use `"unclear"` rather than guessing when the input doesn't describe a transaction at all.

**A real finding worth sharing:** the project was originally scoped around `gemma-3n-e2b/e4b-it`, the audio-native Gemma line, so a spoken clip could go to Gemma directly. Testing live against the Gemini API on this project's key showed those models are no longer served at all, and the Gemma models that *are* available (`gemma-4-26b-a4b-it`, `gemma-4-31b-it`) return `"Audio input modality is not enabled for this model"` for any audio payload — an account/API-level gate, not something fixable in application code. Rather than quietly drop Gemma or swap in a different model family (which would risk violating the "Gemma as a core component" requirement), Lal Khata now transcribes speech client-side with the browser's built-in `SpeechRecognition` API and sends the resulting text to Gemma for the structured extraction. Gemma still does the hard part — audio-to-text is comparatively commodity technology; text-to-typed-ledger-JSON-with-confidence-scores from ambiguous, code-mixed speech is not.

A second, independent use of Gemma powers a **weekly insight card**: the app's already-computed totals for the week (cash sales, credit given, credit repaid, top outstanding customers) are sent to Gemma, which writes one short, concrete Bangla observation — e.g. *"এই সপ্তাহে ৩০০ টাকা বাকি দেওয়ার তুলনায় মাত্র ১০০ টাকা আদায় হয়েছে, তাই রহিম ভাইয়ের ২০০ টাকা বাকিের দিকে একটু নজর দিন"* ("against ৳300 given on credit this week, only ৳100 was recovered — keep an eye on Rahim bhai's ৳200 balance"). This is a second, meaningfully different task for the same model, not a duplicate call.

One more practical lesson: `gemma-4-26b-a4b-it` is a "thinking" model — it spends real token budget on internal reasoning before producing its final answer (confirmed `thinkingConfig.thinkingBudget: 0` is rejected — thinking can't be disabled on this model). That pushed real measured latency to 15–26 seconds and required raising `maxOutputTokens` so the JSON answer isn't truncated behind the reasoning tokens, and filtering the API response for `thought: true` parts so the app never accidentally surfaces raw chain-of-thought as the answer.

## Technical Architecture

```
Browser (React + Vite + Tailwind, anime.js)
  Web Speech API → transcript → /api/gemma (Vercel Edge Function)
                                     → Gemini API (gemma-4-26b-a4b-it)
                                     → structured ledger JSON
  Confirmation card → IndexedDB (Dexie) → Ledger / Customers / Summary UI
```

- **Speech capture:** browser-native `SpeechRecognition`, Bangla locale, with a live interim transcript shown while listening and a 28-second cap per utterance.
- **Extraction:** one Gemma call per utterance with the strict-JSON prompt above; a retry-with-repair pass if the first output isn't valid JSON.
- **Storage:** IndexedDB only, entirely on-device. There is no backend database and no account system — the Sign up / Log in flow (a real form, for a familiar first impression) stores only a display name locally and transmits nothing.
- **Key handling:** `GEMINI_API_KEY` is read only inside a serverless proxy (`api/gemma.ts`); the browser never talks to `generativelanguage.googleapis.com` directly, and the key is never present in any committed file.
- **Design:** every visual choice is derived from the physical lal khata — the red cloth cover, ruled ledger paper, taka amounts set as the hero typography — down to a first-load animation where the cover literally opens like a book to reveal the app.

## Impact & Validation

Ten test utterances were run against the live production endpoint, covering credit sales, cash sales, repayments, Banglish-mixed speech, and one deliberately off-topic sentence to check the "unclear" path:

| Result | Count |
|---|---|
| Utterances that eventually parsed successfully | 10 / 10 |
| — succeeded on the first attempt | 9 / 10 |
| — needed one retry (hit the timeout below) | 1 / 10 |
| Field-level accuracy (type, customer, item, amount) | 36 / 37 (97%) |

Every transaction type was classified correctly, no amount was ever invented, and the one off-topic sentence was correctly returned as `"unclear"` rather than forced into a fake transaction. The single field miss: one item name ("তেল" / oil) came back translated into English rather than kept in the original Bangla on a retried request — everything else, across every case, was exact.

## Limitations & Future Work

- **Latency on the slowest requests.** Vercel's Edge Runtime enforces a non-configurable ~25-second execution ceiling, and this Gemma model's thinking overhead occasionally brushes against it. A retry (built into the error state's UI) resolves it every time it was tested, but it's a real, honest limitation worth naming rather than hiding.
- **One utterance, one transaction.** The current design intentionally handles one spoken transaction per recording — matching the PRD's "10-second transaction" philosophy and keeping extraction accuracy high — rather than trying to segment multiple transactions out of a single long recording.
- **Speech recognition is Chrome/Android-first,** matching the primary device reality for this user (low-to-mid Android phones), but not universal across all browsers.
- **Future work:** regional dialect testing at larger scale, a Bangla SMS baki-reminder generator (drafted by Gemma), and revisiting Gemma-native audio input the moment it's enabled for this project's models — removing the browser-STT step entirely.

## Links

- 🔴 Live app: https://lal-khata.vercel.app
- 📦 GitHub: https://github.com/Srabon-bot/Lal-khata
- 📓 Notebook: _add link_
- 🎬 Video: _add link_
