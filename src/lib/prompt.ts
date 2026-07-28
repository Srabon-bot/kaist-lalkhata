// PRD §7 — extraction prompt. Runs on a browser-transcribed text transcript
// (Web Speech API), not raw audio: the Gemini API's Gemma models available to
// this project's key don't have audio input enabled (verified against the
// live API — gemma-3n-e2b/e4b-it, the audio-native variants the original
// spec targeted, are no longer served at all). Gemma still does the actual
// understanding: turning a messy Bangla/English/Korean transcript into typed
// ledger JSON with per-field confidence is the hard part, not the STT.
export function buildExtractionPrompt(transcript: string): string {
  return `You convert a transcript of a Bangladeshi shopkeeper's spoken words into ledger JSON.
The app's voice entry supports exactly three languages: Bangla, English, and Korean — the
transcript will be in one of these (never a Bangla/English code-switched mix), and may contain
minor speech-recognition errors — read past small mistakes rather than treating them as unclear.
Do not treat a non-Bangla transcript as garbled or invalid; extract the same fields regardless of
which supported language it's in. Common patterns (written here phonetically in Latin script for
readability only — real Bangla speech transcribes in Bangla script; the same semantic pattern
applies in English or Korean):
- "X ke Y takar Z baki dilam"  → credit sale to customer X
- "X Y taka joma dilo / shodh korlo" → customer X repaid Y taka
- "Y takar Z bikri" (no name) → cash sale
Numbers may be spoken as words (পঞ্চাশ = 50, 오십 = 50) or digits.
Classification rule — check in this order, in ANY supported language (the trigger words matter,
not which language they're spoken in):
1. Repayment: speech uses any word for repaying/settling a due amount — e.g. "শোধ"/"shodh",
   "জমা দিলো"/"joma dilo" (Bangla), "repaid" / "paid back" / "settled" (English), "갚다"/"gapda"
   (Korean) — classify as repayment.
2. Credit: else, speech uses any word for credit/due/on-account — e.g. "বাকি"/"baki" (Bangla),
   "credit" / "due" / "on credit" / "owes" (English), "외상" (Korean) — classify as credit_sale.
3. Cash: otherwise — a normal sale with no due/repayment language — classify as cash_sale. This
   is the default when neither trigger is present.

Transcript: """${transcript}"""

Return ONLY valid JSON, no markdown, no explanation:
{
 "type": "credit_sale" | "cash_sale" | "repayment" | "unclear",
 "customer": string | null,
 "item": string | null,
 "item_translations": { "bn": string | null, "en": string | null, "ko": string | null } | null,
 "amount_taka": number | null,
 "confidence": { "customer": 0-1, "item": 0-1, "amount": 0-1 },
 "transcript": string
}
If any field is not stated, use null. Never invent an amount.
item_translations: when item is non-null, translate the item itself (not the customer name) into
all three supported languages — e.g. item "চাল" → { "bn": "চাল", "en": "rice", "ko": "쌀" }. Use
null for item_translations only when item itself is null.
If the transcript is empty, nonsensical, or unrelated to a shop transaction, use type "unclear".`;
}

export const REPAIR_SUFFIX =
  "\n\nYour last output was invalid JSON. Return only the JSON object, no markdown fences, no explanation.";

// Hybrid: direct-audio variant of buildExtractionPrompt. Sent alongside an
// inlineData audio part instead of a pre-transcribed string — the model
// listens to the recording itself (Gemini's own transcription, not the
// browser's Web Speech API) and extracts in the same pass. `langHint` is the
// app's current UI language, used only to nudge disambiguation, never to
// reject audio spoken in a different supported language. `transcriptHint` is
// the browser's own live SpeechRecognition transcript of the same audio
// (see useAudioRecorder.ts) — offered only as a rough clue, since it can be
// wrong or garbled; the audio is what's actually authoritative.
//
// No JSON-shape description or "return only JSON" instruction here — the
// proxy sets responseMimeType/responseSchema on this call instead, so the
// model doesn't spend output tokens re-deriving field names or wrapping the
// answer in markdown fences. Also runs with thinkingConfig.thinkingBudget=0
// (verified live: gemini-3.5-flash accepts it, unlike the Gemma models,
// which reject thinkingConfig outright) — measured 303 thought tokens on a
// simple extraction with thinking left on vs. 0 with it off, no accuracy
// difference on the cases tested. Same domain instructions as
// buildExtractionPrompt otherwise; this is the one part schema can't cover.
export function buildAudioExtractionPrompt(langHint: string, transcriptHint: string | null): string {
  const hintBlock = transcriptHint
    ? `\nA rough, possibly-inaccurate live transcript of this same audio, captured client-side, is
provided only as a disambiguation clue — trust what you actually hear over this if they differ,
and don't just copy it into the transcript field: "${transcriptHint}"\n`
    : "";
  return `You listen to a short audio recording of a Bangladeshi shopkeeper speaking, and extract a
ledger entry. Voice entry supports exactly three languages: Bangla, English, and Korean — the
speech will be in one of these (never a Bangla/English code-switched mix), and may include
background noise or a shaky mic — listen past small acoustic imperfections rather than treating
them as unclear. Do not treat a non-Bangla utterance as invalid; extract the same fields regardless
of which supported language it's in. The speaker's UI is currently set to "${langHint}" — a hint
for disambiguation only, not a constraint on what language they actually spoke. Patterns (written
here phonetically in Latin script for readability only — real Bangla speech transcribes in Bangla
script; the same semantic pattern applies in English or Korean):
- "X ke Y takar Z baki dilam"  → credit sale to customer X
- "X Y taka joma dilo / shodh korlo" → customer X repaid Y taka
- "Y takar Z bikri" (no name) → cash sale
Numbers may be spoken as words (পঞ্চাশ = 50, 오십 = 50) or digits. Never invent an amount. If the
audio is empty, silent, unintelligible, or unrelated to a shop transaction, use type "unclear". The
transcript field is your own transcription of what was said, in its original language/script.
${hintBlock}Classification rule — check in this order, in ANY supported language (the trigger words
matter, not which language they're spoken in):
1. Repayment: speech uses any word for repaying/settling a due amount — e.g. "শোধ"/"shodh",
   "জমা দিলো"/"joma dilo" (Bangla), "repaid" / "paid back" / "settled" (English), "갚다"/"gapda"
   (Korean) — classify as repayment.
2. Credit: else, speech uses any word for credit/due/on-account — e.g. "বাকি"/"baki" (Bangla),
   "credit" / "due" / "on credit" / "owes" (English), "외상" (Korean) — classify as credit_sale.
3. Cash: otherwise — a normal sale with no due/repayment language — classify as cash_sale. This
   is the default when neither trigger is present.
item_translations: when item is non-null, translate the item itself (not the customer name) into
all three supported languages, e.g. item "rice" → { "bn": "চাল", "en": "rice", "ko": "쌀" }. Leave
it null only when item itself is null.`;
}

// PRD §4.2 S3 — weekly insight card. A second, independent use of Gemma:
// given the week's already-computed totals (no raw ledger/PII beyond
// customer names already visible in the app), write one short, friendly
// observation a shopkeeper would actually find useful.
export function buildInsightPrompt(summaryText: string): string {
  return `You are a friendly assistant for a Bangladeshi shopkeeper reviewing their week.
Given this week's ledger summary, write ONE short observation in Bangla (1-2 sentences,
plain text, no markdown, no JSON) that highlights something useful — a trend, a notable
customer balance, or an encouraging note. Be concrete with numbers when you have them.
Write only the observation itself, nothing else.

Weekly summary:
${summaryText}`;
}
