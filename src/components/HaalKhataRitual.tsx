import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { animate, stagger } from "animejs";
import { db, repayBaki } from "../lib/db";
import { formatTaka } from "../lib/numerals";
import { useSettings } from "../hooks/useSettings";
import { useT } from "../lib/i18n";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const SWEETS = ["🍬", "🧁", "🍯", "🪔", "✨"];

/**
 * The Haal Khata ritual, turned into an actual flow instead of just a story
 * on the welcome page — the real Pohela Boishakh custom this whole app is
 * named after: shopkeepers invite customers to settle their baki, then
 * start the new year fresh. "Settling" here calls the same repayBaki used
 * everywhere else in the app (a real recorded repayment, not a silent
 * data wipe) — nothing about a customer's history is deleted, this is just
 * that ritual's moment of "who's paid up" made explicit.
 */
export function HaalKhataRitual({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const customers = useLiveQuery(() => db.customers.where("balanceTaka").above(0).reverse().sortBy("balanceTaka"), []);
  const [settledIds, setSettledIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const outstanding = customers ?? [];
  const remainingCount = outstanding.filter((c) => !settledIds.has(c.id!)).length;

  const handleSettle = async (id: number, amount: number) => {
    setBusyId(id);
    try {
      await repayBaki(id, amount);
      setSettledIds((prev) => new Set(prev).add(id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t("ritual.title")}>
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-page-cream shadow-2xl">
        {!celebrating ? (
          <div className="flex flex-1 flex-col overflow-hidden p-6">
            <p className="text-center text-4xl" aria-hidden="true">
              🪔🍬
            </p>
            <h2 className="mt-2 text-center font-bangla text-xl font-bold text-khata-red">{t("ritual.title")}</h2>
            <p className="mt-2 text-center font-bangla text-sm leading-relaxed text-ink/70">{t("ritual.intro")}</p>

            <div className="mt-5 flex-1 space-y-2 overflow-y-auto">
              {outstanding.length === 0 ? (
                <p className="py-8 text-center font-bangla text-sm text-ink/60">{t("ritual.noOutstanding")}</p>
              ) : (
                outstanding.map((c) => {
                  const isSettled = settledIds.has(c.id!);
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 transition-colors ${
                        isSettled ? "bg-joma-green/10" : "bg-white shadow-sm"
                      }`}
                    >
                      <div>
                        <p className="font-bangla text-sm font-semibold text-ink">{c.name}</p>
                        <p className="tabular-amount text-xs font-semibold text-baki-amber">
                          {formatTaka(c.balanceTaka, settings.numeralStyle)}
                        </p>
                      </div>
                      {isSettled ? (
                        <span className="font-bangla text-xs font-semibold text-joma-green">{t("ritual.settledBadge")}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleSettle(c.id!, c.balanceTaka)}
                          className="shrink-0 rounded-full bg-joma-green px-3 py-1.5 font-bangla text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {t("ritual.markSettled")}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setCelebrating(true)}
              className="mt-5 shrink-0 rounded-full bg-khata-red px-6 py-3 font-bangla font-semibold text-white"
            >
              {t("ritual.finish")}
            </button>
          </div>
        ) : (
          <Celebration onClose={onClose} remainingCount={remainingCount} />
        )}
      </div>
    </div>
  );
}

function Celebration({ onClose, remainingCount }: { onClose: () => void; remainingCount: number }) {
  const t = useT();
  const sweetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !sweetsRef.current) return;
    const pieces = Array.from(sweetsRef.current.children);
    animate(pieces, {
      translateY: [-20, 220],
      rotate: () => `${Math.random() > 0.5 ? "" : "-"}${180 + Math.random() * 180}deg`,
      opacity: [1, 0],
      duration: 1400,
      delay: stagger(80),
      ease: "inQuad",
    });
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-8 text-center">
      <div ref={sweetsRef} className="pointer-events-none absolute inset-x-0 top-0 flex justify-around" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className="text-2xl">
            {SWEETS[i % SWEETS.length]}
          </span>
        ))}
      </div>
      <p className="text-5xl" aria-hidden="true">
        🎉
      </p>
      <h2 className="mt-3 font-bangla text-2xl font-bold text-khata-red">{t("ritual.celebrationTitle")}</h2>
      <p className="mt-2 font-bangla text-sm text-ink/70">{t("ritual.celebrationBody")}</p>
      {remainingCount > 0 && <p className="mt-3 font-bangla text-xs text-ink/50">{t("ritual.remainingNote")}</p>}
      <button
        type="button"
        onClick={onClose}
        className="mt-6 rounded-full bg-khata-red px-6 py-3 font-bangla font-semibold text-white"
      >
        {t("common.close")}
      </button>
    </div>
  );
}
