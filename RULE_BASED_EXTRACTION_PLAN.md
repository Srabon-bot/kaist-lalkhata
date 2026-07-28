# Rule-based extraction: replacing Gemini for voice entry

**Status: research phase, not started implementing.** This doc exists so a
new session (or a different person) can pick this up with full context —
update the Status section at the bottom as work progresses.

## Why

The app's voice-entry pipeline sent every recording to Gemini/Gemma for
transcription + extraction. On 2026-07-28, the live site started returning
"সাময়িক সমস্যা হয়েছে" (server error) mid-demo. Root cause: `gemini-3.5-flash`'s
free-tier quota on this project is a hard **20 requests/day**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, `quotaValue: "20"`) —
not per-minute, per-day. Normal testing burns through that in minutes.

Emergency fix already shipped (commit `7698bc2`): switched
`GEMINI_AUDIO_MODEL` to `gemini-3.6-flash` (separate, untouched quota) and
dropped a `thinkingConfig` optimization that broke on the new model. That
fix is live and confirmed working — see git tag `pre-rule-based-extraction`
on that commit for the rollback point if the work described in this doc
doesn't pan out.

But swapping models just moves the same wall a few days down the road with
4-5 judges hitting it live. The actual fix: **stop depending on an external
API with a quota at all** for the core extraction task, which is narrow
and templated enough to not need an LLM.

## Rollback

```
git reset --hard pre-rule-based-extraction   # or: git checkout pre-rule-based-extraction
```

That tag points at the last known-good, fully-Gemini-based state (audio →
`gemini-3.6-flash`, text → `gemma-4-26b-a4b-it`, both confirmed working live
on 2026-07-28). If the rule-based parser isn't accurate enough by demo time,
revert to this tag and you're back to a working (if quota-fragile) app.
There's also an earlier tag, `pre-stt-experiment`, from before the
direct-Gemini-audio experiment even started, if a deeper revert is ever
needed.

## Scope (decided 2026-07-28)

- **Full replace**, not a fallback: a local rule-based parser handles
  classification + field extraction for every voice entry, no Gemini/Gemini
  call in that path at all.
- **Audio input stays** — the browser's built-in Web Speech API
  (`SpeechRecognition`/`webkitSpeechRecognition`) still does speech-to-text
  client-side, same as the app's original pre-Gemini-audio design. It's
  free, unlimited under normal use, and not tied to any API key/quota of
  ours. The resulting transcript is what the new local parser reads —
  **no MediaRecorder raw-audio capture or Gemini audio call is needed for
  extraction anymore.**
- Runs **entirely client-side** in the browser (no `/api/gemma` round trip
  for extraction) — faster than any API call, zero network dependency for
  this step, zero quota risk full stop.
- `buildInsightPrompt` (the weekly one-sentence insight card) is **out of
  scope for this pivot** — still calls Gemma. Revisit separately if it also
  becomes a quota risk; it's a much lower-volume call (once per week view,
  not once per voice entry).

## What the parser has to do

Given a transcript (Bangla, English, or Korean — never mixed, per the
existing "no Banglish" language rule already in `buildExtractionPrompt`),
produce the same shape `ExtractionResultSchema` already expects
(`src/lib/schema.ts`) — `type`, `customer`, `item`, `item_translations`,
`amount_taka`, `confidence`, `transcript` — so nothing downstream
(`ConfirmationCard`, `db.ts`, `LedgerRow`/`displayItem`) needs to change.

Sub-tasks, in order of how load-bearing they are:

1. **Classification** (repayment > credit > cash > unclear) — already have
   a solid trigger-word list from the current prompts (see
   `src/lib/prompt.ts`): বাকি/baki, credit/due/owes, 외상 for credit;
   শোধ/joma dilo, repaid/paid back/settled, 갚다 for repayment. Needs
   verification this list is actually complete/idiomatic per language, not
   just what an LLM prompt happened to mention.
2. **Amount extraction** — digits are easy; spoken number-words are the
   hard part in all three languages (এবং Bangla and Korean both have
   irregular/compound number words, see Research below). Needs a proper
   word-to-integer parser per language, not just a lookup table for 1-10.
3. **Customer name extraction** — position-based off known sentence
   patterns (e.g. Bangla "X-কে Y টাকার Z বাকি দিলাম" → X is before কে).
   Proper nouns are open-vocabulary, so this can't be a dictionary lookup —
   needs to be "whatever token(s) sit in the customer slot of a matched
   pattern," with graceful degradation (null customer, lower confidence) if
   no pattern matches confidently.
