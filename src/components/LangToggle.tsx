import { useLang } from "../lib/i18n";

/** A small persistent pill that flips all UI chrome copy between Bangla and
 * English — voice input stays Bangla-only (that's the actual feature), but
 * this lets someone who can't read Bangla still follow every screen. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch language / ভাষা পরিবর্তন করুন"
      className={
        className ??
        "rounded-full border border-ink/15 bg-white/80 px-3 py-1 text-xs font-semibold text-ink/70 shadow-sm"
      }
    >
      {lang === "bn" ? "EN" : "বাং"}
    </button>
  );
}
