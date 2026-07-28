import type { Lang } from "./i18n";
import type { ExtractionResult, ExtractionType, ItemTranslations } from "./schema";
import { extractAmount } from "./numberWords";
import { translateItem } from "./itemDictionary";

// Rule-based replacement for the Gemini/Gemma extraction call — see
// RULE_BASED_EXTRACTION_PLAN.md for why. No API call, runs entirely
// client-side. Deliberately narrower than an LLM: covers the phrasing
// patterns the app's own sample sentences and the previously-tested
// Gemini-prompt patterns use, not arbitrary free-form speech. Expect lower
// accuracy on unusual phrasing than the Gemini path had — that's the
// traded-away flexibility for zero quota risk.

// ---------- Classification ----------
// Checked in this order (repayment first) because a repayment sentence can
// still contain a credit-trigger word as a noun (e.g. Bangla "বাকি" meaning
// "the due amount" inside "...বাকি শোধ করেছেন" — "repaid the due amount" —
// which also contains শোধ, the repayment trigger). Verified against the
// app's own repayment sample sentences in all three languages.
const REPAYMENT_TRIGGERS: Record<Lang, string[]> = {
  bn: ["শোধ", "জমা", "পরিশোধ"],
  en: ["repaid", "paid back", "pay back", "paid off", "settled"],
  ko: ["갚", "상환", "청산"], // verb stems (without conjugated endings) so "갚았어요"/"갚았습니다" etc. all match
};
const CREDIT_TRIGGERS: Record<Lang, string[]> = {
  bn: ["বাকি", "ধারে", "বকেয়া"],
  en: ["credit", "due", "owe"],
  ko: ["외상"],
};

// Small edit-distance check (Damerau-Levenshtein-lite — a real distance-1
// swap counts as one edit, not two, unlike plain Levenshtein) — tolerates a
// single ASR mishearing/typo in a trigger word: one substitution
// ("credot"), one insertion/deletion ("cerdit"/"credi"), or one adjacent
// transposition ("credti" — swapped "it"→"ti", verified live: plain
// substitution-counting alone missed this since a transposition looks like
// 2 mismatched positions, not 1, unless swaps are checked for explicitly).
// Kept deliberately conservative: only used as a fallback after
// exact/prefix matching finds nothing, and only for words long enough that
// a 1-edit match isn't likely to be a coincidence (see callers).
function withinEditDistance1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (longer.length - shorter.length === 1) {
    // Deletion/insertion: try skipping one char of the longer word.
    for (let i = 0; i < longer.length; i++) {
      if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
    }
    return false;
  }
  // Same length: either one substitution, or one adjacent transposition.
  const mismatchPositions: number[] = [];
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] !== longer[i]) mismatchPositions.push(i);
    if (mismatchPositions.length > 2) return false;
  }
  if (mismatchPositions.length <= 1) return true;
  const [i, j] = mismatchPositions;
  return j === i + 1 && shorter[i] === longer[j] && shorter[j] === longer[i];
}

// English inflects (credit/credits/credited/crediting, owe/owes/owed) —
// exact \b word \b matching missed all of those since word-boundary
// matching requires the token to END right after the trigger, not just
// start with it (verified live: "credited"/"owes" both failed to match
// "credit"/"owe" under the old \bcredit\b-style check). Prefix matching on
// each token fixes that without needing a real stemmer. Multi-word phrase
// triggers ("paid back") don't inflect the same way, so those stay a plain
// substring check.
function containsAny(text: string, triggers: string[], lang: Lang): boolean {
  if (lang === "en") {
    const lower = text.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean).map((t) => t.replace(/[.,!?]/g, ""));
    return triggers.some((trigger) => {
      const t = trigger.toLowerCase();
      if (t.includes(" ")) return lower.includes(t);
      if (tokens.some((tok) => tok.startsWith(t))) return true;
      // Fuzzy fallback for a mis-transcribed trigger — only for triggers
      // long enough that a 1-edit coincidental match is very unlikely.
      if (t.length < 5) return false;
      return tokens.some((tok) => tok.length >= 4 && withinEditDistance1(tok.slice(0, t.length + 1), t));
    });
  }

  if (triggers.some((t) => text.includes(t))) return true;
  // Fuzzy fallback, Bangla only (Korean particles attach without spaces —
  // triggers routinely appear as a substring inside a larger conjugated
  // token there, so whole-token edit distance doesn't apply the same way).
  if (lang !== "bn") return false;
  const bnTokens = text.replace(/[,।.]/g, "").split(/\s+/).filter(Boolean);
  return triggers.some((t) => t.length >= 3 && bnTokens.some((tok) => withinEditDistance1(tok, t)));
}

