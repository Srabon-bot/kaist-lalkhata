# Haal Khata — Manual Test Checklist

Live app: https://haal-khata.vercel.app

How to use this file: go through each row, mark the **Result** column with
✅ (pass) or ❌ (fail). If something fails, add a short note (what happened
instead) right after the ✗. When you're done, send this whole file back.

Tip: test on your phone (real usage) for at least the mic/voice sections —
some of this (speech recognition, share sheet) behaves differently on
desktop Chrome vs. a phone.

---

## 1. Welcome page / first load

| # | Step | Expected | Result |
|---|------|----------|--------|
| 1.1 | Open https://haal-khata.vercel.app on a fresh/incognito browser | Welcome page loads, shows Bangla by default, no console errors | |
| 1.2 | Look at the background behind the red book | Festive scene (lanterns/bunting/lotus/mandala) is visibly **blurred/softened**, not sharp — eye should land on the book, not the background | |
| 1.3 | Tap the language toggle (top right) | Cycles between বাংলা / English / 한국어, all visible text switches language immediately | |
| 1.4 | Reload the page | Chosen language persists | |

## 2. Sign up (email/password)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 2.1 | Tap "সাইন আপ" / Sign Up | Auth modal opens with Google button + email/password fields | |
| 2.2 | Type a weak password (e.g. `abc`) | Password strength meter shows "weak" and lists missing requirements (length/upper/lower/number/symbol) | |
| 2.3 | Type a strong password | Meter updates to "strong"/"good" live as you type | |
| 2.4 | Enter a real email + strong password, mismatch the "confirm password" field | Clear inline error, form does not submit | |
| 2.5 | Fix confirm-password to match, submit | Signup succeeds, you're asked to pick a display name (Username modal) | |
| 2.6 | Enter a display name, submit | You land inside the app (Khata page) | |
| 2.7 | Try signing up again with the **same email** | Clear "account already exists" style error, not a crash/blank screen | |

## 3. Log in / log out

