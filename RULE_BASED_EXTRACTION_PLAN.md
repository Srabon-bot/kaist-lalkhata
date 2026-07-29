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
- [x] Researched Bangla number-word system — full irregular 1-99 table in
      `src/lib/numberWords.ts`, cross-checked against multiple sources.
- [x] Researched Korean number-word system — confirmed Sino-Korean (not
      native Korean) is the universal convention for currency amounts.
      Compositional parser in `src/lib/numberWords.ts`.
- [x] Credit-repayment-cash trigger vocabulary in `src/lib/localExtraction.ts`
      (kept the set already validated live against Gemini earlier this
      session, not re-researched from scratch).
- [x] Built `src/lib/itemDictionary.ts` — ~65 common mudi-dokan items,
      bn/en/ko. Out-of-dictionary items fall back to no translation
      (already-existing `displayItem()` behavior, no new code needed there).
- [x] Implemented `extractLocally()` in `src/lib/localExtraction.ts`.
      Per-language positional extraction: Bangla কে/থেকে/টাকার postpositions,
      English to/from/of/for/worth prepositions + gave/sold verb patterns,
      Korean 에게/한테/을/를/가/이 particles (token-based, not a whole-string
      regex — compound names like "라힘 형" need the preceding token, which
      a naive \S+ regex loses across the space).
- [x] Wired into `RecordFlow.tsx` — `extractLocally()` replaces
      `extractFromTranscript`/`extractFromAudio`. `MicRecorder.tsx` reverted
      to `useSpeechRecognition` (browser STT only, no MediaRecorder/audio
      blob needed since nothing sends audio anywhere anymore).
      `useAudioRecorder.ts` deleted (fully superseded). Offline-queue
      machinery (`PendingRecording`, `queuePendingRecording`,
      `queuePendingAudioRecording`, `popOldestPendingRecording`, Layout's
      `online`-event polling) removed — it existed only because extraction
      used to need a network call; local extraction has none, so voice
      entry is now fully offline-capable by default, no special-casing
      needed. `gemmaClient.ts`'s `extractFromTranscript`/`extractFromAudio`
      and `api/gemma.ts`'s `extract`/`extract-audio` modes were left in
      place (unused but functional) as a manual escape hatch beyond the git
      tag, given how much surface area this change touches.
      **Bug found and fixed during wiring**: `SampleChips` (the "try a
      sample" tap-to-fill buttons) previously always sent the Bangla sample
      text regardless of UI language — harmless when Gemini understood any
      language regardless of the hint, but would have silently broken
      extraction under the new per-language rule engine (Bangla text run
      through English-language rules). Now sends `dict[key][lang]`.
- [x] Tested extensively — first an isolated number-word test (18/18 after
      fixing two real bugs: a Bangla "দুই হাজার" thousand-multiplier bug, and
      a Korean place-value double-counting bug), then a full extraction
      test against all 9 of the app's actual built-in sample sentences (3
      types × 3 languages) plus additional phrasings — found and fixed 5
      more real bugs (Bangla "থেকে" self-matching its own কে-suffix check, a
      Unicode vowel-form mismatch এ vs ে in the possessive-suffix regex,
      missing ৳-symbol-fused amount parsing, and Korean compound names
      losing their first word to non-greedy-regex-across-a-space). Ended at
      11/11 passing including all real sample sentences.
