import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

const LANG_KEY = "lal-khata-lang";

type Entry = { bn: string; en: string };

// UI-chrome strings only — spoken transcripts, customer names, and items a
// shopkeeper actually says stay exactly as spoken (that's real data, not UI
// copy). This dictionary exists so someone who can't read Bangla can still
// understand every screen and button in the app.
export const dict = {
  "nav.khata": { bn: "খাতা", en: "Ledger" },
  "nav.customers": { bn: "কাস্টমার", en: "Customers" },
  "nav.summary": { bn: "সারাংশ", en: "Summary" },
  "nav.mainMenu": { bn: "প্রধান মেনু", en: "Main menu" },
  "nav.mic": { bn: "হিসাব বলার জন্য মাইক চাপুন", en: "Tap the mic to speak a transaction" },
  "layout.logout": { bn: "লগআউট", en: "Log out" },

  "type.creditSale": { bn: "বাকি বিক্রি", en: "Credit sale" },
  "type.cashSale": { bn: "নগদ বিক্রি", en: "Cash sale" },
  "type.repayment": { bn: "বাকি শোধ", en: "Repayment" },
  "common.cash": { bn: "নগদ", en: "Cash" },
  "common.confirm": { bn: "নিশ্চিত", en: "Confirm" },
  "common.tryAgain": { bn: "আবার চেষ্টা করুন", en: "Try again" },
  "common.close": { bn: "বন্ধ করুন", en: "Close" },
  "common.heard": { bn: "শোনা গেছে", en: "Heard" },

  "welcome.title": { bn: "হাল খাতা", en: "Haal Khata" },
  "welcome.subtitle": { bn: "হাল খাতা — মুখে বলে হিসাব রাখুন", en: "Haal Khata — Voice-First Bookkeeper" },
  "welcome.poweredBy": { bn: "Google Gemma দ্বারা চালিত", en: "Powered by Google Gemma" },
  "welcome.pitch": {
    bn: "মুদি দোকানের হিসাব রাখুন কথা বলে — লিখতে হবে না, টাইপ করতে হবে না। বাংলায়, সহজে, নিজের ফোনেই।",
    en: "Keep a mudi dokan's ledger just by speaking — no writing, no typing. In Bangla, simply, right on your own phone.",
  },
  "welcome.stat1.value": { bn: "৪৫ লাখ+", en: "4.5M+" },
  "welcome.stat1.label": { bn: "মুদি দোকান বাংলাদেশে", en: "mudi dokans in Bangladesh" },
  "welcome.stat2.value": { bn: "৭৩%+", en: "73%+" },
  "welcome.stat2.label": { bn: "বিক্রি হয় বাকিতে", en: "of sales are on credit (baki)" },
  "welcome.stat3.value": { bn: "৯৪%", en: "94%" },
  "welcome.stat3.label": { bn: "পরিবার মুদি দোকান থেকে কেনে", en: "of households shop at one" },
  "welcome.feature1.title": { bn: "কথা বলে লিখুন", en: "Speak it in" },
  "welcome.feature1.body": { bn: "টাইপ নয় — শুধু বলুন, খাতায় লেখা হয়ে যাবে।", en: "No typing — just speak, and it's written into the ledger." },
  "welcome.feature2.title": { bn: "বাকি মনে রাখুন", en: "Track every baki" },
  "welcome.feature2.body": { bn: "কে কত বাকি রেখেছে, সব এক জায়গায়।", en: "Who owes how much on credit — all in one place." },
  "welcome.feature3.title": { bn: "আপনার ফোনেই থাকে", en: "Stays on your phone" },
  "welcome.feature3.body": { bn: "কোনো অ্যাকাউন্ট লাগে না — আপনার ডেটা আপনার কাছেই।", en: "No account needed — your data stays with you." },
  "welcome.signup": { bn: "সাইন আপ", en: "Sign up" },
  "welcome.login": { bn: "লগইন", en: "Log in" },
  "welcome.privacyNote": { bn: "শুধু আপনার ফোনে থাকে — কোনো সার্ভারে যায় না", en: "Stays on your phone only — never sent to a server" },
  "welcome.whyRedInfo": { bn: "কেন \"হাল খাতা\"?", en: "Why \"Haal Khata\"? Why red?" },
  "welcome.langToggleHint": { bn: "ভাষা", en: "Language" },

  "story.title": { bn: "কেন \"হাল খাতা\"? কেন লাল রঙ?", en: "Why \"Haal Khata\"? Why red?" },
  "story.body1": {
    bn: "৪৩০ বছরেরও বেশি সময় ধরে বাংলার দোকানদাররা প্রতি পহেলা বৈশাখে (বাংলা নববর্ষে) নতুন খাতা খোলেন — একে বলে হালখাতা। পুরনো খাতা বন্ধ করে, গ্রাহকদের বাকি শোধ করার আমন্ত্রণ জানিয়ে, মিষ্টি ও ছোট উপহার দিয়ে নতুন বছর শুরু হতো।",
    en: "For over 430 years, Bengali shopkeepers have opened a new ledger every Pohela Boishakh (Bengali New Year) — a tradition called Haal Khata. They'd close the old book, invite customers to settle their baki (credit), and welcome them with sweets and small gifts to start the year fresh.",
  },
  "story.body2": {
    bn: "খাতাটি প্রায়ই লাল কাপড়ে বাঁধা থাকতো — মজবুত, আর গোপনে বদলানো যায় না বলেই গ্রাহকরা এটি বিশ্বাস করতেন। এই বিশ্বাসই আসল কথা — লাল রংটা শুধু সাজ নয়।",
    en: "The ledger was almost always bound in red cloth — sturdy, and impossible to quietly alter, which is exactly why customers trusted it. That trust is the real point — the red isn't just decoration.",
  },
  "story.body3": {
    bn: "এই অ্যাপ, হাল খাতা, সেই একই বিশ্বাসকে ডিজিটাল রূপ দিয়েছে — প্রতিটি কথা বলা হিসাব হয়ে যায় একটি স্থায়ী এন্ট্রি, হাতে লেখার বদলে মুখে বলা, তবু কেন্দ্রে সেই বাকি — যার উপর মুদি দোকানের প্রায় ৭৩%+ বিক্রি নির্ভর করে।",
    en: "This app, Haal Khata, digitizes that same trust — every spoken transaction becomes a permanent entry, spoken instead of hand-written, still centered on baki, the credit system ~73%+ of mudi dokan sales run on.",
  },

  "ritual.button": { bn: "হালখাতা করুন", en: "Do Haal Khata" },
  "ritual.title": { bn: "শুভ হালখাতা!", en: "Happy Haal Khata!" },
  "ritual.intro": {
    bn: "পহেলা বৈশাখে দোকানদাররা পুরনো খাতা বন্ধ করে গ্রাহকদের বাকি শোধ করার আমন্ত্রণ জানান। আজ কে কে শোধ করলেন?",
    en: "On Pohela Boishakh, shopkeepers close the old ledger and invite customers to settle up. Who's paid today?",
  },
  "ritual.noOutstanding": { bn: "কারো বাকি নেই — খাতা আগে থেকেই পরিষ্কার!", en: "No one owes anything — the ledger's already clear!" },
  "ritual.markSettled": { bn: "শোধ হয়েছে", en: "Settled" },
  "ritual.settledBadge": { bn: "✓ শোধ", en: "✓ Settled" },
  "ritual.finish": { bn: "নতুন বছর শুরু করুন", en: "Start the new year" },
  "ritual.celebrationTitle": { bn: "শুভ নববর্ষ!", en: "Happy New Year!" },
  "ritual.celebrationBody": {
    bn: "নতুন বছর শুরু হলো — নতুন খাতায় নতুন হিসাব।",
    en: "A fresh year begins — new ledger, new accounts.",
  },
  "ritual.remainingNote": {
    bn: "এখনও কিছু বাকি আছে — চিন্তা নেই, খাতায় থেকেই যাবে।",
    en: "Some credit is still outstanding — no worries, it stays right there in the ledger.",
  },

  "glossary.baki": {
    bn: "বাকি মানে ধারে বিক্রি — গ্রাহক এখন পণ্য নেয়, পরে টাকা দেয়। দোকানদার সেই হিসাব খাতায় রাখেন।",
    en: "Baki = a credit sale. The customer takes goods now and pays later; the shop keeps track of what's owed.",
  },
  "glossary.khata": {
    bn: "খাতা মানে হিসাবের বই — দোকানদাররা এতে দৈনিক বিক্রি ও বাকির হিসাব হাতে লেখেন।",
    en: "Khata = a ledger book. Shopkeepers write daily sales and credit (baki) into one by hand.",
  },
  "glossary.mudiDokan": {
    bn: "মুদি দোকান মানে পাড়ার মুদিখানা — বাংলাদেশে এমন ৪৫ লাখের বেশি দোকান আছে।",
    en: "Mudi dokan = a neighborhood grocery shop. Bangladesh has 4.5 million+ of them.",
  },
  "glossary.taka": {
    bn: "টাকা (৳) বাংলাদেশের মুদ্রা।",
    en: "Taka (৳) is Bangladesh's currency.",
  },

  "mic.tapToSpeak": { bn: "কথা বলতে চাপুন", en: "Tap to speak" },
  "mic.speakInLang": { bn: "বাংলায় বলুন", en: "Speak in English" },
  "mic.requesting": { bn: "অনুমতি চাওয়া হচ্ছে...", en: "Requesting permission..." },
  "mic.listening": { bn: "শুনছি...", en: "Listening..." },
  "mic.secondsLeft": { bn: "সেকেন্ড বাকি", en: "seconds left" },
  "mic.cancel": { bn: "বাতিল করুন", en: "Cancel" },
  "mic.stop": { bn: "রেকর্ডিং থামান", en: "Stop recording" },
  "mic.speakThenStop": { bn: "বলুন... শেষ হলে থামুন চাপুন", en: "Speak... tap stop when you're done" },
  "mic.deniedTitle": { bn: "মাইক্রোফোন ব্যবহারের অনুমতি দেওয়া হয়নি", en: "Microphone permission was not granted" },
  "mic.deniedBody": {
    bn: "ব্রাউজারের ঠিকানা বারে (address bar) মাইক্রোফোন আইকনে চেপে অনুমতি দিন, তারপর আবার চেষ্টা করুন।",
    en: "Tap the microphone icon in the browser's address bar to allow it, then try again.",
  },
  "mic.unsupported": {
    bn: "এই ব্রাউজারে ভয়েস রেকর্ডিং সমর্থিত নয়। Chrome ব্যবহার করে দেখুন।",
    en: "Voice recording isn't supported in this browser. Try Chrome.",
  },
  "mic.orTrySample": { bn: "অথবা একটি নমুনা শুনুন", en: "Or try a sample — no mic needed" },
  "mic.sampleCreditSale": { bn: "রহিম ভাইকে ৫০ টাকার চাল বাকি দিলাম", en: "Gave Rahim bhai ৳50 of rice on credit" },
  "mic.sampleCashSale": { bn: "করিম সাহেবের কাছ থেকে দুধ বিক্রি করে ১০০ টাকা নগদ পেলাম", en: "Received ৳100 cash from Karim shaheb for milk" },
  "mic.sampleRepayment": { bn: "সালমা আপা ২০০ টাকা বাকি শোধ করেছেন", en: "Salma apa paid back ৳200 of her credit" },

  "record.dialogLabel": { bn: "নতুন হিসাব বলুন", en: "Speak a new transaction" },
  "record.offline": { bn: "অফলাইনে আছেন — ইন্টারনেট আসলে এটি প্রসেস হবে", en: "You're offline — this will be processed once you're back online" },
  "record.ok": { bn: "ঠিক আছে", en: "OK" },
  "record.speakAgain": { bn: "নতুন করে বলুন", en: "Start over" },
  "error.network": { bn: "ইন্টারনেট সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।", en: "Check your internet connection and try again." },
  "error.timeout": { bn: "উত্তর দিতে বেশি সময় লাগছে। আবার চেষ্টা করুন।", en: "That took too long to answer. Please try again." },
  "error.server": { bn: "সাময়িক সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।", en: "Something went wrong. Please try again in a bit." },
  "error.invalidJson": { bn: "কথা বোঝা যায়নি — আবার বলুন", en: "Couldn't understand that — please say it again" },

  "confirm.type": { bn: "লেনদেনের ধরন", en: "Transaction type" },
  "confirm.customer": { bn: "কাস্টমার", en: "Customer" },
  "confirm.customerPlaceholder": { bn: "নাম লিখুন (ঐচ্ছিক)", en: "Enter a name (optional)" },
  "confirm.item": { bn: "পণ্য", en: "Item" },
  "confirm.itemPlaceholder": { bn: "যেমন: ডাল", en: "e.g. lentils" },
  "confirm.amount": { bn: "টাকা", en: "Amount (৳)" },
  "confirm.unsure": { bn: "নিশ্চিত নয় — যাচাই করুন", en: "Not sure — please check" },
  "confirm.editRedo": { bn: "✎ আবার বলুন", en: "✎ Say again" },
  "confirm.save": { bn: "✓ খাতায় লিখুন", en: "✓ Save to ledger" },
  "confirm.unclearTitle": { bn: "কথা বোঝা যায়নি — আবার বলুন", en: "Couldn't understand that — please say it again" },
  "confirm.sayAgain": { bn: "আবার বলুন", en: "Say it again" },

  "parsing.writing": { bn: "লেখা হচ্ছে...", en: "Writing it in..." },

  "khata.header": { bn: "আজকের খাতা", en: "Today's Ledger" },
  "khata.speakSummaryAria": { bn: "আজকের হিসাব শুনুন", en: "Hear today's summary" },
  "khata.toggleNumeralsAria": { bn: "সংখ্যা পদ্ধতি পরিবর্তন করুন", en: "Switch numeral style" },
  "khata.cashToday": { bn: "আজকের নগদ", en: "Cash today" },
  "khata.creditToday": { bn: "আজকে বাকি", en: "Credit today" },
  "khata.totalOutstanding": { bn: "মোট বকেয়া", en: "Total outstanding" },
  "khata.empty": { bn: "প্রথম হিসাব বলুন", en: "Speak your first transaction" },
  "khata.downloadCsv": { bn: "CSV হিসেবে ডাউনলোড করুন", en: "Download as CSV" },

  "customers.header": { bn: "কাস্টমার ও বাকি", en: "Customers & Credit" },
  "customers.empty": { bn: "এখনো কোনো কাস্টমার নেই", en: "No customers yet" },
  "customers.paidOff": { bn: "পরিশোধিত", en: "Paid off" },

  "detail.back": { bn: "পেছনে যান", en: "Go back" },
  "detail.totalBaki": { bn: "মোট বাকি", en: "Total credit owed" },
  "detail.amountPlaceholder": { bn: "কত টাকা", en: "Amount" },
  "detail.repayBaki": { bn: "বাকি শোধ", en: "Repay credit" },
  "detail.history": { bn: "লেনদেনের ইতিহাস", en: "Transaction history" },
  "detail.noHistory": { bn: "এখনো কোনো লেনদেন নেই", en: "No transactions yet" },
  "detail.viewAllCustomers": { bn: "সব কাস্টমার দেখুন", en: "View all customers" },

  "summary.header": { bn: "সারাংশ", en: "Summary" },
  "summary.today": { bn: "আজকে", en: "Today" },
  "summary.last7Days": { bn: "গত ৭ দিন", en: "Last 7 days" },
  "summary.cashSale": { bn: "নগদ বিক্রি", en: "Cash sales" },
  "summary.creditGiven": { bn: "বাকি দেওয়া", en: "Credit given" },
  "summary.creditRepaid": { bn: "বাকি শোধ", en: "Credit repaid" },
  "summary.weeklyInsight": { bn: "সাপ্তাহিক বিশ্লেষণ", en: "Weekly insight" },
  "summary.viewInsight": { bn: "বিশ্লেষণ দেখুন", en: "View insight" },
  "summary.insightLoading": { bn: "একটু সময় লাগতে পারে...", en: "This can take a moment..." },
  "summary.insightErrorTimeout": { bn: "উত্তর দিতে বেশি সময় লাগছে। আবার চেষ্টা করুন।", en: "That took too long. Please try again." },
  "summary.insightErrorGeneric": { bn: "এই মুহূর্তে বিশ্লেষণ আনা যায়নি। আবার চেষ্টা করুন।", en: "Couldn't fetch the insight right now. Please try again." },
  "summary.viewAgain": { bn: "নতুন করে দেখুন", en: "Refresh" },
  "summary.topBaki": { bn: "সবচেয়ে বেশি বাকি", en: "Highest outstanding credit" },
  "summary.noBaki": { bn: "কারো বাকি নেই", en: "No one owes credit" },
  "summary.share": { bn: "ছবি হিসেবে শেয়ার করুন", en: "Share as an image" },

  "auth.signupTitle": { bn: "সাইন আপ করুন", en: "Sign up" },
  "auth.signupCta": { bn: "সাইন আপ করুন", en: "Sign up" },
  "auth.signupNameLabel": { bn: "দোকানের নাম বা আপনার নাম", en: "Shop name or your name" },
  "auth.loginTitle": { bn: "লগইন করুন", en: "Log in" },
  "auth.loginCta": { bn: "লগইন করুন", en: "Log in" },
  "auth.loginNameLabel": { bn: "আপনার নাম", en: "Your name" },
  "auth.namePlaceholder": { bn: "যেমন: রহিম স্টোর", en: "e.g. Rahim Store" },
  "auth.email": { bn: "ইমেইল", en: "Email" },
  "auth.password": { bn: "পাসওয়ার্ড", en: "Password" },
  "auth.privacyNote": {
    bn: "শুধু আপনার ফোনে সংরক্ষিত হবে — কোনো সার্ভারে পাঠানো হয় না",
    en: "Stored only on your phone — never sent to a server",
  },
} satisfies Record<string, Entry>;

export type DictKey = keyof typeof dict;

interface LangContextValue {
  lang: Lang;
  toggle: () => void;
}

const LangContext = createContext<LangContextValue | null>(null);

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "en" ? "en" : "bn";
  } catch {
    return "bn";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStoredLang);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const toggle = () => setLang((l) => (l === "bn" ? "en" : "bn"));

  return <LangContext.Provider value={{ lang, toggle }}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within a LangProvider");
  return ctx;
}

export function useT(): (key: DictKey) => string {
  const { lang } = useLang();
  return (key: DictKey) => dict[key][lang];
}
