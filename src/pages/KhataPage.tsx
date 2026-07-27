import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { animate, stagger } from "animejs";
import { db, startOfToday, computeTotals } from "../lib/db";
import { LedgerRow } from "../components/LedgerRow";
import { EmptyState } from "../components/EmptyState";
import { AnimatedTaka } from "../components/AnimatedTaka";
import { EmojiIcon } from "../components/EmojiIcon";
import { numeralStyleForLang } from "../lib/numerals";
import { entriesToCsv, downloadCsv } from "../lib/csv";
import { speakDailySummary, speechSupported } from "../lib/speech";
import { useLang, useT } from "../lib/i18n";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function KhataPage() {
  const t = useT();
  const { lang } = useLang();
  const numeralStyle = numeralStyleForLang(lang);

  const todayEntries = useLiveQuery(
    () => db.entries.where("createdAt").aboveOrEqual(startOfToday()).reverse().sortBy("createdAt"),
    [],
  );
  const customers = useLiveQuery(() => db.customers.toArray(), []);

  const customersById = new Map((customers ?? []).map((c) => [c.id!, c]));
  const entries = todayEntries ?? [];
  const totals = computeTotals(entries);
  const totalOutstanding = Math.max(0, (customers ?? []).reduce((sum, c) => sum + c.balanceTaka, 0));

  // First load: stagger the whole list in at once. After that, only the row
  // for a genuinely new entry gets its own spring settle (PRD §5.4) — we
  // never re-stagger existing rows just because the live query re-fired.
  const listRef = useRef<HTMLUListElement>(null);
  const hasLoadedRef = useRef(false);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const [newEntryId, setNewEntryId] = useState<number | null>(null);

  useEffect(() => {
    if (todayEntries === undefined) return;
    const ids = new Set(todayEntries.map((e) => e.id!));

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      knownIdsRef.current = ids;
      if (listRef.current && !prefersReducedMotion()) {
        const rows = listRef.current.querySelectorAll("li");
        if (rows.length > 0) {
          animate(rows, {
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 320,
            delay: stagger(45),
            ease: "outQuad",
          });
        }
      }
      return;
    }

    const added = todayEntries.find((e) => e.id != null && !knownIdsRef.current.has(e.id));
    knownIdsRef.current = ids;
    if (added) setNewEntryId(added.id!);
  }, [todayEntries]);

  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = () => {
    setSpeaking(true);
    speakDailySummary(totals.cashTaka, totals.creditTaka, totals.repaidTaka);
    // SpeechSynthesisUtterance's onend isn't wired here to keep this simple;
    // a short fixed pulse is enough feedback that the tap registered.
    window.setTimeout(() => setSpeaking(false), 1200);
  };

  const handleExport = async () => {
    const all = await db.entries.orderBy("createdAt").toArray();
    const allCustomers = await db.customers.toArray();
    const csv = entriesToCsv(
      all,
      new Map(allCustomers.map((c) => [c.id!, c])),
    );
    downloadCsv(`lal-khata-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="font-bangla text-2xl font-bold text-ink">{t("khata.header")}</h1>
        <div className="flex items-center gap-2">
          {speechSupported() && (
            <button
              type="button"
              onClick={handleSpeak}
              aria-label={t("khata.speakSummaryAria")}
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 transition-transform ${speaking ? "scale-110 bg-khata-red/10" : ""}`}
            >
              <EmojiIcon src="sound2.png" size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <TotalCard label={t("khata.cashToday")} value={totals.cashTaka} numeralStyle={numeralStyle} tone="green" />
        <TotalCard
          label={t("khata.creditToday")}
          value={totals.creditTaka}
          numeralStyle={numeralStyle}
          tone="amber"
        />
        <TotalCard label={t("khata.totalOutstanding")} value={totalOutstanding} numeralStyle={numeralStyle} tone="red" />
      </div>

      {entries.length === 0 ? (
        <EmptyState message={t("khata.empty")} showArrow />
      ) : (
        <ul ref={listRef} className="ruled-paper rounded-2xl bg-white shadow-sm">
          {entries.map((entry) => (
            <LedgerRow
              key={entry.id}
              entry={entry}
              customerName={entry.customerId ? (customersById.get(entry.customerId)?.name ?? null) : null}
              numeralStyle={numeralStyle}
              isNew={entry.id === newEntryId}
            />
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <button
          type="button"
          onClick={handleExport}
          className="self-center font-bangla text-sm text-rule-blue underline"
        >
          {t("khata.downloadCsv")}
        </button>
      )}
    </div>
  );
}

function TotalCard({
  label,
  value,
  numeralStyle,
  tone,
}: {
  label: string;
  value: number;
  numeralStyle: "bn" | "en";
  tone: "green" | "amber" | "red";
}) {
  const toneClass = { green: "text-joma-green", amber: "text-baki-amber", red: "text-khata-red" }[tone];
  return (
    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
      <p className="font-bangla text-xs text-ink/50">{label}</p>
      <AnimatedTaka value={value} numeralStyle={numeralStyle} className={`tabular-amount block text-lg font-bold ${toneClass}`} />
    </div>
  );
}
