import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db";
import { EmptyState } from "../components/EmptyState";
import { formatTaka, numeralStyleForLang } from "../lib/numerals";
import { useLang, useT } from "../lib/i18n";

export function CustomersPage() {
  const t = useT();
  const { lang } = useLang();
  const numeralStyle = numeralStyleForLang(lang);
  const customers = useLiveQuery(() => db.customers.orderBy("balanceTaka").reverse().toArray(), []);

  if (customers === undefined) return null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-bangla text-2xl font-bold text-ink">{t("customers.header")}</h1>

      {customers.length === 0 ? (
        <EmptyState message={t("customers.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                to={`/customers/${c.id}`}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm"
              >
                <span className="font-bangla text-base font-medium text-ink">{c.name}</span>
                <span
                  className={`tabular-amount font-bold transition-colors duration-300 ${
                    c.balanceTaka > 0 ? "text-baki-amber" : "text-joma-green"
                  }`}
                >
                  {c.balanceTaka > 0 ? formatTaka(c.balanceTaka, numeralStyle) : t("customers.paidOff")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
