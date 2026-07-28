import { useState, type ReactNode } from "react";
import type { ExtractionResult, ExtractionType, ItemTranslations } from "../lib/schema";
import { CONFIDENCE_FLAG_THRESHOLD } from "../config";
import { useT, type DictKey } from "../lib/i18n";

export interface EditedEntry {
  type: Exclude<ExtractionType, "unclear">;
  customer: string | null;
  item: string | null;
  itemTranslations: ItemTranslations | null;
  amountTaka: number;
  edited: boolean;
}

interface ConfirmationCardProps {
  result: ExtractionResult;
  onConfirm: (entry: EditedEntry) => void;
  onReRecord: () => void;
}

const TYPE_OPTIONS: { value: Exclude<ExtractionType, "unclear">; labelKey: DictKey }[] = [
  { value: "credit_sale", labelKey: "type.creditSale" },
  { value: "cash_sale", labelKey: "type.cashSale" },
  { value: "repayment", labelKey: "type.repayment" },
];

export function ConfirmationCard({ result, onConfirm, onReRecord }: ConfirmationCardProps) {
  const t = useT();
  const initialType: Exclude<ExtractionType, "unclear"> = result.type === "unclear" ? "credit_sale" : result.type;

  const [type, setType] = useState(initialType);
  const [customer, setCustomer] = useState(result.customer ?? "");
  const [item, setItem] = useState(result.item ?? "");
  const [amount, setAmount] = useState(result.amount_taka != null ? String(result.amount_taka) : "");

  if (result.type === "unclear") {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border border-khata-red/30 bg-white p-6 text-center shadow-md"
        role="alert"
        aria-live="assertive"
      >
        <p className="font-bangla text-lg font-semibold text-khata-red">{t("confirm.unclearTitle")}</p>
        {result.transcript && (
          <p className="text-sm text-ink/60">
            {t("common.heard")}: "{result.transcript}"
          </p>
        )}
        <button
          type="button"
          onClick={onReRecord}
          className="rounded-full bg-khata-red px-6 py-3 font-bangla font-semibold text-white"
        >
          {t("confirm.sayAgain")}
        </button>
      </div>
    );
  }

  const flagCustomer = result.confidence.customer < CONFIDENCE_FLAG_THRESHOLD;
  const flagItem = result.confidence.item < CONFIDENCE_FLAG_THRESHOLD;
  const flagAmount = result.confidence.amount < CONFIDENCE_FLAG_THRESHOLD;

  const amountValue = Number(amount);
  const isAmountValid = amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0;
  const showItemField = type !== "repayment";

  const itemUnchanged = item === (result.item ?? "");
  const edited =
    type !== initialType ||
    customer !== (result.customer ?? "") ||
    !itemUnchanged ||
    amount !== (result.amount_taka != null ? String(result.amount_taka) : "");

  const handleConfirm = () => {
    if (!isAmountValid) return;
    onConfirm({
      type,
      customer: customer.trim() ? customer.trim() : null,
      item: showItemField && item.trim() ? item.trim() : null,
      // Only trust Gemma's translations when the item text is exactly what
      // it produced — a hand-typed edit has no known translation, so it just
      // displays as-is in every language rather than showing a stale one.
      itemTranslations: showItemField && itemUnchanged ? (result.item_translations ?? null) : null,
      amountTaka: amountValue,
      edited,
    });
  };

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-md"
      aria-live="polite"
    >
      <div className="flex gap-2" role="radiogroup" aria-label={t("confirm.type")}>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={type === opt.value}
            onClick={() => setType(opt.value)}
            className={`flex-1 rounded-full px-3 py-2 font-bangla text-sm font-semibold transition-colors ${
              type === opt.value ? "bg-khata-red text-white" : "bg-page-cream text-ink/70"
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      <Field label={t("confirm.customer")} flagged={flagCustomer} htmlFor="cc-customer" unsureLabel={t("confirm.unsure")}>
        <input
          id="cc-customer"
          type="text"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder={t("confirm.customerPlaceholder")}
          className="w-full rounded-lg border border-ink/15 bg-page-cream px-3 py-2 font-bangla text-lg text-ink"
        />
      </Field>

      {showItemField && (
        <Field label={t("confirm.item")} flagged={flagItem} htmlFor="cc-item" unsureLabel={t("confirm.unsure")}>
          <input
            id="cc-item"
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder={t("confirm.itemPlaceholder")}
            className="w-full rounded-lg border border-ink/15 bg-page-cream px-3 py-2 font-bangla text-lg text-ink"
          />
        </Field>
      )}

      <Field label={t("confirm.amount")} flagged={flagAmount} htmlFor="cc-amount" unsureLabel={t("confirm.unsure")}>
        <div className="flex items-center gap-1">
          <span className="text-2xl font-bold text-ink">৳</span>
          <input
            id="cc-amount"
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tabular-amount w-full rounded-lg border border-ink/15 bg-page-cream px-3 py-2 text-2xl font-bold text-ink"
          />
        </div>
      </Field>

      {result.transcript && (
        <p className="text-xs text-ink/50">
          {t("common.heard")}: "{result.transcript}"
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onReRecord}
          className="flex-1 rounded-full border-2 border-ink/15 px-4 py-3 font-bangla font-semibold text-ink/70"
        >
          {t("confirm.editRedo")}
        </button>
        <button
          type="button"
          disabled={!isAmountValid}
          onClick={handleConfirm}
          className="flex-[2] rounded-full bg-joma-green px-4 py-3 font-bangla font-semibold text-white disabled:opacity-40"
        >
          {t("confirm.save")}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  flagged,
  htmlFor,
  unsureLabel,
  children,
}: {
  label: string;
  flagged: boolean;
  htmlFor: string;
  unsureLabel: string;
  children: ReactNode;
}) {
  return (
    <div className={flagged ? "rounded-xl bg-baki-amber/10 p-2" : undefined}>
      <label htmlFor={htmlFor} className="mb-1 flex items-center gap-1 font-bangla text-sm text-ink/60">
        {label}
        {flagged && (
          <span className="text-baki-amber" title={unsureLabel} aria-label={unsureLabel}>
            ⚠
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
