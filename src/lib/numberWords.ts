import type { Lang } from "./i18n";

// Spoken-amount parsing for the local (non-Gemini) extraction engine — see
// RULE_BASED_EXTRACTION_PLAN.md for why this exists. Chrome's
// SpeechRecognition frequently normalizes spoken numbers straight to digit
// numerals already (in all three languages), so the digit path below covers
// a lot of real traffic on its own; the word-based parsers are the fallback
// for when it doesn't.
//
// All three parsers are scoped to what a shopkeeper actually says — amounts
// up to a few thousand taka, not arbitrary large numbers.

// ---------- Bangla ----------
// Bangla number words are irregular for every value 1-99 (no
// tens-times-units composition the way English/Korean have) — this table
// was researched against multiple sources (see the plan doc), not guessed.
// Worth a native-speaker spot-check before relying on it for a live demo.
const BN_WORDS: Record<string, number> = {
  শূন্য: 0,
  এক: 1,
  দুই: 2,
  তিন: 3,
  চার: 4,
  পাঁচ: 5,
  ছয়: 6,
  সাত: 7,
  আট: 8,
  নয়: 9,
  দশ: 10,
  এগারো: 11,
  বারো: 12,
  তেরো: 13,
  চৌদ্দ: 14,
  পনেরো: 15,
  ষোলো: 16,
  সতেরো: 17,
  আঠারো: 18,
  ঊনিশ: 19,
  বিশ: 20,
  একুশ: 21,
  বাইশ: 22,
  তেইশ: 23,
  চব্বিশ: 24,
  পঁচিশ: 25,
  ছাব্বিশ: 26,
  সাতাশ: 27,
  আটাশ: 28,
  ঊনত্রিশ: 29,
  ত্রিশ: 30,
  একত্রিশ: 31,
  বত্রিশ: 32,
  তেত্রিশ: 33,
  চৌত্রিশ: 34,
  পঁয়ত্রিশ: 35,
  ছত্রিশ: 36,
  সাঁইত্রিশ: 37,
  আটত্রিশ: 38,
  ঊনচল্লিশ: 39,
  চল্লিশ: 40,
  একচল্লিশ: 41,
  বিয়াল্লিশ: 42,
  তেতাল্লিশ: 43,
  চুয়াল্লিশ: 44,
  পঁয়তাল্লিশ: 45,
  ছেচল্লিশ: 46,
  সাতচল্লিশ: 47,
  আটচল্লিশ: 48,
  ঊনপঞ্চাশ: 49,
  পঞ্চাশ: 50,
  একান্ন: 51,
  বাহান্ন: 52,
  তিপ্পান্ন: 53,
  চুয়ান্ন: 54,
  পঞ্চান্ন: 55,
  ছাপ্পান্ন: 56,
  সাতান্ন: 57,
  আটান্ন: 58,
  ঊনষাট: 59,
  ষাট: 60,
  একষট্টি: 61,
  বাষট্টি: 62,
  তেষট্টি: 63,
  চৌষট্টি: 64,
  পঁয়ষট্টি: 65,
  ছেষট্টি: 66,
  সাতষট্টি: 67,
  আটষট্টি: 68,
  ঊনসত্তর: 69,
  সত্তর: 70,
  একাত্তর: 71,
  বাহাত্তর: 72,
  তিয়াত্তর: 73,
  চুয়াত্তর: 74,
  পঁচাত্তর: 75,
  ছিয়াত্তর: 76,
  সাতাত্তর: 77,
  আটাত্তর: 78,
  ঊনআশি: 79,
  আশি: 80,
  একাশি: 81,
  বিরাশি: 82,
  তিরাশি: 83,
  চুরাশি: 84,
  পঁচাশি: 85,
  ছিয়াশি: 86,
  সাতাশি: 87,
  আটাশি: 88,
  ঊননব্বই: 89,
  নব্বই: 90,
  একানব্বই: 91,
  বিরানব্বই: 92,
  তিরানব্বই: 93,
  চুরানব্বই: 94,
  পঁচানব্বই: 95,
  ছিয়ানব্বই: 96,
  সাতানব্বই: 97,
  আটানব্বই: 98,
  নিরানব্বই: 99,
};

