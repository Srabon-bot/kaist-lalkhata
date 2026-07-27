import { useLang, type Lang } from "../lib/i18n";

// Label shown on the pill is the language a tap will switch *to* — cycles
// bn -> en -> ko -> bn.
const NEXT_LABEL: Record<Lang, string> = { bn: "EN", en: "한국어", ko: "বাং" };

/** A small persistent pill that cycles all UI chrome copy between Bangla,
 * English, and Korean — voice input stays tied to the current UI language
 * (see useSpeechRecognition), but this lets someone who can't read Bangla
 * still follow every screen. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch language / ভাষা পরিবর্তন করুন / 언어 변경"
      className={
        className ??
        "rounded-full border border-ink/15 bg-white/80 px-3 py-1 text-xs font-semibold text-ink/70 shadow-sm"
      }
    >
      {NEXT_LABEL[lang]}
    </button>
  );
}
