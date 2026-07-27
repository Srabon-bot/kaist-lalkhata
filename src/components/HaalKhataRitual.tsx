import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { animate, stagger } from "animejs";
import { db, repayBaki, type Customer } from "../lib/db";
import { formatTaka, numeralStyleForLang } from "../lib/numerals";
import { generateDuesReceiptBlob, shareOrDownloadCard } from "../lib/shareCard";
import { SHOP_NAME_KEY } from "../pages/WelcomePage";
import { EmojiIcon } from "./EmojiIcon";
import { useLang, useT } from "../lib/i18n";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// "🍬" has no custom-illustrated replacement asset, so it stays a plain
// emoji glyph while its siblings use the provided icon set.
const SWEETS = [
  "🍬",
  <EmojiIcon key="cake" src="cake.png" size={24} />,
  <EmojiIcon key="honey" src="honey.png" size={24} />,
  <EmojiIcon key="lamp" src="lamp.png" size={24} />,
  <EmojiIcon key="sparkle" src="sparkle.png" size={24} />,
];

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
  const { lang } = useLang();
  const numeralStyle = numeralStyleForLang(lang);
  const customers = useLiveQuery(() => db.customers.where("balanceTaka").above(0).reverse().sortBy("balanceTaka"), []);
  const [settledIds, setSettledIds] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const outstanding = customers ?? [];
  const remaining = outstanding.filter((c) => !settledIds.has(c.id!));

  const handleDownloadReceipt = async () => {
    setDownloadingReceipt(true);
    try {
      let shopName = lang === "bn" ? "আমার দোকান" : lang === "ko" ? "내 가게" : "My Shop";
      try {
        shopName = localStorage.getItem(SHOP_NAME_KEY) || shopName;
      } catch {
        /* ignore */
      }
      const dateLocale = lang === "bn" ? "bn-BD" : lang === "ko" ? "ko-KR" : "en-US";
      const dateLabel = new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" });
      const blob = await generateDuesReceiptBlob({
        shopName,
        dateLabel,
        lang,
        customers: remaining.map((c: Customer) => ({ name: c.name, balanceTaka: c.balanceTaka })),
      });
      await shareOrDownloadCard(blob, `dues-receipt-${new Date().toISOString().slice(0, 10)}.png`);
    } finally {
      setDownloadingReceipt(false);
    }
  };

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
            <p className="flex items-center justify-center gap-1.5" aria-hidden="true">
              <EmojiIcon src="lamp.png" size={36} />
              <span className="text-4xl">🍬</span>
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
                          {formatTaka(c.balanceTaka, numeralStyle)}
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

            {remaining.length > 0 && (
              <button
                type="button"
                disabled={downloadingReceipt}
                onClick={handleDownloadReceipt}
                className="mt-3 shrink-0 rounded-full border-2 border-khata-red px-6 py-2.5 font-bangla text-sm font-semibold text-khata-red disabled:opacity-50"
              >
                <EmojiIcon src="due-receipt.png" size={14} className="mr-1.5" />
                {t("ritual.downloadReceipt")}
              </button>
            )}

            <button
              type="button"
              onClick={() => setCelebrating(true)}
              className="mt-3 shrink-0 rounded-full bg-khata-red px-6 py-3 font-bangla font-semibold text-white"
            >
              {t("ritual.finish")}
            </button>
          </div>
        ) : (
          <Celebration
            onClose={onClose}
            remainingCount={remaining.length}
            onDownloadReceipt={handleDownloadReceipt}
            downloadingReceipt={downloadingReceipt}
          />
        )}
      </div>
    </div>
  );
}

function Celebration({
  onClose,
  remainingCount,
  onDownloadReceipt,
  downloadingReceipt,
}: {
  onClose: () => void;
  remainingCount: number;
  onDownloadReceipt: () => void;
  downloadingReceipt: boolean;
}) {
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
      <p aria-hidden="true">
        <EmojiIcon src="confetti.png" size={48} />
      </p>
      <h2 className="mt-3 font-bangla text-2xl font-bold text-khata-red">{t("ritual.celebrationTitle")}</h2>
      <p className="mt-2 font-bangla text-sm text-ink/70">{t("ritual.celebrationBody")}</p>
      {remainingCount > 0 && (
        <>
          <p className="mt-3 font-bangla text-xs text-ink/50">{t("ritual.remainingNote")}</p>
          <button
            type="button"
            disabled={downloadingReceipt}
            onClick={onDownloadReceipt}
            className="mt-3 rounded-full border-2 border-khata-red px-5 py-2 font-bangla text-sm font-semibold text-khata-red disabled:opacity-50"
          >
            <EmojiIcon src="due-receipt.png" size={14} className="mr-1.5" />
            {t("ritual.downloadReceipt")}
          </button>
        </>
      )}
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
