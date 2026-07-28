import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RecordFlow } from "./RecordFlow";
import { BookCover } from "./BookCover";
import { BookPage } from "./BookPage";
import { LeftLeaf } from "./LeftLeaf";
import { LangToggle } from "./LangToggle";
import { HaalKhataRitual } from "./HaalKhataRitual";
import { EmojiIcon } from "./EmojiIcon";
import { db, popOldestPendingRecording } from "../lib/db";
import { initSync } from "../lib/sync";
import { logout } from "../lib/api";
import { ENTERED_KEY, SHOP_NAME_KEY, ACCOUNT_ID_KEY } from "../pages/WelcomePage";
import { useT } from "../lib/i18n";

export function Layout() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [initialTranscript, setInitialTranscript] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [demoRitualOpen, setDemoRitualOpen] = useState(false);
  const navigate = useNavigate();
  const t = useT();

  // PRD F8: utterances transcribed while offline are queued locally; retry
  // them once we're back online (or on next load), surfacing the
  // confirmation card for review — never auto-writing a queued entry
  // without the shopkeeper's OK.
  useEffect(() => {
    if (recordOpen) return;

    let cancelled = false;
    const trySync = async () => {
      if (!navigator.onLine) return;
      const next = await popOldestPendingRecording();
      if (!next || cancelled) return;
      await db.pendingRecordings.delete(next.id!);
      setInitialTranscript(next.transcript);
      setRecordOpen(true);
    };

    void trySync();
    window.addEventListener("online", trySync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", trySync);
    };
  }, [recordOpen]);

  // Layout only mounts once a session has entered (RequireEntered in
  // App.tsx), so this is the right place to wire the connect/close sync
  // lifecycle described in lib/sync.ts — dispose on unmount (logout below).
  useEffect(() => initSync(), []);

  // The book closes (BookPage's closing animation) before we actually
  // navigate away — see handleClosed.
  const handleLogout = () => setClosing(true);

  const handleClosed = () => {
    // Clears the server session cookie too — best-effort, fire-and-forget
    // since we're navigating away regardless. The account itself
    // (email/password hash or Google link, plus the display name) stays in
    // Postgres so logging back in works like a real "welcome back", not a
    // fresh signup every time.
    void logout();
    try {
      localStorage.removeItem(ENTERED_KEY);
      localStorage.removeItem(SHOP_NAME_KEY);
      localStorage.removeItem(ACCOUNT_ID_KEY);
    } catch {
      /* ignore */
    }
    navigate("/welcome");
  };

  return (
    <div className="kantha-weave relative mx-auto flex h-dvh max-w-md flex-col bg-khata-red-deep pb-24">
      {/* Demo-only shortcut: opens the Haal Khata ritual from anywhere,
          without navigating to Summary first. Sits outside the book itself
          (fixed to the viewport, not the page spread) so it's always
          reachable mid-demo. */}
      <button
        type="button"
        onClick={() => setDemoRitualOpen(true)}
        aria-label={t("ritual.button")}
        className="fixed right-3 top-3 z-40 flex items-center gap-1 rounded-full bg-khata-red px-3 py-1.5 font-bangla text-xs font-semibold text-white shadow-lg"
      >
        <EmojiIcon src="lamp.png" size={12} />
        {t("ritual.button")}
      </button>
      {demoRitualOpen && <HaalKhataRitual onClose={() => setDemoRitualOpen(false)} />}

      {/* The flipped page — its own section, same size as the main app
          section, sitting in the (previously unused) space immediately to
          its left. Only meaningful once there's room for a real two-page
          spread (md+ / "pc or bigger display" per design review) — on a
          mobile-width viewport it's hidden outright rather than left to
          render off-screen, so its mount-animation work never runs there
          and mobile gets the plain content section, full-width, no book
          chrome eating into it. `bottom: 6rem` (not h-full) matches the
          root's own pb-24, since h-full on an absolutely positioned box
          resolves against the padding box (padding included) while
          <main>'s flex-1 only fills the content box (padding excluded) —
          using h-full here made this panel taller than the real page by
          exactly that padding. */}
      <div
        className="kantha-weave absolute right-full top-0 hidden w-full bg-khata-red-deep p-3 md:block"
        style={{ bottom: "6rem" }}
        aria-hidden="true"
      >
        <div className="relative flex h-full" style={{ perspective: "1400px" }}>
          <BookCover closing={closing} />
          <LeftLeaf />
        </div>
      </div>

      {/* The book crease — a ring-binding look (repeating rings), not a
          flat shadow line — straddling the seam between the flipped-page
          panel and the main section, always visible (a real binding shows
          whether or not there's anything on the page), so the two
          separately-positioned sections still read as one physical book.
          Only makes sense alongside the flipped-page spread above, so it's
          hidden below md for the same reason. */}
      <div
        className="pointer-events-none absolute left-0 top-3 z-30 hidden w-7 -translate-x-1/2 md:block"
        style={{
          // Matches the book's own visible extent exactly: main's p-3 inset
          // (0.75rem) on top of root's pb-24 (6rem) on the bottom — without
          // this, the ring column ran taller than the book and a ring
          // poked out above/below its actual top/bottom edge.
          bottom: "6.75rem",
          backgroundImage:
            "radial-gradient(circle at center, transparent 26%, rgba(70,68,66,0.95) 29%, rgba(150,146,142,0.95) 37%, rgba(70,68,66,0.95) 45%, transparent 48%)",
          backgroundSize: "100% 26px",
          backgroundRepeat: "repeat-y",
          backgroundPosition: "center 0px",
        }}
        aria-hidden="true"
      />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col p-3">
        <div className="relative flex min-h-0 flex-1" style={{ perspective: "1400px" }}>
          {/* The red cover peeking out behind the page is part of the same
              "open book" illusion as the two panels above — hidden below
              md so mobile shows just the content card, nothing simulating
              a physical book around it. Unaffected by BookPage's own
              layout since it's absolutely positioned within this wrapper. */}
          <div className="absolute inset-0 hidden md:block">
            <BookCover closing={closing} />
          </div>
          <BookPage closing={closing} onClosed={handleClosed}>
            <div className="mb-3 flex items-center justify-end gap-2">
              <LangToggle className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink/60 shadow-sm" />
              <button
                type="button"
                onClick={handleLogout}
                aria-label={t("layout.logout")}
                className="rounded-full bg-white/70 px-3 py-1 font-bangla text-xs text-ink/50 shadow-sm"
              >
                {t("layout.logout")}
              </button>
            </div>
            <Outlet />
          </BookPage>
        </div>
      </main>
      <BottomNav onMicClick={() => setRecordOpen(true)} />
      <RecordFlow
        open={recordOpen}
        initialTranscript={initialTranscript}
        onClose={() => {
          setRecordOpen(false);
          setInitialTranscript(null);
        }}
      />
    </div>
  );
}