function classify(text: string, lang: Lang): Exclude<ExtractionType, "unclear"> {
  if (containsAny(text, REPAYMENT_TRIGGERS[lang], lang)) return "repayment";
  if (containsAny(text, CREDIT_TRIGGERS[lang], lang)) return "credit_sale";
  return "cash_sale";
}

// Common Bangla words that happen to end in "কে" without being a name+
// dative-marker — pronouns ("তাকে" = to him/her, "আমাকে" = to me) and
// time/adverb words ("আজকে" = today) all take the same কে suffix Bangla
// uses for a name. থেকে (from) was already special-cased for this reason;
// this is that fix generalized into a real stoplist since the failure mode
// clearly wasn't unique to থেকে.
const BN_NON_NAME_KE_WORDS = new Set([
  "থেকে",
  "আজকে",
  "তাকে",
  "আমাকে",
  "ওকে",
  "আপনাকে",
  "তোমাকে",
  "কাউকে",
  "কাকে",
  "এটাকে",
  "ওটাকে",
  "সেটাকে",
  "একে",
  "সবাইকে",
]);

// The "leading tokens before the amount/verb" customer fallbacks (all three
// languages) blindly took everything in that span — found live: "আজকে সালমা
// ৪০০ টাকার আটা কিনলো" ("today Salma bought...") put "আজকে সালমা" ("today
// Salma") in the customer field instead of just "সালমা". Also found: fixing
// only the কে-suffix branch above still left "তাকে ৫০ টাকা বাকি দিলাম"
// ("gave him 50 taka on credit") extracting customer "তাকে" itself, since a
// pronoun that's merely excluded from LOOKING like a name+suffix will still
// get scooped up by this separate, marker-less fallback unless it's
// excluded here too — hence reusing the same stoplist rather than keeping
// two separate ones that could drift apart. Strips common leading
// discourse/time words/pronouns first so the fallback lands on the actual
// name, or on nothing (customer null) when there wasn't one to begin with.
// Not exhaustive — a closed list, not language detection — but covers the
// common cases cheaply.
const LEADING_FILLERS: Record<Lang, Set<string>> = {
  bn: new Set([...BN_NON_NAME_KE_WORDS, "আজ", "গতকাল", "পরশু", "তারপর", "এবং", "মানে"]),
  en: new Set(["so", "um", "uh", "well", "then", "today", "yesterday", "and", "like"]),
  ko: new Set(["오늘", "어제", "그래서", "음", "그"]),
};

function trimLeadingFillers(tokens: string[], lang: Lang): string[] {
  const fillers = LEADING_FILLERS[lang];
  let start = 0;
  while (start < tokens.length && fillers.has(tokens[start].toLowerCase())) start++;
  return tokens.slice(start);
}

// ---------- Bangla customer/item extraction ----------

