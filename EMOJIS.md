# Icons used in Haal Khata

Every plain-text emoji from the original build has been swapped for a matching
hand-illustrated icon (from `emoji/`, served at runtime from `public/emoji/`),
sized in px to match the emoji it replaced exactly. Two emoji had no provided
replacement and were left as-is.

| Original emoji | Icon file | Used for | File(s) |
|---|---|---|---|
| 🎙️ | `mic.png` | Record button | `BottomNav.tsx` (24px), `WelcomePage.tsx` (24px), `MicRecorder.tsx` (30px) |
| 🧾 | *(kept as emoji — no replacement provided)* | "Track every baki" feature card | `WelcomePage.tsx` |
| 🔒 | `lock.png` | "Stays on your phone" feature card | `WelcomePage.tsx` (24px) |
| 📖 | `book.png` | "Ledger" bottom-nav tab | `BottomNav.tsx` (20px) |
| 👥 | `people2.png` | "Customers" bottom-nav tab | `BottomNav.tsx` (20px) |
| 📊 | `analytics2.png` | "Summary" bottom-nav tab | `BottomNav.tsx` (20px) |
| 🕰️ | `watch2.png` | "History" bottom-nav tab | `BottomNav.tsx` (20px) |
| 🔊 | `sound2.png` | "Hear today's summary" button | `KhataPage.tsx` (14px) |
| 📤 | `share.png` | "Share as an image" button | `SummaryPage.tsx` (16px) |
| 📥 | `mail.png` | Offline / queued-for-sync state | `RecordFlow.tsx` (30px) |
| ⬇️ | `downarrow.png` | Empty-ledger hint arrow | `EmptyState.tsx` (36px) |
| 🪔 | `lamp.png` | Haal Khata ritual button/header | `Layout.tsx` (12px), `SummaryPage.tsx` (16px), `HaalKhataRitual.tsx` (36px header, 24px falling sweet) |
| 🍬 | *(kept as emoji — no replacement provided)* | Haal Khata ritual sweets | `HaalKhataRitual.tsx` |
| 🧁 | `cake.png` | Haal Khata ritual sweets | `HaalKhataRitual.tsx` (24px) |
| 🍯 | `honey.png` | Haal Khata ritual sweets | `HaalKhataRitual.tsx` (24px) |
| ✨ | `sparkle.png` | Haal Khata ritual sweets | `HaalKhataRitual.tsx` (24px) |
| 🎉 | `confetti.png` | New-year celebration screen | `HaalKhataRitual.tsx` (48px) |
| 📄 | `due-receipt.png` | "Download dues receipt" button | `HaalKhataRitual.tsx` (14px, two places) |

**Not used:** `emoji/syncing.png` — no emoji/feature in the app currently
corresponds to a "syncing" icon, so it wasn't wired in. Left in `emoji/`
in case a future sync-status feature wants it.

Rendered via a shared `<EmojiIcon src="…" size={N} />` component
(`src/components/EmojiIcon.tsx`) — an `<img>` sized in px rather than a
text-scaled glyph, since these are illustrations, not font characters.
