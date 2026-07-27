import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en" | "ko";

const LANG_KEY = "lal-khata-lang";
const LANG_ORDER: Lang[] = ["bn", "en", "ko"];

type Entry = { bn: string; en: string; ko: string };

// UI-chrome strings only — spoken transcripts, customer names, and items a
// shopkeeper actually says stay exactly as spoken (that's real data, not UI
// copy). This dictionary exists so someone who can't read Bangla can still
// understand every screen and button in the app.
export const dict = {
  "nav.khata": { bn: "খাতা", en: "Ledger", ko: "장부" },
  "nav.customers": { bn: "কাস্টমার", en: "Customers", ko: "고객" },
  "nav.summary": { bn: "সারাংশ", en: "Summary", ko: "요약" },
  "nav.mainMenu": { bn: "প্রধান মেনু", en: "Main menu", ko: "메인 메뉴" },
  "nav.mic": { bn: "হিসাব বলার জন্য মাইক চাপুন", en: "Tap the mic to speak a transaction", ko: "거래를 말하려면 마이크를 누르세요" },
  "layout.logout": { bn: "লগআউট", en: "Log out", ko: "로그아웃" },

  "type.creditSale": { bn: "বাকি বিক্রি", en: "Credit sale", ko: "외상 판매" },
  "type.cashSale": { bn: "নগদ বিক্রি", en: "Cash sale", ko: "현금 판매" },
  "type.repayment": { bn: "বাকি শোধ", en: "Repayment", ko: "외상 상환" },
  "common.cash": { bn: "নগদ", en: "Cash", ko: "현금" },
  "common.confirm": { bn: "নিশ্চিত", en: "Confirm", ko: "확인" },
  "common.tryAgain": { bn: "আবার চেষ্টা করুন", en: "Try again", ko: "다시 시도" },
  "common.close": { bn: "বন্ধ করুন", en: "Close", ko: "닫기" },
  "common.heard": { bn: "শোনা গেছে", en: "Heard", ko: "들린 내용" },

  "welcome.title": { bn: "হাল খাতা", en: "Haal Khata", ko: "할 카타" },
  "welcome.subtitle": { bn: "হাল খাতা — মুখে বলে হিসাব রাখুন", en: "Haal Khata — Voice-First Bookkeeper", ko: "할 카타 — 말로 관리하는 장부" },
  "welcome.poweredBy": { bn: "Google Gemma দ্বারা চালিত", en: "Powered by Google Gemma", ko: "Google Gemma로 구동됨" },
  "welcome.pitch": {
    bn: "মুদি দোকানের হিসাব রাখুন কথা বলে — লিখতে হবে না, টাইপ করতে হবে না। বাংলায়, সহজে, নিজের ফোনেই।",
    en: "Keep a mudi dokan's ledger just by speaking — no writing, no typing. In Bangla, simply, right on your own phone.",
    ko: "말만으로 구멍가게 장부를 관리하세요 — 쓰거나 입력할 필요 없이. 간단하게, 바로 내 휴대폰에서.",
  },
  "welcome.stat1.value": { bn: "৪৫ লাখ+", en: "4.5M+", ko: "450만+" },
  "welcome.stat1.label": { bn: "মুদি দোকান বাংলাদেশে", en: "mudi dokans in Bangladesh", ko: "방글라데시의 구멍가게" },
  "welcome.stat2.value": { bn: "৭৩%+", en: "73%+", ko: "73%+" },
  "welcome.stat2.label": { bn: "বিক্রি হয় বাকিতে", en: "of sales are on credit (baki)", ko: "외상(바키)으로 이루어지는 판매" },
  "welcome.stat3.value": { bn: "৯৪%", en: "94%", ko: "94%" },
  "welcome.stat3.label": { bn: "পরিবার মুদি দোকান থেকে কেনে", en: "of households shop at one", ko: "가정이 구멍가게에서 장을 봄" },
  "welcome.feature1.title": { bn: "কথা বলে লিখুন", en: "Speak it in", ko: "말로 입력하기" },
  "welcome.feature1.body": { bn: "টাইপ নয় — শুধু বলুন, খাতায় লেখা হয়ে যাবে।", en: "No typing — just speak, and it's written into the ledger.", ko: "입력할 필요 없이 — 말만 하면 장부에 기록됩니다." },
  "welcome.feature2.title": { bn: "বাকি মনে রাখুন", en: "Track every baki", ko: "모든 외상 기록하기" },
  "welcome.feature2.body": { bn: "কে কত বাকি রেখেছে, সব এক জায়গায়।", en: "Who owes how much on credit — all in one place.", ko: "누가 얼마나 외상을 졌는지 한곳에서 확인하세요." },
  "welcome.feature3.title": { bn: "আপনার ফোনেই থাকে", en: "Stays on your phone", ko: "내 휴대폰에만 저장" },
  "welcome.feature3.body": { bn: "কোনো অ্যাকাউন্ট লাগে না — আপনার ডেটা আপনার কাছেই।", en: "No account needed — your data stays with you.", ko: "계정이 필요 없어요 — 내 데이터는 나만 가지고 있어요." },
  "welcome.signup": { bn: "সাইন আপ", en: "Sign up", ko: "회원가입" },
  "welcome.login": { bn: "লগইন", en: "Log in", ko: "로그인" },
  "welcome.privacyNote": { bn: "শুধু আপনার ফোনে থাকে — কোনো সার্ভারে যায় না", en: "Stays on your phone only — never sent to a server", ko: "오직 내 휴대폰에만 저장되며 — 서버로 전송되지 않습니다" },
  "welcome.whyRedInfo": { bn: "কেন \"হাল খাতা\"?", en: "Why \"Haal Khata\"? Why red?", ko: "왜 \"할 카타\"일까요? 왜 빨간색일까요?" },
  "welcome.langToggleHint": { bn: "ভাষা", en: "Language", ko: "언어" },

  "story.title": { bn: "কেন \"হাল খাতা\"? কেন লাল রঙ?", en: "Why \"Haal Khata\"? Why red?", ko: "왜 \"할 카타\"일까요? 왜 빨간색일까요?" },
  "story.body1": {
    bn: "৪৩০ বছরেরও বেশি সময় ধরে বাংলার দোকানদাররা প্রতি পহেলা বৈশাখে (বাংলা নববর্ষে) নতুন খাতা খোলেন — একে বলে হালখাতা। পুরনো খাতা বন্ধ করে, গ্রাহকদের বাকি শোধ করার আমন্ত্রণ জানিয়ে, মিষ্টি ও ছোট উপহার দিয়ে নতুন বছর শুরু হতো।",
    en: "For over 430 years, Bengali shopkeepers have opened a new ledger every Pohela Boishakh (Bengali New Year) — a tradition called Haal Khata. They'd close the old book, invite customers to settle their baki (credit), and welcome them with sweets and small gifts to start the year fresh.",
    ko: "430년이 넘도록 벵골 상인들은 매년 포헬라 보이샤크(벵골 신년)에 새 장부를 엽니다 — 이를 할 카타라고 부릅니다. 옛 장부를 닫고, 고객들에게 외상(바키)을 갚도록 초대하며, 달콤한 음식과 작은 선물로 새해를 맞이했습니다.",
  },
  "story.body2": {
    bn: "খাতাটি প্রায়ই লাল কাপড়ে বাঁধা থাকতো — মজবুত, আর গোপনে বদলানো যায় না বলেই গ্রাহকরা এটি বিশ্বাস করতেন। এই বিশ্বাসই আসল কথা — লাল রংটা শুধু সাজ নয়।",
    en: "The ledger was almost always bound in red cloth — sturdy, and impossible to quietly alter, which is exactly why customers trusted it. That trust is the real point — the red isn't just decoration.",
    ko: "장부는 거의 항상 빨간 천으로 묶여 있었습니다 — 튼튼하고 몰래 바꿀 수 없었기에 고객들이 이를 신뢰했습니다. 그 신뢰가 핵심이며, 빨간색은 단순한 장식이 아닙니다.",
  },
  "story.body3": {
    bn: "এই অ্যাপ, হাল খাতা, সেই একই বিশ্বাসকে ডিজিটাল রূপ দিয়েছে — প্রতিটি কথা বলা হিসাব হয়ে যায় একটি স্থায়ী এন্ট্রি, হাতে লেখার বদলে মুখে বলা, তবু কেন্দ্রে সেই বাকি — যার উপর মুদি দোকানের প্রায় ৭৩%+ বিক্রি নির্ভর করে।",
    en: "This app, Haal Khata, digitizes that same trust — every spoken transaction becomes a permanent entry, spoken instead of hand-written, still centered on baki, the credit system ~73%+ of mudi dokan sales run on.",
    ko: "이 앱, 할 카타는 그 신뢰를 디지털로 옮겨왔습니다 — 말로 한 모든 거래가 영구적인 기록이 되며, 손으로 쓰는 대신 말로 하지만, 여전히 구멍가게 매출의 약 73%+가 의존하는 바키(외상)를 중심에 둡니다.",
  },

  "ritual.button": { bn: "হালখাতা করুন", en: "Do Haal Khata", ko: "할 카타 하기" },
  "ritual.title": { bn: "শুভ হালখাতা!", en: "Happy Haal Khata!", ko: "즐거운 할 카타!" },
  "ritual.intro": {
    bn: "পহেলা বৈশাখে দোকানদাররা পুরনো খাতা বন্ধ করে গ্রাহকদের বাকি শোধ করার আমন্ত্রণ জানান। আজ কে কে শোধ করলেন?",
    en: "On Pohela Boishakh, shopkeepers close the old ledger and invite customers to settle up. Who's paid today?",
    ko: "포헬라 보이샤크에 상인들은 옛 장부를 닫고 고객들에게 외상을 갚도록 초대합니다. 오늘 누가 갚았나요?",
  },
  "ritual.noOutstanding": { bn: "কারো বাকি নেই — খাতা আগে থেকেই পরিষ্কার!", en: "No one owes anything — the ledger's already clear!", ko: "아무도 외상이 없어요 — 장부가 이미 깨끗합니다!" },
  "ritual.markSettled": { bn: "শোধ হয়েছে", en: "Settled", ko: "상환 완료" },
  "ritual.settledBadge": { bn: "✓ শোধ", en: "✓ Settled", ko: "✓ 상환 완료" },
  "ritual.finish": { bn: "নতুন বছর শুরু করুন", en: "Start the new year", ko: "새해 시작하기" },
  "ritual.celebrationTitle": { bn: "শুভ নববর্ষ!", en: "Happy New Year!", ko: "새해 복 많이 받으세요!" },
  "ritual.celebrationBody": {
    bn: "নতুন বছর শুরু হলো — নতুন খাতায় নতুন হিসাব।",
    en: "A fresh year begins — new ledger, new accounts.",
    ko: "새해가 시작됩니다 — 새 장부, 새 출발.",
  },
  "ritual.remainingNote": {
    bn: "এখনও কিছু বাকি আছে — চিন্তা নেই, খাতায় থেকেই যাবে।",
    en: "Some credit is still outstanding — no worries, it stays right there in the ledger.",
    ko: "아직 남은 외상이 있어요 — 걱정 마세요, 장부에 그대로 남아 있습니다.",
  },

  "glossary.baki": {
    bn: "বাকি মানে ধারে বিক্রি — গ্রাহক এখন পণ্য নেয়, পরে টাকা দেয়। দোকানদার সেই হিসাব খাতায় রাখেন।",
    en: "Baki = a credit sale. The customer takes goods now and pays later; the shop keeps track of what's owed.",
    ko: "바키(Baki)는 외상 판매를 뜻합니다 — 고객이 지금 물건을 가져가고 나중에 돈을 냅니다. 상인은 이를 장부에 기록해 둡니다.",
  },
  "glossary.khata": {
    bn: "খাতা মানে হিসাবের বই — দোকানদাররা এতে দৈনিক বিক্রি ও বাকির হিসাব হাতে লেখেন।",
    en: "Khata = a ledger book. Shopkeepers write daily sales and credit (baki) into one by hand.",
    ko: "카타(Khata)는 장부, 즉 회계 노트를 뜻합니다 — 상인들은 여기에 매일의 매출과 외상을 손으로 적습니다.",
  },
  "glossary.mudiDokan": {
    bn: "মুদি দোকান মানে পাড়ার মুদিখানা — বাংলাদেশে এমন ৪৫ লাখের বেশি দোকান আছে।",
    en: "Mudi dokan = a neighborhood grocery shop. Bangladesh has 4.5 million+ of them.",
    ko: "무디 도칸(Mudi dokan)은 동네 구멍가게를 뜻합니다 — 방글라데시에는 450만 개 이상이 있습니다.",
  },
  "glossary.taka": {
    bn: "টাকা (৳) বাংলাদেশের মুদ্রা।",
    en: "Taka (৳) is Bangladesh's currency.",
    ko: "타카(৳)는 방글라데시의 화폐입니다.",
  },

  "mic.tapToSpeak": { bn: "কথা বলতে চাপুন", en: "Tap to speak", ko: "눌러서 말하기" },
  "mic.speakInLang": { bn: "বাংলায় বলুন", en: "Speak in English", ko: "한국어로 말하세요" },
  "mic.requesting": { bn: "অনুমতি চাওয়া হচ্ছে...", en: "Requesting permission...", ko: "권한을 요청하는 중..." },
  "mic.listening": { bn: "শুনছি...", en: "Listening...", ko: "듣는 중..." },
  "mic.secondsLeft": { bn: "সেকেন্ড বাকি", en: "seconds left", ko: "초 남음" },
  "mic.cancel": { bn: "বাতিল করুন", en: "Cancel", ko: "취소" },
  "mic.stop": { bn: "রেকর্ডিং থামান", en: "Stop recording", ko: "녹음 중지" },
  "mic.speakThenStop": { bn: "বলুন... শেষ হলে থামুন চাপুন", en: "Speak... tap stop when you're done", ko: "말씀하세요... 끝나면 중지를 누르세요" },
  "mic.deniedTitle": { bn: "মাইক্রোফোন ব্যবহারের অনুমতি দেওয়া হয়নি", en: "Microphone permission was not granted", ko: "마이크 사용 권한이 허용되지 않았습니다" },
  "mic.deniedBody": {
    bn: "ব্রাউজারের ঠিকানা বারে (address bar) মাইক্রোফোন আইকনে চেপে অনুমতি দিন, তারপর আবার চেষ্টা করুন।",
    en: "Tap the microphone icon in the browser's address bar to allow it, then try again.",
    ko: "브라우저 주소창의 마이크 아이콘을 눌러 권한을 허용한 뒤 다시 시도하세요.",
  },
  "mic.unsupported": {
    bn: "এই ব্রাউজারে ভয়েস রেকর্ডিং সমর্থিত নয়। Chrome ব্যবহার করে দেখুন।",
    en: "Voice recording isn't supported in this browser. Try Chrome.",
    ko: "이 브라우저에서는 음성 녹음이 지원되지 않습니다. Chrome을 사용해 보세요.",
  },
  "mic.orTrySample": { bn: "অথবা একটি নমুনা শুনুন", en: "Or try a sample — no mic needed", ko: "또는 샘플을 들어보세요 — 마이크가 필요 없어요" },
  "mic.sampleCreditSale": { bn: "রহিম ভাইকে ৫০ টাকার চাল বাকি দিলাম", en: "Gave Rahim bhai ৳50 of rice on credit", ko: "라힘 형에게 쌀 50타카어치를 외상으로 줬어요" },
  "mic.sampleCashSale": { bn: "করিম সাহেবের কাছ থেকে দুধ বিক্রি করে ১০০ টাকা নগদ পেলাম", en: "Received ৳100 cash from Karim shaheb for milk", ko: "카림 씨에게 우유를 팔고 현금 100타카를 받았어요" },
  "mic.sampleRepayment": { bn: "সালমা আপা ২০০ টাকা বাকি শোধ করেছেন", en: "Salma apa paid back ৳200 of her credit", ko: "살마 누나가 외상 200타카를 갚았어요" },

  "record.dialogLabel": { bn: "নতুন হিসাব বলুন", en: "Speak a new transaction", ko: "새 거래 말하기" },
  "record.offline": { bn: "অফলাইনে আছেন — ইন্টারনেট আসলে এটি প্রসেস হবে", en: "You're offline — this will be processed once you're back online", ko: "오프라인 상태입니다 — 인터넷이 연결되면 처리됩니다" },
  "record.ok": { bn: "ঠিক আছে", en: "OK", ko: "확인" },
  "record.speakAgain": { bn: "নতুন করে বলুন", en: "Start over", ko: "처음부터 다시 말하기" },
  "error.network": { bn: "ইন্টারনেট সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।", en: "Check your internet connection and try again.", ko: "인터넷 연결을 확인하고 다시 시도하세요." },
  "error.timeout": { bn: "উত্তর দিতে বেশি সময় লাগছে। আবার চেষ্টা করুন।", en: "That took too long to answer. Please try again.", ko: "응답하는 데 시간이 너무 오래 걸립니다. 다시 시도하세요." },
  "error.server": { bn: "সাময়িক সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।", en: "Something went wrong. Please try again in a bit.", ko: "문제가 발생했습니다. 잠시 후 다시 시도하세요." },
  "error.invalidJson": { bn: "কথা বোঝা যায়নি — আবার বলুন", en: "Couldn't understand that — please say it again", ko: "이해하지 못했습니다 — 다시 말씀해 주세요" },

  "confirm.type": { bn: "লেনদেনের ধরন", en: "Transaction type", ko: "거래 유형" },
  "confirm.customer": { bn: "কাস্টমার", en: "Customer", ko: "고객" },
  "confirm.customerPlaceholder": { bn: "নাম লিখুন (ঐচ্ছিক)", en: "Enter a name (optional)", ko: "이름 입력 (선택 사항)" },
  "confirm.item": { bn: "পণ্য", en: "Item", ko: "품목" },
  "confirm.itemPlaceholder": { bn: "যেমন: ডাল", en: "e.g. lentils", ko: "예: 렌틸콩" },
  "confirm.amount": { bn: "টাকা", en: "Amount (৳)", ko: "금액 (৳)" },
  "confirm.unsure": { bn: "নিশ্চিত নয় — যাচাই করুন", en: "Not sure — please check", ko: "확실하지 않음 — 확인해 주세요" },
  "confirm.editRedo": { bn: "✎ আবার বলুন", en: "✎ Say again", ko: "✎ 다시 말하기" },
  "confirm.save": { bn: "✓ খাতায় লিখুন", en: "✓ Save to ledger", ko: "✓ 장부에 저장" },
  "confirm.unclearTitle": { bn: "কথা বোঝা যায়নি — আবার বলুন", en: "Couldn't understand that — please say it again", ko: "이해하지 못했습니다 — 다시 말씀해 주세요" },
  "confirm.sayAgain": { bn: "আবার বলুন", en: "Say it again", ko: "다시 말하기" },

  "parsing.writing": { bn: "লেখা হচ্ছে...", en: "Writing it in...", ko: "기록하는 중..." },

  "khata.header": { bn: "আজকের খাতা", en: "Today's Ledger", ko: "오늘의 장부" },
  "khata.speakSummaryAria": { bn: "আজকের হিসাব শুনুন", en: "Hear today's summary", ko: "오늘의 요약 듣기" },
  "khata.toggleNumeralsAria": { bn: "সংখ্যা পদ্ধতি পরিবর্তন করুন", en: "Switch numeral style", ko: "숫자 표기 전환" },
  "khata.cashToday": { bn: "আজকের নগদ", en: "Cash today", ko: "오늘 현금" },
  "khata.creditToday": { bn: "আজকে বাকি", en: "Credit today", ko: "오늘 외상" },
  "khata.totalOutstanding": { bn: "মোট বকেয়া", en: "Total outstanding", ko: "총 미수금" },
  "khata.empty": { bn: "প্রথম হিসাব বলুন", en: "Speak your first transaction", ko: "첫 거래를 말해보세요" },
  "khata.downloadCsv": { bn: "CSV হিসেবে ডাউনলোড করুন", en: "Download as CSV", ko: "CSV로 다운로드" },

  "customers.header": { bn: "কাস্টমার ও বাকি", en: "Customers & Credit", ko: "고객 및 외상" },
  "customers.empty": { bn: "এখনো কোনো কাস্টমার নেই", en: "No customers yet", ko: "아직 고객이 없습니다" },
  "customers.paidOff": { bn: "পরিশোধিত", en: "Paid off", ko: "완납" },

  "detail.back": { bn: "পেছনে যান", en: "Go back", ko: "뒤로 가기" },
  "detail.totalBaki": { bn: "মোট বাকি", en: "Total credit owed", ko: "총 외상액" },
  "detail.amountPlaceholder": { bn: "কত টাকা", en: "Amount", ko: "금액" },
  "detail.repayBaki": { bn: "বাকি শোধ", en: "Repay credit", ko: "외상 상환" },
  "detail.history": { bn: "লেনদেনের ইতিহাস", en: "Transaction history", ko: "거래 내역" },
  "detail.noHistory": { bn: "এখনো কোনো লেনদেন নেই", en: "No transactions yet", ko: "아직 거래 내역이 없습니다" },
  "detail.viewAllCustomers": { bn: "সব কাস্টমার দেখুন", en: "View all customers", ko: "모든 고객 보기" },

  "summary.header": { bn: "সারাংশ", en: "Summary", ko: "요약" },
  "summary.today": { bn: "আজকে", en: "Today", ko: "오늘" },
  "summary.last7Days": { bn: "গত ৭ দিন", en: "Last 7 days", ko: "지난 7일" },
  "summary.cashSale": { bn: "নগদ বিক্রি", en: "Cash sales", ko: "현금 판매" },
  "summary.creditGiven": { bn: "বাকি দেওয়া", en: "Credit given", ko: "준 외상" },
  "summary.creditRepaid": { bn: "বাকি শোধ", en: "Credit repaid", ko: "상환된 외상" },
  "summary.weeklyInsight": { bn: "সাপ্তাহিক বিশ্লেষণ", en: "Weekly insight", ko: "주간 분석" },
  "summary.viewInsight": { bn: "বিশ্লেষণ দেখুন", en: "View insight", ko: "분석 보기" },
  "summary.insightLoading": { bn: "একটু সময় লাগতে পারে...", en: "This can take a moment...", ko: "시간이 조금 걸릴 수 있어요..." },
  "summary.insightErrorTimeout": { bn: "উত্তর দিতে বেশি সময় লাগছে। আবার চেষ্টা করুন।", en: "That took too long. Please try again.", ko: "응답하는 데 시간이 너무 오래 걸립니다. 다시 시도하세요." },
  "summary.insightErrorGeneric": { bn: "এই মুহূর্তে বিশ্লেষণ আনা যায়নি। আবার চেষ্টা করুন।", en: "Couldn't fetch the insight right now. Please try again.", ko: "지금은 분석을 가져올 수 없습니다. 다시 시도하세요." },
  "summary.viewAgain": { bn: "নতুন করে দেখুন", en: "Refresh", ko: "새로고침" },
  "summary.topBaki": { bn: "সবচেয়ে বেশি বাকি", en: "Highest outstanding credit", ko: "가장 많은 외상" },
  "summary.noBaki": { bn: "কারো বাকি নেই", en: "No one owes credit", ko: "외상이 있는 사람이 없습니다" },
  "summary.share": { bn: "ছবি হিসেবে শেয়ার করুন", en: "Share as an image", ko: "이미지로 공유" },
  "summary.shareFooter": {
    bn: "বাংলাদেশে ৭৩%+ মুদি দোকানের বিক্রি বাকিতে হয় — হাল খাতা কথা বলেই সেই হিসাব রাখে।",
    en: "73%+ of mudi dokan sales in Bangladesh run on credit — Haal Khata keeps track, just by voice.",
    ko: "방글라데시 구멍가게 매출의 73%+가 외상으로 이루어집니다 — 할 카타는 말만으로 그 기록을 지켜줍니다.",
  },

  "auth.signupTitle": { bn: "সাইন আপ করুন", en: "Sign up", ko: "회원가입" },
  "auth.signupCta": { bn: "সাইন আপ করুন", en: "Sign up", ko: "회원가입" },
  "auth.signupNameLabel": { bn: "দোকানের নাম বা আপনার নাম", en: "Shop name or your name", ko: "가게 이름 또는 이름" },
  "auth.loginTitle": { bn: "লগইন করুন", en: "Log in", ko: "로그인" },
  "auth.loginCta": { bn: "লগইন করুন", en: "Log in", ko: "로그인" },
  "auth.loginNameLabel": { bn: "আপনার নাম", en: "Your name", ko: "이름" },
  "auth.namePlaceholder": { bn: "যেমন: রহিম স্টোর", en: "e.g. Rahim Store", ko: "예: 라힘 스토어" },
  "auth.email": { bn: "ইমেইল", en: "Email", ko: "이메일" },
  "auth.password": { bn: "পাসওয়ার্ড", en: "Password", ko: "비밀번호" },
  "auth.privacyNote": {
    bn: "শুধু আপনার ফোনে সংরক্ষিত হবে — কোনো সার্ভারে পাঠানো হয় না",
    en: "Stored only on your phone — never sent to a server",
    ko: "내 휴대폰에만 저장되며 — 서버로 전송되지 않습니다",
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
    return v === "en" || v === "ko" ? v : "bn";
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

  // Cycles bn -> en -> ko -> bn. A single pill button flips through all
  // supported UI languages rather than a two-way toggle.
  const toggle = () => setLang((l) => LANG_ORDER[(LANG_ORDER.indexOf(l) + 1) % LANG_ORDER.length]);

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
