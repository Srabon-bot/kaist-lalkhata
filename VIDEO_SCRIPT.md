# Haal Khata — ~6:30 Demo Video Script

Target: MP4, screen recording + voiceover, ~6:30. Timestamps are targets,
not hard cuts — leave a few seconds of slack per section since live voice
demos rarely land exactly on time.

**Before recording:** seed the account with a handful of entries ahead of
time (2–3 customers, a mix of cash/credit sales) so Customers/Summary/
History don't look empty — then do 1–2 *new* entries live on camera as the
actual voice-input demo. Recording every single entry live is what eats
most of a demo's runtime for no payoff.

---

## 0:00–0:30 — Hook: the problem

**Screen:** black slide or a photo of a real paper khata / mudi dokan (if
you have one) → cut to the Welcome page stats cards (4.5M+, 73%+, 94%).

**VO:**
> "In Bangladesh, over 4.5 million neighborhood shops — mudi dokans — run
> on trust. 73% of their sales go on credit, tracked by hand in a paper
> ledger. One water stain, one lost page, and months of bookkeeping are
> gone. This is Haal Khata — a voice-first ledger that replaces the pen,
> without replacing the tradition."

---

## 0:30–1:30 — The tradition it's named after

**Screen:** Welcome page → tap "Why 'Haal Khata'? Why red?" → the story
modal opens. Slowly scroll through it as you narrate (don't just read the
card verbatim — paraphrase over it).

**VO:**
> "Haal Khata is a 430-year-old Bengali tradition. Its roots trace to the
> Mughal era — Emperor Akbar's 1584 calendar reform, and later Nawab
> Murshid Quli Khan's new-year tax ceremony, which local merchants adapted
> into their own custom: every Pohela Boishakh, the Bengali New Year,
> shopkeepers closed the old ledger and opened a new one.
>
> The new book was always bound in red cloth — sturdy, impossible to
> quietly alter, which is exactly why customers trusted it. Muslim
> shopkeepers opened it writing 'Bismillah'; Hindu traders performed a puja
> to Ganesh and Lakshmi. Two faiths, one shared ritual.
>
> Customers were invited back — not to buy, but to settle their baki —
> and welcomed with sweets. It was equal parts bookkeeping and goodwill.
> Our app carries that same trust into your pocket."

---

## 1:30–2:15 — Sign up

