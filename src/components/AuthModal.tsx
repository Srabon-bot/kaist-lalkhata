import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { ApiError, signup, login, loginWithGoogle, type AuthResult, type ApiErrorCode } from "../lib/api";
import { evaluatePassword } from "../lib/passwordStrength";
import { signInWithGoogle, googleClientId } from "../lib/googleAuth";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { useT, type DictKey } from "../lib/i18n";

export type AuthMode = "signup" | "login";

interface AuthModalProps {
  mode: AuthMode;
  onClose: () => void;
  /** isNew + suggestedName tell the caller whether this account still
   * needs the "pick a username" step. */
  onAuthenticated: (result: AuthResult) => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const COPY: Record<AuthMode, { titleKey: DictKey; ctaKey: DictKey }> = {
  signup: { titleKey: "auth.signupTitle", ctaKey: "auth.signupCta" },
  login: { titleKey: "auth.loginTitle", ctaKey: "auth.loginCta" },
};

const API_ERROR_KEY: Partial<Record<ApiErrorCode, DictKey>> = {
  EMAIL_TAKEN: "auth.errorEmailTaken",
  NOT_FOUND: "auth.errorNotFound",
  WRONG_PASSWORD: "auth.errorWrongPassword",
  WRONG_PROVIDER: "auth.errorWrongProvider",
  GOOGLE_TOKEN_INVALID: "auth.errorGeneric",
};

/**
 * A real sign up / log in flow, backed by a server account (api/auth/*.ts +
 * Neon Postgres) so the same login works from any device.
 * Passwords are hashed server-side (PBKDF2 + per-account salt, see
 * passwordHash.ts, reused on both sides) — this component only ever sends
 * the raw password over HTTPS, same as any real site's login form; it's
 * never stored or hashed client-side.
 */
export function AuthModal({ mode: initialMode, onClose, onAuthenticated }: AuthModalProps) {
  const t = useT();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const copy = COPY[mode];
  const strength = evaluatePassword(password);

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

  const emailValid = /^\S+@\S+\.\S+$/.test(email);
  const isValid =
    emailValid && (mode === "login" ? password.length > 0 : strength.isAcceptable && password === confirmPassword);

  const switchMode = () => {
    setMode((m) => (m === "signup" ? "login" : "signup"));
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError(t("auth.errorPasswordMismatch"));
      return;
    }
    if (mode === "signup" && !strength.isAcceptable) {
      setError(t("auth.errorWeakPassword"));
      return;
    }

    setSubmitting(true);
    try {
      const result = mode === "signup" ? await signup(email, password) : await login(email, password);
      onAuthenticated(result);
    } catch (err) {
      setError(err instanceof ApiError ? t(API_ERROR_KEY[err.code] ?? "auth.errorGeneric") : t("auth.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      const accessToken = await signInWithGoogle();
      const result = await loginWithGoogle(accessToken);
      onAuthenticated(result);
    } catch (err) {
      setError(
        err instanceof Error && err.message === "GOOGLE_NOT_CONFIGURED"
          ? t("auth.googleUnavailable")
          : err instanceof ApiError
            ? t(API_ERROR_KEY[err.code] ?? "auth.errorGeneric")
            : t("auth.errorGeneric"),
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t(copy.titleKey)}>
      <div ref={backdropRef} className="absolute inset-0 bg-ink/50 opacity-0" onClick={onClose} aria-hidden="true" />
      <div ref={cardRef} className="relative w-full max-w-sm rounded-3xl bg-page-cream p-6 opacity-0 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bangla text-xl font-bold text-ink">{t(copy.titleKey)}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="text-xl text-ink/50">
            ✕
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleBusy || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 font-bangla text-sm font-semibold text-ink shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          <GoogleGlyph />
          {t("auth.continueWithGoogle")}
        </button>
        {!googleClientId() && (
          <p className="mt-1.5 text-center font-bangla text-[11px] text-ink/40">{t("auth.googleUnavailable")}</p>
        )}

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-ink/10" />
          <span className="font-bangla text-[11px] text-ink/40">{t("auth.orContinueWith")}</span>
          <div className="h-px flex-1 bg-ink/10" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-bangla text-xs text-ink/60">{t("auth.email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-base text-ink"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-bangla text-xs text-ink/60">{t("auth.password")}</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
                className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2 pr-16 text-base text-ink"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
                className="absolute right-2 top-1/2 -translate-y-1/2 font-bangla text-[11px] font-semibold text-rule-blue"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {mode === "signup" && <PasswordStrengthMeter password={password} />}

          {mode === "signup" && (
            <label className="flex flex-col gap-1">
              <span className="font-bangla text-xs text-ink/60">{t("auth.confirmPassword")}</span>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-base text-ink"
                placeholder="••••••••"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="font-bangla text-xs font-semibold text-khata-red">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="mt-2 rounded-full bg-khata-red px-4 py-3 font-bangla font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
          >
            {t(copy.ctaKey)}
          </button>

          <button type="button" onClick={switchMode} className="font-bangla text-xs text-rule-blue underline">
            {t(mode === "signup" ? "auth.switchToLogin" : "auth.switchToSignup")}
          </button>

          <p className="text-center font-bangla text-[11px] text-ink/50">{t("auth.privacyNote")}</p>
        </form>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path fill="#FBBC05" d="M11.69 28.18A11.98 11.98 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88z" />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
