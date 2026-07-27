import { NavLink } from "react-router-dom";
import { useT, type DictKey } from "../lib/i18n";

interface BottomNavProps {
  onMicClick: () => void;
}

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.khata", icon: "📖", end: true },
  { to: "/customers", labelKey: "nav.customers", icon: "👥", end: false },
  { to: "/summary", labelKey: "nav.summary", icon: "📊", end: false },
] as const satisfies { to: string; labelKey: DictKey; icon: string; end: boolean }[];

export function BottomNav({ onMicClick }: BottomNavProps) {
  const t = useT();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white"
      aria-label={t("nav.mainMenu")}
    >
      <div className="relative mx-auto flex max-w-md items-center justify-around px-4 py-2">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <div className="w-16" aria-hidden="true" />

        {NAV_ITEMS.slice(2).map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <button
          type="button"
          onClick={onMicClick}
          aria-label={t("nav.mic")}
          className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-khata-red text-2xl text-white shadow-lg ring-4 ring-page-cream active:scale-95"
        >
          🎙️
        </button>
      </div>
    </nav>
  );
}

function NavItem({ to, labelKey, icon, end }: { to: string; labelKey: DictKey; icon: string; end: boolean }) {
  const t = useT();
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex min-w-[64px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 font-bangla text-xs ${
          isActive ? "text-khata-red" : "text-ink/50"
        }`
      }
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      {t(labelKey)}
    </NavLink>
  );
}