function extractBn(text: string): { customer: string | null; item: string | null; customerConfidence: number; itemConfidence: number } {
  const tokens = text.replace(/[,।.]/g, "").split(/\s+/).filter(Boolean);
  let customer: string | null = null;
  let customerConfidence = 0;
  let item: string | null = null;
  let itemConfidence = 0;

  // Dative marker কে ("to X") — glued onto the name ("রহিমকে") far more
  // often in natural writing/speech than spaced, so check both.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "কে") {
      customer = tokens[i - 1] ?? null;
      customerConfidence = customer ? 1.0 : 0;
      break;
    }
    if (tokens[i].endsWith("কে") && tokens[i] !== "কে" && !BN_NON_NAME_KE_WORDS.has(tokens[i])) {
      const stripped = tokens[i].slice(0, -2);
      // Compound names ("রহিম ভাই") — include the preceding token too if
      // there is one and it doesn't look like the start of the sentence.
      customer = i > 0 ? `${tokens[i - 1]} ${stripped}` : stripped;
      customerConfidence = 1.0;
      break;
    }
  }

  // Ablative "X-এর কাছ থেকে" ("from X") — used even on cash sales in this
  // app's own sample sentence, so worth handling even though credit sales
  // more commonly use কে.
  if (!customer) {
    const themeIdx = tokens.indexOf("থেকে");
    if (themeIdx > 0) {
      let end = themeIdx;
      if (tokens[end - 1] === "কাছ") end -= 1;
      if (end > 0) {
        // Possessive "-এর" attached to a consonant-final word surfaces as
        // the vowel SIGN ে (U+09C7, combines with the preceding consonant)
        // + র — not the independent vowel এ (U+098F), which never appears
        // word-medially like this. Using এ here matched nothing and fell
        // through to stripping a bare র, leaving a stray ে behind
        // ("সাহেবের" -> "সাহেবে" instead of "সাহেব").
        const raw = tokens[end - 1].replace(/(ের|র)$/, "");
        // Compound names ("করিম সাহেবের" → "করিম" + "সাহেব") — include the
        // token before the possessive-marked one too, same as the কে branch.
        customer = end > 1 ? `${tokens[end - 2]} ${raw}` : raw || null;
        customerConfidence = customer ? 0.9 : 0;
      }
    }
  }

  // Genitive টাকার ("of N taka") directly marks the following word as the
  // item — "৫০ টাকার চাল" → item চাল.
  const takarIdx = tokens.indexOf("টাকার");
  if (takarIdx >= 0 && tokens[takarIdx + 1]) {
    item = tokens[takarIdx + 1];
    itemConfidence = 1.0;
  } else {
    // "X বিক্রি করে" ("selling X") — the word right before বিক্রি.
    const bikriIdx = tokens.findIndex((t) => t.startsWith("বিক্রি"));
    if (bikriIdx > 0) {
      item = tokens[bikriIdx - 1];
      itemConfidence = 0.9;
    }
  }

  // Bare leading name, no marker at all — not just repayment
  // ("সালমা আপা ২০০ টাকা বাকি শোধ করেছেন") but also an ordinary cash sale
  // stated as a subject+verb sentence ("সালমা ৪০০ টাকার আটা কিনলা" — Salma
  // bought flour worth 400 taka — no কে/থেকে marker since সালমা is the
  // grammatical subject of কিনলা, not an object). Whatever precedes the
  // amount, if anything, is the best remaining guess. Naturally comes up
  // empty (not a false positive) for a genuinely anonymous cash sale where
  // the amount is the first thing said ("৫০ টাকার চাল বিক্রি") — there's
  // nothing before the amount to slice out.
  if (!customer) {
    const amountIdx = tokens.findIndex((t) => /[০-৯\d]/.test(t));
    if (amountIdx > 0) {
      customer = trimLeadingFillers(tokens.slice(0, amountIdx), "bn").join(" ") || null;
      customerConfidence = customer ? 0.5 : 0;
    }
  }

  return { customer, item, customerConfidence, itemConfidence };
}

// ---------- English customer/item extraction ----------
const EN_STOPWORDS = new Set(["on", "for", "of", "at", "in", "worth", "to", "from", "credit", "cash", "her", "his", "their"]);

