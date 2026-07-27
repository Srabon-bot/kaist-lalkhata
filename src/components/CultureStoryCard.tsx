import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { useT } from "../lib/i18n";
import { LangToggle } from "./LangToggle";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The cultural context behind the app's name, color, and format — the
 * 430-year-old Haal Khata tradition of Bengali shopkeepers. Meant for anyone
 * (like a friend abroad who doesn't read Bangla) trying to understand *why*
 * the app looks and works the way it does, not just what it does. */
export function CultureStoryCard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const bodyKeys = ["story.body1", "story.body2", "story.body3"] as const;
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) return;

    if (prefersReducedMotion()) {
      backdrop.style.opacity = "1";
      card.style.opacity = "1";
      card.style.transform = "none";
      return;
    }
    animate(backdrop, { opacity: [0, 1], duration: 180, ease: "outQuad" });
    animate(card, { opacity: [0, 1], translateY: [16, 0], duration: 260, ease: "outQuad" });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t("story.title")}>
      <div ref={backdropRef} className="absolute inset-0 bg-ink/50 opacity-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={cardRef}
        className="relative flex max-h-[85vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-3xl border-4 border-khata-red-deep bg-page-cream p-6 opacity-0 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-bangla text-xl font-bold text-khata-red">{t("story.title")}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <LangToggle />
            <button type="button" onClick={onClose} aria-label={t("common.close")} className="text-xl text-ink/50">
              ✕
            </button>
          </div>
        </div>

        {bodyKeys.map((key) => (
          <p key={key} className="font-bangla text-sm leading-relaxed text-ink/85">
            {t(key)}
          </p>
        ))}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 self-center rounded-full bg-khata-red px-6 py-2.5 font-bangla font-semibold text-white"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
