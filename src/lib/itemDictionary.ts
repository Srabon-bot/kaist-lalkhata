import type { ItemTranslations } from "./schema";
import type { Lang } from "./i18n";

// Common mudi-dokan (corner shop) items, bn/en/ko. Not exhaustive — an item
// outside this list just doesn't get a translation, which displayItem() in
// db.ts already handles gracefully (falls back to showing the original
// word in every language). Scoped to what a small Bangladeshi grocery shop
// actually sells, not a general dictionary.
const ITEMS: { bn: string; en: string; ko: string }[] = [
  { bn: "চাল", en: "rice", ko: "쌀" },
  { bn: "ডাল", en: "lentils", ko: "렌틸콩" },
  { bn: "তেল", en: "oil", ko: "식용유" },
  { bn: "সরিষার তেল", en: "mustard oil", ko: "겨자기름" },
  { bn: "সয়াবিন তেল", en: "soybean oil", ko: "콩기름" },
  { bn: "চিনি", en: "sugar", ko: "설탕" },
  { bn: "গুড়", en: "jaggery", ko: "흑설탕" },
  { bn: "লবণ", en: "salt", ko: "소금" },
  { bn: "আটা", en: "flour", ko: "밀가루" },
  { bn: "ডিম", en: "egg", ko: "계란" },
  { bn: "দুধ", en: "milk", ko: "우유" },
  { bn: "দই", en: "yogurt", ko: "요구르트" },
  { bn: "মাখন", en: "butter", ko: "버터" },
  { bn: "পনির", en: "cheese", ko: "치즈" },
  { bn: "চা", en: "tea", ko: "차" },
  { bn: "পেঁয়াজ", en: "onion", ko: "양파" },
  { bn: "আলু", en: "potato", ko: "감자" },
  { bn: "রসুন", en: "garlic", ko: "마늘" },
  { bn: "আদা", en: "ginger", ko: "생강" },
  { bn: "মরিচ", en: "chili", ko: "고추" },
  { bn: "কাঁচা মরিচ", en: "green chili", ko: "청양고추" },
  { bn: "হলুদ", en: "turmeric", ko: "강황" },
  { bn: "জিরা", en: "cumin", ko: "커민" },
  { bn: "ধনিয়া", en: "coriander", ko: "고수" },
  { bn: "এলাচ", en: "cardamom", ko: "카다멈" },
  { bn: "দারুচিনি", en: "cinnamon", ko: "계피" },
  { bn: "তেজপাতা", en: "bay leaf", ko: "월계수잎" },
  { bn: "টমেটো", en: "tomato", ko: "토마토" },
  { bn: "শসা", en: "cucumber", ko: "오이" },
  { bn: "বেগুন", en: "eggplant", ko: "가지" },
  { bn: "ফুলকপি", en: "cauliflower", ko: "콜리플라워" },
  { bn: "বাঁধাকপি", en: "cabbage", ko: "양배추" },
  { bn: "কুমড়া", en: "pumpkin", ko: "호박" },
  { bn: "ঢেঁড়স", en: "okra", ko: "오크라" },
  { bn: "পালং শাক", en: "spinach", ko: "시금치" },
  { bn: "সবজি", en: "vegetables", ko: "채소" },
  { bn: "ফল", en: "fruit", ko: "과일" },
  { bn: "কলা", en: "banana", ko: "바나나" },
  { bn: "আপেল", en: "apple", ko: "사과" },
  { bn: "আম", en: "mango", ko: "망고" },
  { bn: "কমলা", en: "orange", ko: "오렌지" },
  { bn: "লেবু", en: "lemon", ko: "레몬" },
  { bn: "নারিকেল", en: "coconut", ko: "코코넛" },
  { bn: "চিনাবাদাম", en: "peanut", ko: "땅콩" },
  { bn: "মধু", en: "honey", ko: "꿀" },
  { bn: "মাছ", en: "fish", ko: "생선" },
  { bn: "মুরগি", en: "chicken", ko: "닭고기" },
  { bn: "গরুর মাংস", en: "beef", ko: "소고기" },
  { bn: "পানি", en: "water", ko: "물" },
  { bn: "জুস", en: "juice", ko: "주스" },
  { bn: "বরফ", en: "ice", ko: "얼음" },
  { bn: "সাবান", en: "soap", ko: "비누" },
  { bn: "শ্যাম্পু", en: "shampoo", ko: "샴푸" },
  { bn: "টুথপেস্ট", en: "toothpaste", ko: "치약" },
  { bn: "ডিটারজেন্ট", en: "detergent", ko: "세제" },
  { bn: "বিস্কুট", en: "biscuit", ko: "비스킷" },
  { bn: "পাউরুটি", en: "bread", ko: "빵" },
  { bn: "নুডলস", en: "noodles", ko: "국수" },
  { bn: "চিপস", en: "chips", ko: "감자칩" },
  { bn: "চকলেট", en: "chocolate", ko: "초콜릿" },
  { bn: "মোমবাতি", en: "candle", ko: "양초" },
  { bn: "দিয়াশলাই", en: "matches", ko: "성냥" },
  { bn: "সিগারেট", en: "cigarette", ko: "담배" },
  { bn: "গ্যাস", en: "cooking gas", ko: "가스" },
  { bn: "কেরোসিন", en: "kerosene", ko: "등유" },
  { bn: "খবরের কাগজ", en: "newspaper", ko: "신문" },
  { bn: "টিস্যু", en: "tissue", ko: "티슈" },
  { bn: "কলম", en: "pen", ko: "펜" },
  { bn: "খাতা", en: "notebook", ko: "공책" },
  { bn: "ব্যাটারি", en: "battery", ko: "배터리" },
];

function normalize(word: string): string {
  return word.trim().toLowerCase();
}

const LOOKUP = new Map<string, ItemTranslations>();
for (const item of ITEMS) {
  const translations: ItemTranslations = { bn: item.bn, en: item.en, ko: item.ko };
  LOOKUP.set(normalize(item.bn), translations);
  LOOKUP.set(normalize(item.en), translations);
  LOOKUP.set(normalize(item.ko), translations);
}

/** Looks up a spoken item word (in any of the three supported languages)
 * against the shop-item dictionary. Returns null for anything outside it —
 * callers should treat that as "no translation available," not an error;
 * displayItem() already falls back to the original word in that case. */
export function translateItem(word: string, _sourceLang: Lang): ItemTranslations | null {
  return LOOKUP.get(normalize(word)) ?? null;
}