function captureRun(tokens: string[], startIdx: number, max = 3): string | null {
  const out: string[] = [];
  for (let i = startIdx; i < tokens.length && out.length < max; i++) {
    const clean = tokens[i].replace(/[.,]/g, "");
    if (!clean || EN_STOPWORDS.has(clean.toLowerCase()) || /\d/.test(clean)) break;
    out.push(clean);
  }
  return out.length ? out.join(" ") : null;
}

function extractEn(text: string, type: ExtractionType): { customer: string | null; item: string | null; customerConfidence: number; itemConfidence: number } {
  const tokens = text.split(/\s+/).filter(Boolean);
  const lower = tokens.map((t) => t.toLowerCase().replace(/[.,]/g, ""));
  let customer: string | null = null;
  let customerConfidence = 0;
  let item: string | null = null;
  let itemConfidence = 0;

  const toIdx = lower.indexOf("to");
  const fromIdx = lower.indexOf("from");
  const gaveIdx = lower.findIndex((t) => t === "gave" || t === "give" || t === "lent");

  if (toIdx >= 0) {
    customer = captureRun(tokens, toIdx + 1, 2);
    customerConfidence = customer ? 1.0 : 0;
  } else if (fromIdx >= 0) {
    customer = captureRun(tokens, fromIdx + 1, 2);
    customerConfidence = customer ? 1.0 : 0;
  } else if (gaveIdx >= 0) {
    // "Gave Rahim bhai ৳50 of rice on credit" — name between the verb and the amount.
    const rest = tokens.slice(gaveIdx + 1);
    const amountTokenIdx = rest.findIndex((t) => /\d/.test(t));
    const nameTokens = amountTokenIdx >= 0 ? rest.slice(0, amountTokenIdx) : [];
    customer = nameTokens.length ? nameTokens.join(" ") : null;
    customerConfidence = customer ? 0.9 : 0;
  }

  const soldIdx = lower.indexOf("sold");
  const worthIdx = lower.indexOf("worth");
  const forIdx = lower.indexOf("for");
  const ofIdx = lower.indexOf("of");
  const amountIdx = lower.findIndex((t) => /\d/.test(t));
  const verbAnchorIdx = lower.findIndex(
    (t) => ["bought", "purchased", "paid", "received", "gave", "sold"].includes(t) || t.startsWith("owe"),
  );
  if (worthIdx >= 0) {
    // "worth" unambiguously marks "ITEM worth AMOUNT" regardless of which
    // verb precedes it (sold/bought/purchased/received/...) — checked
    // first and independent of "for" since "for" is a homophone of "four"
    // and can get ASR-mangled ("for 500" heard as "four 500"), silently
    // breaking the forIdx-based branches below. "worth" has no such
    // homophone risk, so it's the anchor the in-app hint now recommends.
    const anchor = soldIdx >= 0 && soldIdx < worthIdx ? soldIdx : verbAnchorIdx >= 0 && verbAnchorIdx < worthIdx ? verbAnchorIdx : -1;
    const start = anchor >= 0 ? anchor + 1 : 0;
    const boundary = [toIdx, fromIdx].filter((i) => i > start && i < worthIdx);
    const end = boundary.length ? Math.min(...boundary) : worthIdx;
    const span = tokens.slice(start, end).filter((t) => !EN_STOPWORDS.has(t.toLowerCase()));
    item = span.length ? span.join(" ") : null;
    itemConfidence = item ? 1.0 : 0;
  } else if (forIdx >= 0 && amountIdx === forIdx + 1) {
    // "X bought/sold ITEM for AMOUNT" — "for" sits right before the amount
    // here, not the item, so the item is the span before "for" instead
    // (found live: "rohim bought biscuits for 500" left item empty because
    // captureRun-after-"for" hit the digit "500" immediately and bailed).
    // Bounded by the verb (skip "bought"/"sold" itself) and by any
    // to/from customer marker, so "sold rice to Rahim for 200" doesn't
    // swallow "Rahim" into the item span.
    const start = verbAnchorIdx >= 0 && verbAnchorIdx < forIdx ? verbAnchorIdx + 1 : 0;
    const boundary = [toIdx, fromIdx].filter((i) => i > start && i < forIdx);
    const end = boundary.length ? Math.min(...boundary) : forIdx;
    const span = tokens.slice(start, end).filter((t) => !EN_STOPWORDS.has(t.toLowerCase()));
    item = span.length ? span.join(" ") : null;
    itemConfidence = item ? 0.9 : 0;
  } else if (forIdx >= 0) {
    item = captureRun(tokens, forIdx + 1, 2);
    itemConfidence = item ? 1.0 : 0;
  } else if (ofIdx >= 0) {
    // "Gave Rahim bhai ৳50 of rice on credit" — item right after "of".
    // Doesn't false-positive on repayment's "paid back ৳200 of her credit"
    // since "her"/"credit" are both in EN_STOPWORDS, so captureRun finds
    // nothing there (and repayment forces item back to null regardless).
    item = captureRun(tokens, ofIdx + 1, 2);
    itemConfidence = item ? 0.9 : 0;
  }

  // Repayment: "Salma apa paid back ৳200 of her credit" — leading tokens
  // before the trigger verb phrase are the customer.
  if (!customer && type === "repayment") {
    const triggerIdx = lower.findIndex((t) => REPAYMENT_TRIGGERS.en.some((trig) => t === trig.split(" ")[0]));
    if (triggerIdx > 0) {
      customer = tokens.slice(0, triggerIdx).join(" ");
      customerConfidence = customer ? 0.6 : 0;
    }
  }

  // Bare leading name, no marker/preposition/trigger word at all — e.g. a
  // cash sale phrased as "Salma bought flour for 400 taka" rather than
  // "...from Salma.../...to Salma...". Anchored to a recognizable verb
  // (not "everything before the amount", the way Bangla/Korean do it) —
  // English word order puts a verb and often an object between the subject
  // and the amount ("Salma bought flour for 400" — "bought flour for"
  // would be garbage if included), so this only fires when one of these
  // specific verbs is found near the start.
  if (!customer) {
    // "owe"/"owes"/"owed" included — "Rahim owes 300 taka for oil" is a
    // completely ordinary way to state a credit sale, same subject+verb
    // shape as the others here.
    const verbIdx = lower.findIndex(
      (t) => ["bought", "purchased", "paid", "received", "gave", "sold"].includes(t) || t.startsWith("owe"),
    );
    if (verbIdx > 0) {
      customer = trimLeadingFillers(tokens.slice(0, verbIdx), "en").join(" ") || null;
      customerConfidence = customer ? 0.5 : 0;
    }
  }

  return { customer, item, customerConfidence, itemConfidence };
}

