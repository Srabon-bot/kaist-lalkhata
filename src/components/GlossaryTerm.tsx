import { useState, type ReactNode } from "react";
import { useLang, dict, type DictKey } from "../lib/i18n";

type GlossaryKey = Extract<DictKey, `glossary.${string}`>;

/** Wraps a culture-specific word (baki, khata, mudi dokan, taka) in a tap-to-reveal
 * definition, so a reader unfamiliar with the term isn't lost mid-sentence. */
export function GlossaryTerm({ term, children }: { term: GlossaryKey; children: ReactNode }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="underline decoration-dotted decoration-ink/40 underline-offset-2"
      >
        {children}
        <sup className="ml-0.5 text-[9px] text-rule-blue">?</sup>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-1.5 w-52 -translate-x-1/2 rounded-lg bg-ink p-2.5 text-left text-[11px] leading-snug text-page-cream shadow-lg"
        >
          {dict[term][lang]}
        </span>
      )}
    </span>
  );
}
