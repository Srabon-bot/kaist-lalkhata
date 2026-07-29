// PRD §4.2 S3 — weekly insight card. The only remaining use of Gemma in this
// app: given the week's already-computed totals (no raw ledger/PII beyond
// customer names already visible in the app), write one short, friendly
// observation a shopkeeper would actually find useful. Voice-entry
// extraction used to have its own prompts here too (transcript -> ledger
// JSON, and a direct-audio variant) — replaced by the local, non-API engine
// in src/lib/localExtraction.ts (see RULE_BASED_EXTRACTION_PLAN.md); those
// prompts and their api/gemma.ts modes were removed as dead code once
// nothing called them anymore.
export function buildInsightPrompt(summaryText: string): string {
  return `You are a friendly assistant for a Bangladeshi shopkeeper reviewing their week.
Given this week's ledger summary, write ONE short observation in Bangla (1-2 sentences,
plain text, no markdown, no JSON) that highlights something useful — a trend, a notable
customer balance, or an encouraging note. Be concrete with numbers when you have them.
Write only the observation itself, nothing else.

Weekly summary:
${summaryText}`;
}