**Screen:** back to Welcome → tap Sign up → show the password strength
meter reacting live as you type → submit → Username modal → land on the
Ledger page. (Optionally show "Continue with Google" too, narrated over,
without fully completing it if you'd rather not show your real account.)

**VO:**
> "Getting started takes seconds — email and password, or one tap with
> Google. No paperwork, no typing required once you're in."

---

## 2:15–3:15 — The core feature: speaking a transaction

**Screen:** tap the mic button (FAB) → point out the short structure hint
on the mic sheet → speak a **real, live** transaction, e.g. a credit sale
("Rahim কে ৫০ টাকার চাল বাকি দিলাম") → the confirmation card fills in
customer/item/amount/type **instantly**, no loading spinner → confirm →
entry appears at the top of the ledger. Do a second one as a **cash sale**
to show both entry types.

**VO:**
> "This is the whole interaction: press, speak, confirm. No forms, and
> notice — no waiting either. The transcript gets turned into a structured
> entry — customer, item, amount, cash or credit — instantly, on the phone
> itself. Confidence scoring flags anything worth double-checking before
> it's ever saved."

---

## 3:15–4:00 — Why this doesn't call an AI API

**Screen:** no live UI needed here — a simple slide/graphic works: maybe
the actual 429 quota-exceeded error text, or a "20 requests / day" callout,
next to a "0 API calls" checkmark for the current version. Or, if there's
time, a quick split-screen of the mic sheet responding instantly vs. an
imagined loading spinner.

**VO:**
> "Here's a story worth telling, not hiding: the first working version of
> this sent every recording to Google's Gemini API. It worked great — until,
> mid-testing, the free tier's quota turned out to be twenty requests a day.
> Not twenty a minute — twenty, total, per day. With five judges each
> trying it live, that wall was maybe an hour away.
>
> So we rebuilt voice entry from scratch as its own local engine — no API,
> no quota, no network dependency at all. Real number-word parsing for
> Bangla, English, and Korean — Bangla numbers are irregular for every
> single value, so there's no shortcut, we had to research and encode the
> actual table. Real grammar-aware name and item extraction — Bangla
> postpositions, English prepositions, Korean particles — tuned to how each
> language actually marks who's who in a sentence. It's a trade: a little
> less forgiving of unusual phrasing than a full AI model would be, for
> zero risk of the app going down mid-demo. That felt like the right trade
> to make."

---

## 4:00–4:30 — Customers & repayment

**Screen:** tap Customers → show the list with running balances → tap into
one customer with an outstanding balance → show their transaction history
→ tap "Repay credit," type an amount, Confirm → balance updates live.

**VO:**
> "Every customer's baki is tracked automatically — no separate notebook
> per person. When they pay you back, one tap records the repayment and
> updates their balance instantly."

---

## 4:30–5:15 — Summary, AI insight, and sharing

**Screen:** tap Summary → show today/last-7-days totals → tap "View
insight" and let it load → scroll to "Highest outstanding credit" → tap
"Share as an image" and show the generated card.

**VO:**
> "The Summary page rolls everything up — today, this week, who owes the
> most. This is actually the one place left that does call Gemini — a
> single low-volume call that turns those numbers into a one-line insight
> in plain Bangla, nothing like the per-entry volume voice input used to
> need. When you want to show off a good week, one tap generates a
> shareable image card."

---

## 5:15–5:45 — History and correcting mistakes

**Screen:** tap History → point out an entry → tap "Roll back" on a
disposable/test entry → show it disappear from History, Summary, and the
customer's balance recompute.

**VO:**
> "Mistakes happen — a mis-heard name, a wrong amount. Roll back removes
> an entry everywhere it's counted, instantly, without ever needing to
> find a pen to cross something out."

---

## 5:45–6:15 — Do Haal Khata: the ritual, digitized

**Screen:** tap the "Do Haal Khata" button → the ritual modal opens →
show the "who's paid today" list → mark one settled → tap "Start the new
year" → the celebration screen.

**VO:**
> "And because the tradition itself matters, we built the actual ritual
> in — a digital Pohela Boishakh, where you close the books, mark who's
> settled up, and start the new year fresh. Same 430-year-old custom,
> now one tap."

---

## 6:15–6:40 — Built for everyone: offline, sync, language

**Screen:** quick language toggle demo (বাংলা → English → 한국어, whole UI
updates instantly, including a live voice entry if time allows). If
feasible, a quick cut showing the same account logged in on a second
device/browser with the same ledger already synced.

**VO:**
> "Remember voice entry runs entirely on the phone now — that's not just
> about surviving a demo, it means it works on a real shop floor with no
> signal, every single time. If a shopkeeper's helper needs the same khata
> on a second phone, it syncs automatically the moment they're both
> online — no manual backup, nothing to lose. And it speaks Bangla,
> English, or Korean, so this isn't just for one audience."

---

## 6:40–6:50 — Close

**Screen:** Welcome page, "Made with ♥ by Team 6" footer.

**VO:**
> "Haal Khata — 430 years of trust, now in your pocket. Built by Team 6."

---

## Shot list summary (for the editor)

1. Paper-ledger / stats hook
2. "Why Haal Khata?" story card
3. Sign up flow
4. Live voice entry ×2 (credit + cash) — instant, no spinner
5. The API-quota story: 20 req/day, the pivot to a local engine
6. Customer detail + repay credit
7. Summary + AI insight (the one remaining Gemini call) + share card
8. History + rollback
9. Do Haal Khata ritual
10. Language toggle (+ optional second-device sync)
11. Closing credit