// ---------- Korean customer/item extraction ----------
const KO_AMOUNT_HINT = /[0-9영공일이삼사오육칠팔구십백천만]|타카|어치/;

function extractKo(text: string): { customer: string | null; item: string | null; customerConfidence: number; itemConfidence: number } {
  let customer: string | null = null;
  let customerConfidence = 0;
  let item: string | null = null;
  let itemConfidence = 0;

  const tokens = text.split(/\s+/).filter(Boolean);

  // Dative 에게/한테 ("to X") is glued directly onto the LAST word of the
  // name with no space ("형에게", not "형 에게"). Token-based (not a
  // whole-string regex) so a compound name's earlier word ("라힘" in
  // "라힘 형에게") isn't lost — \S+ can't cross the space between them.
  let dativeTokenIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const m = tokens[i].match(/^(.+?)(에게|한테)$/);
    if (m) {
      dativeTokenIdx = i;
      customer = dativeTokenIdx > 0 ? `${tokens[dativeTokenIdx - 1]} ${m[1]}` : m[1];
      customerConfidence = 1.0;
      break;
    }
  }

  // Object marker 을/를 marks the item — but the same marker also appears
  // on the amount phrase ("100타카를") in some of this app's own sample
  // sentences, so skip any 을/를-marked token that itself looks numeric.
  let amountTokenIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (KO_AMOUNT_HINT.test(tokens[i]) && amountTokenIdx < 0) amountTokenIdx = i;
    if (item) continue;
    if ((tokens[i].endsWith("을") || tokens[i].endsWith("를")) && !KO_AMOUNT_HINT.test(tokens[i])) {
      item = tokens[i].slice(0, -1);
      itemConfidence = 1.0;
    }
  }
  // "쌀 50타카어치를" — quantity phrasing ("N-taka's worth of X") leaves the
  // item as a bare noun with no particle at all, directly before the
  // amount+어치 phrase.
  if (!item && amountTokenIdx > 0) {
    const candidate = tokens[amountTokenIdx - 1];
    if (candidate && candidate !== tokens[dativeTokenIdx]) {
      item = candidate;
      itemConfidence = 0.8;
    }
  }

  // Subject marker 가/이 ("살마 누나가 ... 갚았어요") — not repayment-specific,
  // 가/이 just marks whatever the grammatical subject is, so this applies
  // whenever the customer is the sentence's subject rather than its object
  // (no 에게/한테 dative marker), regardless of transaction type. Falls back
  // further to bare leading tokens before the amount when even that's
  // absent — safe here (unlike the English equivalent) since Korean's
  // particle-marked, largely head-final structure means the leading span
  // doesn't tend to swallow an intervening verb the way English word order
  // would.
  if (!customer) {
    let subjectTokenIdx = -1;
    let subjectStripped: string | null = null;
    for (let i = 0; i < tokens.length; i++) {
      const m = tokens[i].match(/^(.+?)(가|이)$/);
      if (m && !KO_AMOUNT_HINT.test(tokens[i])) {
        subjectTokenIdx = i;
        subjectStripped = m[1];
        break;
      }
    }
    if (subjectTokenIdx >= 0 && subjectStripped) {
      customer = subjectTokenIdx > 0 ? `${tokens[subjectTokenIdx - 1]} ${subjectStripped}` : subjectStripped;
      customerConfidence = 0.8;
    } else if (amountTokenIdx > 0) {
      customer = trimLeadingFillers(tokens.slice(0, amountTokenIdx), "ko").join(" ") || null;
      customerConfidence = customer ? 0.5 : 0;
    }
  }

  return { customer, item, customerConfidence, itemConfidence };
}