| # | Step | Expected | Result |
|---|------|----------|--------|
| 3.1 | Log out (from wherever the logout control is, e.g. settings/profile) | Returns to Welcome page | |
| 3.2 | Log in with correct email + password | Goes straight into the app (no username prompt this time, since it's a returning account) | |
| 3.3 | Log in with correct email + **wrong** password | Clear error message, stays on login form | |
| 3.4 | Log in with an email that doesn't exist | Clear error message | |
| 3.5 | Close the browser tab entirely, reopen and revisit the URL | You're still logged in (session cookie persists) | |

## 4. Google sign-in

| # | Step | Expected | Result |
|---|------|----------|--------|
| 4.1 | Log out, tap "Continue with Google" | Google account picker popup opens (no "not set up yet" message) | ✅ (confirmed working) |
| 4.2 | Pick your Google account and consent | Redirects back into the app; if this Google account has never signed in before, shows the username modal | ✅ (confirmed working) |
| 4.3 | Log out and sign in with Google again | Skips straight into the app (no username prompt second time) | |

## 5. Adding ledger entries — voice

| # | Step | Expected | Result |
|---|------|----------|--------|
| 5.1 | Tap the mic / record button | Mic permission prompt (first time), then recording UI appears | |
| 5.2 | Say something like "Rahim কে ৫০০ টাকা বাকি" (credit sale to Rahim, 500 taka) | Transcript appears, then a parsed confirmation card showing customer name, amount, and entry type | |
| 5.3 | Confirm the entry | Entry appears in the Khata / ledger list immediately | |
| 5.4 | Record a **cash sale** (no customer name, just an amount) | Parsed correctly as cash sale, no customer attached | |
| 5.5 | Record a **repayment** (customer paying back part of their baki) | Parsed as repayment, reduces that customer's outstanding balance | |
| 5.6 | Say something ambiguous/unclear | App shows low-confidence indicator or asks for correction rather than silently guessing wrong | |
| 5.7 | Edit a parsed entry before confirming (correct the amount or name) | Edited fields save correctly, entry marked as "edited" | |

## 6. Adding ledger entries — manual/typed (if available)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 6.1 | Add an entry without using the mic (typed/manual path, if the UI offers one) | Same result as voice entry — appears correctly in ledger | |

## 7. Customers

| # | Step | Expected | Result |
|---|------|----------|--------|
| 7.1 | Go to the Customers list | Shows every customer you've created via entries, each with a running balance | |
| 7.2 | Tap into a customer's detail page | Shows that customer's full entry history and correct total balance | |
| 7.3 | Create an entry for a customer name that's a near-duplicate of an existing one (e.g. different spacing/case) | Confirm whether it merges into the same customer or creates a new one — note which happened | |

## 8. Rollback / delete

| # | Step | Expected | Result |
|---|------|----------|--------|
| 8.1 | Roll back / delete an entry | Entry disappears from Khata, History, Summary, and the customer's balance updates accordingly | |
| 8.2 | Check that customer's balance after rollback | Balance recalculated correctly (as if that entry never happened) | |

## 9. History & Summary

| # | Step | Expected | Result |
|---|------|----------|--------|
| 9.1 | Open History page | Shows all live (non-deleted) entries in chronological order | |
| 9.2 | Open Summary page | Shows correct aggregate totals: cash sales, credit sales, repayments | |
| 9.3 | Confirm rolled-back entries from step 8 do **not** appear in History or count in Summary | | |

## 10. Book layout consistency (recent fix — please pay extra attention here)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 10.1 | On a wide/desktop-width browser window, open Khata (home), Customers, Summary, and History in turn | The book — the red cover/spine panel on the left plus the cream page card on the right — is the **exact same size** on every page, regardless of how much content each page has | |
| 10.2 | Specifically open Summary with several customers owing money (so "Highest outstanding credit" has multiple rows) | The book does **not** grow taller than the other pages — if the content is too tall to fit, only the cream page card scrolls internally (you'll see a scrollbar inside the card), the book/cover stays fixed | |
| 10.3 | Scroll down inside a tall Summary page | Content scrolls smoothly inside the page card; the red cover/spine panel next to it does not move or resize | |
| 10.4 | Repeat 10.1–10.3 on a phone-width screen | Same idea (fixed page height, internal scroll if content overflows) — cover/spine panel is expected to be hidden on mobile width, that's normal | |

## 11. "Why Haal Khata?" story content

| # | Step | Expected | Result |
|---|------|----------|--------|
| 11.1 | On the Welcome page, tap "কেন \"হাল খাতা\"?" (why Haal Khata) | A modal opens with 4 paragraphs of history — Mughal-era origins, the red-cloth ledger and its trust/religious significance, the Pohela Boishakh customer ritual, and how the app carries that tradition forward | |
| 11.2 | Switch language inside that modal to English, then Korean | All 4 paragraphs translate correctly and read naturally in each language (Korean version includes brief glosses like "무굴 황제 아크바르(Akbar)" for readers unfamiliar with the history) | |
| 11.3 | Scroll the story modal if content overflows | Scrolls smoothly inside the modal card | |

## 12. Export / share

| # | Step | Expected | Result |
|---|------|----------|--------|
| 12.1 | Export ledger as CSV | Downloads a CSV with correct entries/amounts/customers | |
| 12.2 | Use the "share card" feature (if present in UI) | Opens native share sheet (mobile) or downloads an image/card | |

## 13. Offline behavior

| # | Step | Expected | Result |
|---|------|----------|--------|
| 13.1 | Turn on Airplane mode / disconnect network | App still opens and shows previously loaded data (PWA/offline cache) | |
| 13.2 | While offline, add a new entry | Saves locally without error | |
| 13.3 | Reconnect to the internet | Entry automatically syncs to the server (no manual "sync" button needed) — check by reloading | |

## 14. Cross-device sync (the main new feature)

| # | Step | Expected | Result |
|---|------|----------|--------|
| 14.1 | On Device/Browser A, log in and add a new entry (note the exact customer name + amount) | Entry visible on Device A | |
| 14.2 | On a **second** device or a different browser (e.g. Chrome + Firefox, or your phone), log in with the **same account** | That same entry (from 14.1) appears automatically after login | |
| 14.3 | Add a **different** entry on Device B | Switch back to Device A, reload — the new entry from Device B appears | |
| 14.4 | Roll back an entry on Device A | Reload Device B — that entry is gone there too | |
| 14.5 | On Device A and Device B **simultaneously offline**, each create a customer with the exact same name (e.g. "Karim") | Bring both online — check Customers list: do they merge into one customer or does it error? Note what happened | |

## 15. Session security spot-checks

| # | Step | Expected | Result |
|---|------|----------|--------|
| 15.1 | Open browser dev tools → Application → Cookies, find `hk_session` | Cookie is marked `HttpOnly` and `Secure` (not readable by page JS, not sent over plain HTTP) | |
| 15.2 | Try visiting the app over `http://` (not https) if possible, or just confirm the URL bar always shows the padlock/https | Always HTTPS | |

## 16. General polish

| # | Step | Expected | Result |
|---|------|----------|--------|
| 16.1 | Resize browser window very small (phone width) and very large (desktop) | Layout stays usable, nothing overlaps/cuts off | |
| 16.2 | "Install app" / Add to Home Screen (PWA) on mobile | Installs and opens like a native app | |
| 16.3 | Check glossary tooltips (e.g. term explanations like "mudi dokan", "taka") | Tooltips/definitions show correctly in the current language | |

---

## Summary (fill in after testing)

- Total checks: ___
- Passed: ___
- Failed: ___
- Notes on any ❌ items:
