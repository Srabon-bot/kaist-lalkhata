import { evaluatePassword, type PasswordStrengthLabel } from "../lib/passwordStrength";
import { useT, type DictKey } from "../lib/i18n";

const BAR_COLOR: Record<PasswordStrengthLabel, string> = {
  weak: "bg-khata-red",
  fair: "bg-baki-amber",
  good: "bg-baki-amber",
  strong: "bg-joma-green",
};

const LABEL_KEY: Record<PasswordStrengthLabel, DictKey> = {
  weak: "auth.strengthWeak",
  fair: "auth.strengthFair",
  good: "auth.strengthGood",
  strong: "auth.strengthStrong",
};

const REQUIREMENTS: { key: "minLength" | "hasUpper" | "hasLower" | "hasNumber" | "hasSymbol"; labelKey: DictKey }[] = [
  { key: "minLength", labelKey: "auth.passwordReqLength" },
  { key: "hasUpper", labelKey: "auth.passwordReqUpper" },
  { key: "hasLower", labelKey: "auth.passwordReqLower" },
  { key: "hasNumber", labelKey: "auth.passwordReqNumber" },
  { key: "hasSymbol", labelKey: "auth.passwordReqSymbol" },
];

/** Live strength bar + checklist shown under the password field on signup —
 * guides toward a strong password instead of just rejecting a weak one at
 * submit time. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useT();
  const strength = evaluatePassword(password);

  if (!password) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" role="progressbar" aria-valuenow={strength.score} aria-valuemin={0} aria-valuemax={4}>
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < strength.score ? BAR_COLOR[strength.label] : "bg-ink/10"
              }`}
            />
          ))}
        </div>
        <span className="font-bangla text-[11px] font-semibold text-ink/60">{t(LABEL_KEY[strength.label])}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {REQUIREMENTS.map((req) => {
          const met = strength.requirements[req.key];
          return (
            <li
              key={req.key}
              className={`flex items-center gap-1 font-bangla text-[11px] ${met ? "text-joma-green" : "text-ink/40"}`}
            >
              <span aria-hidden="true">{met ? "✓" : "○"}</span>
              {t(req.labelKey)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