// Common single-word fused hundred/thousand amounts — round numbers a
// shopkeeper actually says ("একশ", "দুইশ", "পাঁচশ" ...). Compositional
// hundred/thousand + remainder (e.g. "একশ পঞ্চাশ" = 150) is handled
// separately in parseBnAmount by looking at the token after one of these.
// Only the naturally single-word fused forms — "হাজার" itself is deliberately
// NOT here; it's almost always said with a space after its multiplier
// ("দুই হাজার", not "দুইহাজার"), which the multiplier loop below handles by
// looking at the preceding token. Including a bare হাজার here previously
// caused "দুই হাজার" to match this table on "হাজার" alone (before ever
// checking the preceding "দুই"), silently discarding the multiplier.
const BN_ROUND: Record<string, number> = {
  একশ: 100,
  একশো: 100,
  একশত: 100,
  দুইশ: 200,
  দুইশো: 200,
  তিনশ: 300,
  তিনশো: 300,
  চারশ: 400,
  চারশো: 400,
  পাঁচশ: 500,
  পাঁচশো: 500,
  ছয়শ: 600,
  ছয়শো: 600,
  সাতশ: 700,
  সাতশো: 700,
  আটশ: 800,
  আটশো: 800,
  নয়শ: 900,
  নয়শো: 900,
};

function bnDigitsToInt(text: string): number | null {
  if (!/^[০-৯]+$/.test(text)) return null;
  const latin = text.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  return parseInt(latin, 10);
}

// Parses the sub-1000 portion only (hundreds/tens/ones) — no হাজার
// awareness. Split out of parseBnAmount so the thousand-level wrapper below
// can parse "whatever comes after হাজার" the same way it'd parse a
// standalone amount, instead of re-returning on the first hundred/round
// match the way a single flat scan did (that version silently discarded a
// leading thousand-multiplier whenever a hundred word also appeared later
// in the same phrase — "এক হাজার দুইশ পঞ্চাশ" (1250) came back as 250).
function parseBnSubThousand(tokens: string[]): number | null {
  // Round hundred word, optionally + a 1-99 remainder right after it
  // ("একশ পঞ্চাশ" = 100 + 50 = 150).
  for (let i = 0; i < tokens.length; i++) {
    const round = BN_ROUND[tokens[i]];
    if (round == null) continue;
    const next = tokens[i + 1];
    const remainder = next != null ? (BN_WORDS[next] ?? 0) : 0;
    return round + remainder;
  }

  // Multiplied hundred: "[N] শত/শো".
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== "শত" && tokens[i] !== "শো") continue;
    const prevMult = tokens[i - 1] != null ? BN_WORDS[tokens[i - 1]] : undefined;
    const mult = prevMult ?? 1;
    const next = tokens[i + 1];
    const remainder = next != null ? (BN_WORDS[next] ?? 0) : 0;
    return mult * 100 + remainder;
  }

  // Plain 1-99 word.
  for (const t of tokens) {
    if (BN_WORDS[t] != null) return BN_WORDS[t];
  }

  return null;
}

function parseBnAmount(text: string): number | null {
  const tokens = text.replace(/[,।.]/g, "").split(/\s+/).filter(Boolean);

  // Digits (Bengali or Latin) anywhere — most reliable signal when present.
  for (const t of tokens) {
    const bn = bnDigitsToInt(t);
    if (bn != null) return bn;
    const digitMatch = t.match(/\d+/);
    if (digitMatch) return parseInt(digitMatch[0], 10);
  }

  // থাউজান্ড-level split: "[N] হাজার [sub-1000 remainder]" — parse the
  // remainder with the same sub-1000 logic rather than a flat one-shot scan,
  // so "এক হাজার দুইশ পঞ্চাশ টাকা" correctly sums to 1250, not just the 250
  // from the hundred word a flat scan would hit first.
  const thousandIdx = tokens.indexOf("হাজার");
  if (thousandIdx >= 0) {
    const prevMult = thousandIdx > 0 ? BN_WORDS[tokens[thousandIdx - 1]] : undefined;
    const thousandPart = (prevMult ?? 1) * 1000;
    const remainder = parseBnSubThousand(tokens.slice(thousandIdx + 1)) ?? 0;
    return thousandPart + remainder;
  }

  return parseBnSubThousand(tokens);
}