- [x] Typecheck/build/lint clean throughout.
- [x] Live browser smoke test: all 9 real sample sentences (not just the
      unit tests) verified correct in an actual running instance — tapped
      every sample chip in all three UI languages, confirmed the resulting
      ConfirmationCard fields, confirmed extraction is now visually instant
      (no parsing spinner — it's synchronous, no network round trip),
      confirmed item-translation-on-language-switch still works correctly
      end-to-end with the new pipeline, confirmed zero console errors.
- [x] 2026-07-28: Real bug found via live use (screenshot): "সালমা ৪০০
      টাকার আটা কিনলা" (a cash sale with a bare leading customer name, no
      কে/থেকে marker) correctly extracted item+amount but left customer
      null — the leading-name fallback existed but was wrongly scoped to
      repayment only. Generalized it in all three languages (Bangla/Korean:
      safe to take "everything before the amount" given their particle-
      marked, largely head-final grammar; English needed a narrower verb-
      anchored version instead — English word order puts a verb+object
      between subject and amount, so blindly taking "everything before the
      amount" would have swallowed the verb/object too). Added 4 regression
      cases (the exact failing sentence + its English/Korean analogues +
      an anonymous-cash-sale case to confirm no false-positive) — 15/15
      passing.
- [x] 2026-07-28: Added a short structure-hint line to the mic sheet's idle
      state (`mic.structureHint` in i18n.tsx) — "say the name first, then
      the amount and item," localized bn/en/ko. Since this is pattern-
      matching rather than an LLM, phrasing that roughly follows this order
      extracts far more reliably; worth surfacing that to the user
      proactively rather than only after a misfire.
- [x] 2026-07-28: Robustness pass — researched typo/ASR-error tolerance
      techniques for rule-based extraction (Damerau-Levenshtein fuzzy
      matching is the standard approach; confirmed via search, not just
      assumed) and combined that with a systematic self-audit of the
      engine's known-brittle spots. Found and fixed 7 more real bugs:
      1. **Bangla compound numbers**: "এক হাজার দুইশ পঞ্চাশ" (1250) came
         back as 250 — the amount parser returned on the first
         magnitude-word match instead of chaining thousand+hundred+
         remainder. Restructured into `parseBnSubThousand()` + a
         thousand-level wrapper in `numberWords.ts`.
      2. **Bangla কে-suffix false positives, generalized**: not just থেকে —
         "আজকে" (today) and Bangla pronouns ("তাকে"=him/her, "আমাকে"=me,
         etc.) all coincidentally end in the same কে dative marker used
         for names. Was a one-off exclusion for থেকে; turned into a real
         stoplist (`BN_NON_NAME_KE_WORDS`) after confirming the failure
         mode wasn't থেকে-specific.
      3. **Filler words polluting the "leading name" fallback**: "আজকে
         সালমা কিনলো"/"So Karim bought..." both included the filler word
         in the customer field. Added `LEADING_FILLERS` (bn/en/ko) that
         trims known discourse/time words (and, for Bangla, reuses the
         পronoun stoplist from #2) before taking the leading span.
      4. **English trigger words didn't match inflections**: exact `\bword\b`
         boundary matching missed "credited"/"owes" (word-boundary
         requires the match to END right at the trigger, not just start
         there). Switched English trigger matching to per-token prefix
         matching.
      5. **No typo/mishearing tolerance at all**: added a Damerau-
         Levenshtein-lite fallback (`withinEditDistance1` — handles
         substitution, insertion/deletion, AND adjacent transposition,
         e.g. "credti") as a last-resort tier after exact/prefix matching,
         for Bangla and English (skipped for Korean — its particles attach
         to larger tokens without spaces, so whole-token edit-distance
         doesn't apply the same way there).
      6. **"owes" missing from the English customer-fallback verb list**:
         "Rahim owes 300 taka for oil" is an entirely ordinary way to
         state a credit sale; added to the verb-anchor list alongside
         bought/sold/gave/etc.
      Added 6 new regression cases covering all of these — 21/21 extraction
      cases and 20/20 number-word cases passing after the fixes.
      **Known, accepted remaining limitation**: one adversarial case I
      constructed myself ("Gave Karim ৳200 of rice, credited to his
      account" — an unrelated trailing "to" clause preempts the more
      specific "Gave NAME" pattern) is not fixed. It's contrived, not from
      real reported use, and a targeted fix risked destabilizing the
      already-tuned branch-priority logic for real cases — documented here
      rather than chased. This is the honest shape of "foolproof" for a
      pattern-matching engine: meaningfully hardened against real failure
      modes, not literally immune to every possible phrasing.
- [x] Committed and pushed (see git log — `b2ffab1` and follow-ups).
- [x] 2026-07-29: Resolved the open "delete or leave as unused fallback"
      question from the Approach section above, during a repo cleanup pass —
      deleted. `gemmaClient.ts`'s `extractFromTranscript`/`extractFromAudio`,
      `prompt.ts`'s `buildExtractionPrompt`/`buildAudioExtractionPrompt`, and
      `api/gemma.ts`'s `extract`/`extract-audio` modes were confirmed unused
      (grepped, zero call sites beyond their own definitions) and removed.
      `api/gemma.ts` is insight-mode-only now. Typecheck/build clean;
      production JS bundle dropped ~561KB → ~497KB.