4. **Item extraction** — same positional approach. Unlike customer names,
   items are a much smaller closed-ish vocabulary for a corner shop (rice,
   egg, milk, oil, sugar, flour, soap, ...) — worth an actual dictionary.
5. **item_translations** — this is the part that most needs a real answer
   before implementing: with no translation API call available, cross-
   language item display (bn/en/ko) for an item outside a local dictionary
   has no clean solution. Plan: ship a dictionary of common shop items
   (~50-100 entries) covering bn/en/ko; items not in it just don't get a
   translation (falls back to displaying the original word as-is in every
   language, which `displayItem()` in `src/lib/db.ts` already does for
   entries with `itemTranslations: null` — no code change needed there).
6. **Confidence** — no probabilistic model, so this becomes a heuristic:
   e.g. 1.0 when a full pattern matched cleanly, lower (below
   `CONFIDENCE_FLAG_THRESHOLD` in `src/config.ts`, currently 0.7) when a
   field was found via a looser fallback rule, so the existing amber-flag
   UI in `ConfirmationCard` still does something useful.

## Research needed before writing rules (not done yet)

- **Bangla numbers**: native Bangla number words for at least 1-99 plus
  common round hundreds/thousands (২০=বিশ, ৫০=পঞ্চাশ, etc.) — needs to be an
  actual verified list, not half-remembered. Bangla money amounts are
  usually round numbers (multiples of 5/10) in casual shop speech, which
  narrows the practical vocabulary somewhat.
- **Korean numbers**: Korean has two full numeral systems — native Korean
  (하나, 둘, 셋...) and Sino-Korean (일, 이, 삼...). Currency amounts
  (원/타카 here) conventionally use **Sino-Korean**, not native Korean —
  needs confirming this holds for however Korean speakers in this app
  actually phrase taka amounts, and building the word list for the correct
  system (likely Sino-Korean, with its own irregularities at 10/100/1000
  boundaries).
- **English numbers**: most straightforward of the three (regular
  compounding: "two hundred", "fifty"), lowest research risk.
- Cross-check the credit/repayment/cash trigger-word lists against real
  usage, not just what fit naturally into an LLM prompt — e.g. are there
  more common Bangla phrasings for "on credit" beyond বাকি? Common Korean
  shopkeeper phrasings beyond 외상?

## Architecture plan (not implemented yet)

- New file, likely `src/lib/localExtraction.ts`: a pure function
  `extractLocally(transcript: string, lang: Lang): ExtractionResult`.
- Wire into `RecordFlow.tsx`'s `runTextExtraction`/`runAudioExtraction` (or
  a consolidated single path, since audio-to-Gemini goes away and both
  sample-chip taps and real recordings converge on "have transcript text,
  need extraction") in place of the `extractFromTranscript`/`extractFromAudio`
  Gemini calls.
- `useAudioRecorder.ts`'s MediaRecorder half becomes unnecessary for
  extraction — likely revert to (or merge back toward) the original
  `useSpeechRecognition.ts` hook shape, since there's no more audio blob to
  send anywhere. Needs deciding whether to delete the MediaRecorder path or
  leave it dormant.
- `api/gemma.ts`'s `extract`/`extract-audio` modes become dead code for the
  voice-entry flow specifically (keep `insight` mode, since that's staying
  on Gemma) — decide whether to delete or leave as an unused fallback.

## Status

- [x] 2026-07-28: Emergency model-swap fix shipped and verified live
      (commit `7698bc2`).
- [x] 2026-07-28: Rollback tag `pre-rule-based-extraction` created and
      pushed, pointing at `7698bc2`.
- [x] 2026-07-28: This doc written.
- [ ] Research Bangla number-word system (verify, don't guess).
- [ ] Research Korean number-word system (verify Sino-Korean vs native for
      currency, don't guess).
- [ ] Verify/expand credit-repayment-cash trigger vocabulary per language.
- [ ] Build common-shop-item translation dictionary (bn/en/ko).
- [ ] Implement `extractLocally()`.
- [ ] Wire into `RecordFlow.tsx`, remove/replace Gemini calls in that path.
- [ ] Test against a real spread of phrasings per language (not just the
      handful of sample sentences already in the app).
- [ ] Typecheck/build/lint clean.
- [ ] Live browser smoke test.
- [ ] Get explicit go-ahead before committing/pushing (per the "make it
      revertable, test before shipping" instruction this doc was created
      under).
