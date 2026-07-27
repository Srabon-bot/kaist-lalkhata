import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { useT } from "../lib/i18n";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface UsernameModalProps {
  initialValue?: string;
  onSubmit: (name: string) => void;
}

/** The step after a signup or a first-time Google sign-in actually
 * authenticates: picking the display name that shows as the shop's name
 * throughout the ledger. No close/skip — every account needs one before it
 * can be used, same as any real signup flow. */
export function UsernameModal({ initialValue, onSubmit }: UsernameModalProps) {
  const t = useT();
  const [name, setName] = useState(initialValue ?? "");
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
    animate(card, { opacity: [0, 1], scale: [0.95, 1], duration: 260, ease: "outQuad" });
  }, []);

  const isValid = name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t("username.title")}>
      <div ref={backdropRef} className="absolute inset-0 bg-ink/50 opacity-0" aria-hidden="true" />
      <div ref={cardRef} className="relative w-full max-w-sm rounded-3xl bg-page-cream p-6 opacity-0 shadow-2xl">
        <h2 className="font-bangla text-xl font-bold text-ink">{t("username.title")}</h2>
        <p className="mt-1 font-bangla text-sm text-ink/60">{t("username.subtitle")}</p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bangla text-xs text-ink/60">{t("username.label")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 font-bangla text-base text-ink"
              placeholder={t("username.placeholder")}
            />
          </label>
          <button
            type="submit"
            disabled={!isValid}
            className="mt-2 rounded-full bg-khata-red px-4 py-3 font-bangla font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {t("username.cta")}
          </button>
        </form>
      </div>
    </div>
  );
}