// ---------- English ----------
const EN_ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const EN_TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function parseEnAmount(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .replace(/[,.]/g, "")
    .split(/\s+/)
    .filter((t) => t && t !== "and");

  for (const t of tokens) {
    // Not an exact-match check: covers currency-symbol-fused amounts like
    // "৳50" too, which the app's own written sample sentences use (real
    // speech-to-text obviously won't produce a ৳ glyph, but the sample-chip
    // taps feed this exact hardcoded text through the same extraction path).
    const digitMatch = t.match(/\d+/);
    if (digitMatch) return parseInt(digitMatch[0], 10);
  }

  let total = 0;
  let current = 0;
  let matchedAny = false;
  for (const t of tokens) {
    if (t === "hundred") {
      current = (current || 1) * 100;
      matchedAny = true;
    } else if (t === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      matchedAny = true;
    } else if (EN_TENS[t] != null) {
      current += EN_TENS[t];
      matchedAny = true;
    } else if (EN_ONES[t] != null) {
      current += EN_ONES[t];
      matchedAny = true;
    } else if (matchedAny) {
      // A non-number token after we've started matching a number phrase
      // ends it — don't let unrelated later words merge into the total.
      break;
    }
  }
  return matchedAny ? total + current : null;
}

// ---------- Korean ----------
// Currency amounts use Sino-Korean numerals (verified: this is the
// universal convention for money in Korean, not native-Korean counting
// words) — a fully compositional system, unlike Bangla, so this is a real
// parser rather than a lookup table.
const KO_DIGITS: Record<string, number> = {
  영: 0,
  공: 0,
  일: 1,
  이: 2,
  삼: 3,
  사: 4,
  오: 5,
  육: 6,
  칠: 7,
  팔: 8,
  구: 9,
};
const KO_PLACES: [string, number][] = [
  ["만", 10000],
  ["천", 1000],
  ["백", 100],
  ["십", 10],
];

// Standard East-Asian-numeral parse: `num` is a pending single digit not
// yet consumed by a place word; `section` accumulates value below the next
// 만 (10,000) boundary; `result` accumulates completed 만-blocks. A place
// word consumes whatever digit is pending (defaulting to 1 when there
// isn't one, since "백" alone means 100, not "zero hundred").
function parseKoDigitStream(scope: string): number | null {
  let result = 0;
  let section = 0;
  let num = 0;
  let matchedAny = false;

  for (const ch of scope) {
    const digit = KO_DIGITS[ch];
    if (digit != null) {
      num = digit;
      matchedAny = true;
      continue;
    }
    const place = KO_PLACES.find(([word]) => word === ch);
    if (!place) continue;
    const [, value] = place;
    matchedAny = true;
    if (value === 10000) {
      section += num || 1;
      result += section * value;
      section = 0;
    } else {
      section += (num || 1) * value;
    }
    num = 0;
  }

  return matchedAny ? result + section + num : null;
}

function parseKoAmount(text: string): number | null {
  const digitMatch = text.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);

  // Sino-Korean numbers are written as one unspaced word ("이백오십"), and
  // Chrome's Korean SpeechRecognition virtually never breaks them into
  // separate tokens — so this parses a character stream around the
  // currency marker rather than splitting on spaces. Prefer the tightest
  // safe window first: right after a customer-marking particle (에게/한테),
  // since a name's transliteration could otherwise coincidentally contain a
  // Sino-Korean digit syllable and corrupt a wider scan.
  const currencyIdx = text.indexOf("타카");
  if (currencyIdx < 0) return parseKoDigitStream(text);

  const particleMatch = /(에게|한테)/g;
  let lastParticleEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = particleMatch.exec(text.slice(0, currencyIdx)))) {
    lastParticleEnd = m.index + m[0].length;
  }
  if (lastParticleEnd >= 0) {
    const tight = parseKoDigitStream(text.slice(lastParticleEnd, currencyIdx));
    if (tight != null) return tight;
  }

  const wide = text.slice(Math.max(0, currencyIdx - 12), currencyIdx);
  return parseKoDigitStream(wide);
}

/** Best-effort spoken-amount extraction. Returns null rather than guessing
 * when nothing recognizable is found — callers should treat that as "ask
 * again" territory (matches the existing "never invent an amount" rule the
 * Gemini prompts used). */
export function extractAmount(text: string, lang: Lang): number | null {
  if (lang === "bn") return parseBnAmount(text);
  if (lang === "ko") return parseKoAmount(text);
  return parseEnAmount(text);
}