function buildItemTranslations(item: string | null, lang: Lang): ItemTranslations | null {
  if (!item) return null;
  return translateItem(item, lang);
}

/** Local, non-API replacement for extractFromTranscript/extractFromAudio.
 * Same output contract (ExtractionResultSchema) so nothing downstream
 * (ConfirmationCard, db.ts, displayItem) needs to know the difference. */
export function extractLocally(transcript: string, lang: Lang): ExtractionResult {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return {
      type: "unclear",
      customer: null,
      item: null,
      item_translations: null,
      amount_taka: null,
      confidence: { customer: 0, item: 0, amount: 0 },
      transcript,
    };
  }

  const type = classify(trimmed, lang);
  const amount = extractAmount(trimmed, lang);

  const extracted =
    lang === "bn" ? extractBn(trimmed) : lang === "ko" ? extractKo(trimmed) : extractEn(trimmed, type);

  const item = type === "repayment" ? null : extracted.item;
  const itemConfidence = type === "repayment" ? 0 : extracted.itemConfidence;

  // Never invent an amount — matches the rule the Gemini prompts used.
  if (amount == null) {
    return {
      type: "unclear",
      customer: extracted.customer,
      item,
      item_translations: buildItemTranslations(item, lang),
      amount_taka: null,
      confidence: { customer: extracted.customerConfidence, item: itemConfidence, amount: 0 },
      transcript,
    };
  }

  return {
    type,
    customer: extracted.customer,
    item,
    item_translations: buildItemTranslations(item, lang),
    amount_taka: amount,
    confidence: { customer: extracted.customerConfidence, item: itemConfidence, amount: 1.0 },
    transcript,
  };
}
