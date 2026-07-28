import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, displayItem, rollbackEntry, startOfThisYear, isLive, type LedgerEntry } from "../lib/db";
import { formatTaka, numeralStyleForLang } from "../lib/numerals";
import { EmptyState } from "../components/EmptyState";
import { useLang, useT, type DictKey } from "../lib/i18n";

const TYPE_META: Record<LedgerEntry["type"], { labelKey: DictKey; sign: "+" | "-" | ""; colorClass: string }> = {
  cash_sale: { labelKey: "type.cashSale", sign: "+", colorClass: "text-joma-green" },
  credit_sale: { labelKey: "type.creditSale", sign: "", colorClass: "text-baki-amber" },
  repayment: { labelKey: "type.repayment", sign: "+", colorClass: "text-joma-green" },
};

/**
 * The full year's ledger, past the "today" view on the Khata page — kept so
 * a shopkeeper can look back at (and, if a transaction was recorded wrong or
 * settled by mistake, roll back) anything from this year, not just today.
 * Rolling back a repayment/credit sale reverses its effect on the customer's
 * baki balance via rollbackEntry, it isn't just a display-only delete.
 */
export function HistoryPage() {
  const t = useT();
  const { lang } = useLang();
  const numeralStyle = numeralStyleForLang(lang);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [rollingBackId, setRollingBackId] = useState<number | null>(null);

  const entries = useLiveQuery(
    () => db.entries.where("createdAt").aboveOrEqual(startOfThisYear()).filter(isLive).reverse().sortBy("createdAt"),
    [],
  );
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const customersById = new Map((customers ?? []).map((c) => [c.id!, c]));

  const dateLocale = lang === "bn" ? "bn-BD" : lang === "ko" ? "ko-KR" : "en-US";

  const handleRollback = async (id: number) => {
    setRollingBackId(id);
    try {
      await rollbackEntry(id);
    } finally {
      setRollingBackId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-bangla text-2xl font-bold text-ink">{t("history.header")}</h1>

      {!entries || entries.length === 0 ? (
        <EmptyState message={t("history.empty")} />
      ) : (
        <ul className="ruled-paper rounded-2xl bg-white shadow-sm">
          {entries.map((entry) => {
            const meta = TYPE_META[entry.type];
            const item = displayItem(entry, lang);
            const customerName = entry.customerId ? (customersById.get(entry.customerId)?.name ?? null) : null;
            const dateTime = new Date(entry.createdAt).toLocaleString(dateLocale, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const isConfirming = confirmingId === entry.id;

            return (
              <li key={entry.id} className="border-b border-rule-blue/10 px-3 py-3 last:border-none">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-bangla text-base font-medium text-ink">
                      {customerName ?? (entry.type === "cash_sale" ? t("common.cash") : "—")}
                      {item && <span className="text-ink/50"> · {item}</span>}
                    </p>
                    <p className="font-bangla text-xs text-ink/50">
                      {t(meta.labelKey)} · {dateTime}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-3">
                    <p className={`tabular-amount text-lg font-bold ${meta.colorClass}`}>
                      {meta.sign}
                      {formatTaka(entry.amountTaka, numeralStyle)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(entry.id!)}
                      className="rounded-full border border-ink/15 px-2 py-1 font-bangla text-[11px] text-ink/50"
                    >
                      {t("history.rollback")}
                    </button>
                  </div>
                </div>

                {isConfirming && (
                  <div className="mt-3 rounded-xl bg-khata-red/5 p-3">
                    <p className="font-bangla text-sm font-semibold text-khata-red">{t("history.rollbackConfirmTitle")}</p>
                    <p className="mt-1 font-bangla text-xs text-ink/60">{t("history.rollbackConfirmBody")}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={rollingBackId === entry.id}
                        onClick={() => handleRollback(entry.id!)}
                        className="rounded-full bg-khata-red px-3 py-1.5 font-bangla text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {t("history.rollbackYes")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="rounded-full border border-ink/15 px-3 py-1.5 font-bangla text-xs text-ink/60"
                      >
                        {t("common.close")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
