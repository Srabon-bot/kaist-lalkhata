// Single source of truth for the Gemma model used everywhere in the app.
//
// PRD §7 originally targeted gemma-3n-e2b/e4b-it for native audio input —
// verified live against the Gemini API that those models are no longer
// served on this project's key, and the Gemma models that are available
// (gemma-4-*-it) have audio input disabled at the API level ("Audio input
// modality is not enabled for this model"). That's an account/API-side
// gate, not something fixable in code. The app now transcribes speech
// client-side (Web Speech API, src/hooks/useSpeechRecognition.ts) and sends
// the transcript to Gemma as text — Gemma still does the actual hard part,
// turning a messy Bangla/English/Korean transcript into typed ledger JSON.
export const GEMMA_MODEL = "gemma-4-26b-a4b-it";

// Experiment: unlike the Gemma variants above, real Gemini models on this
// same key DO have audio input enabled — verified live against
// generateContent with an inline audio/wav part (gemini-3.5-flash and
// gemini-3.6-flash both correctly described test audio; gemini-2.5-flash is
// 404 "no longer available to new users" on this key, gemini-2.0-flash is
// 429 zero-quota). Pinned rather than "gemini-flash-latest" so the model
// can't silently drift under us mid-demo. Lets a recording skip the
// browser Web-Speech transcription step entirely: raw audio goes straight
// to Gemini, which transcribes AND extracts ledger JSON in one call.
export const GEMINI_AUDIO_MODEL = "gemini-3.5-flash";

export const GEMMA_PROXY_ENDPOINT = "/api/gemma";

// Inline audio must keep the whole request (prompt + base64 audio) under
// the API's 20MB request-size ceiling; MAX_RECORDING_SECONDS already caps
// capture well under that for any reasonable mic bitrate.
export const MAX_INLINE_AUDIO_BYTES = 19 * 1024 * 1024;

export const MAX_RECORDING_SECONDS = 28; // hard cap on a single spoken turn

export const CONFIDENCE_FLAG_THRESHOLD = 0.7; // below this, a field gets an amber ambiguity flag

// Gemma 4 is a "thinking" model — it spends a real chunk of its response
// budget on internal reasoning before the final JSON, which adds latency
// versus a non-thinking model. Both Gemma models on this key are
// thinking-only (no faster non-thinking variant available), and measured
// live latency runs up to ~26s. The proxy (api/gemma.ts) runs on Vercel's
// Edge Runtime, which enforces a hard ~25s execution ceiling that isn't
// configurable — kept just under that so our own clean timeout (with a
// friendly message) fires before the platform kills the function outright.
export const GEMMA_TIMEOUT_MS = 24_000;

const isViteDev =
  typeof import.meta !== "undefined" && Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

if (isViteDev && !/^gemma-4-.+-it$/.test(GEMMA_MODEL)) {
  // eslint-disable-next-line no-console
  console.error(
    `[config] GEMMA_MODEL="${GEMMA_MODEL}" doesn't match the expected gemma-4-*-it naming. ` +
      `Verify against the live ListModels response before deploying — see src/lib/prompt.ts for context.`,
  );
}
