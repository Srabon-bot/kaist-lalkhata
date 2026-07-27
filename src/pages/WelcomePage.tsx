import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { createTimeline, stagger } from "animejs";
import { AuthModal, type AuthMode } from "../components/AuthModal";
import { UsernameModal } from "../components/UsernameModal";
import { KhataBackdrop } from "../components/KhataBackdrop";
import { CultureStoryCard } from "../components/CultureStoryCard";
import { GlossaryTerm } from "../components/GlossaryTerm";
import { LangToggle } from "../components/LangToggle";
import { EmojiIcon } from "../components/EmojiIcon";
import { setUsername, type AuthResult } from "../lib/api";
import { useLang, useT, type DictKey } from "../lib/i18n";

export const ENTERED_KEY = "lal-khata-entered";
export const SHOP_NAME_KEY = "lal-khata-shop-name";
export const ACCOUNT_ID_KEY = "lal-khata-account-id";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// "🧾" has no custom-illustrated replacement asset, so it stays a plain emoji
// glyph while its siblings use the provided icon set.
const FEATURES: { icon: ReactNode; titleKey: DictKey; bodyKey: DictKey }[] = [
  { icon: <EmojiIcon src="mic.png" size={24} />, titleKey: "welcome.feature1.title", bodyKey: "welcome.feature1.body" },
  { icon: "🧾", titleKey: "welcome.feature2.title", bodyKey: "welcome.feature2.body" },
  { icon: <EmojiIcon src="lock.png" size={24} />, titleKey: "welcome.feature3.title", bodyKey: "welcome.feature3.body" },
];

// Real market context (see Sources) — grounds the pitch in the actual scale
// of the problem instead of an abstract claim.
const STATS = [
  { valueKey: "welcome.stat1.value", labelKey: "welcome.stat1.label" },
  { valueKey: "welcome.stat2.value", labelKey: "welcome.stat2.label" },
  { valueKey: "welcome.stat3.value", labelKey: "welcome.stat3.label" },
] as const;

export function WelcomePage() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const pitchRef = useRef<HTMLParagraphElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const targets = (
      [titleRef.current, subtitleRef.current, pitchRef.current, statsRef.current, ctaRef.current] as (
        | HTMLElement
        | null
      )[]
    ).filter((el): el is HTMLElement => el !== null);
    const cards = cardsRef.current ? Array.from(cardsRef.current.children) : [];

    if (prefersReducedMotion()) {
      for (const el of [...targets, ...cards]) {
        (el as HTMLElement).style.opacity = "1";
        (el as HTMLElement).style.transform = "none";
      }
      return;
    }

    const timeline = createTimeline();
    targets.forEach((el, i) => {
      timeline.add(el, { opacity: [0, 1], translateY: [16, 0], duration: 500, ease: "outQuad" }, i === 0 ? 0 : "-=300");
    });
    if (cards.length) {
      timeline.add(
        cards,
        { opacity: [0, 1], translateY: [20, 0], duration: 450, delay: stagger(90), ease: "outQuad" },
        "-=200",
      );
    }
  }, []);

  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [pendingAccount, setPendingAccount] = useState<{ id: string; suggestedName?: string } | null>(null);
  const [showStory, setShowStory] = useState(false);
  const t = useT();
  useLang(); // subscribes this component to language changes for re-render

  const enter = (shopName: string, accountId: string) => {
    try {
      localStorage.setItem(ENTERED_KEY, "1");
      localStorage.setItem(SHOP_NAME_KEY, shopName);
      localStorage.setItem(ACCOUNT_ID_KEY, accountId);
    } catch {
      /* ignore */
    }
    navigate("/");
  };

  // A signup or a first-time Google sign-in needs a username still (no
  // displayName saved yet); returning login/Google already has one, so it
  // skips straight into the app — same as a real "welcome back" flow. Either
  // way, Layout's sync effect pulls this account's ledger down on mount —
  // this is the moment a second device catches up with the first.
  const handleAuthenticated = (result: AuthResult) => {
    setAuthMode(null);
    if (!result.isNew && result.displayName) {
      enter(result.displayName, result.accountId);
      return;
    }
    setPendingAccount({ id: result.accountId, suggestedName: result.suggestedName ?? result.displayName ?? undefined });
  };

  const handleUsernamePicked = async (name: string) => {
    if (!pendingAccount) return;
    await setUsername(name);
    setPendingAccount(null);
    enter(name, pendingAccount.id);
  };

  return (
    <div className="kantha-weave relative min-h-dvh overflow-hidden bg-khata-red-deep">
      {/* Ambient themed background — decorative marketing motion, not core UI
          feedback, so a slow continuous loop is fine here (PRD §5.4's "nothing
          loops except the record pulse" rule is about in-app interaction
          states, not a landing page backdrop). Neutralized globally under
          prefers-reduced-motion via the blanket rule in index.css. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="blob blob-a bg-khata-red" />
        <div className="blob blob-b bg-rule-blue" />
        <div className="blob blob-c bg-baki-amber" />
        <div className="ruled-paper absolute inset-0 opacity-[0.06]" />
      </div>

      {/* The closed book — a single cover viewed at a slight 3D angle, not a
          flat full-bleed rectangle. Pivoting from the left edge (the spine,
          marked by the darker stripe) is the same technique used for the
          in-app cover/page flips, just held at a small static angle here
          instead of animating through it. */}
      <div
        className="relative z-10 mx-auto flex min-h-dvh max-w-md items-center justify-center px-4 py-8"
        style={{ perspective: "1200px" }}
      >
        <div
          className="relative w-full overflow-hidden rounded-3xl bg-khata-red shadow-2xl"
          style={{ transform: "rotateY(9deg)", transformOrigin: "left center", transformStyle: "preserve-3d" }}
        >
          <div className="absolute inset-y-0 left-0 z-20 w-2 bg-khata-red-deep" aria-hidden="true" />
          <KhataBackdrop tone="cream" />

          <div className="absolute right-3 top-3 z-20">
            <LangToggle className="rounded-full border border-page-cream/40 bg-ink/20 px-3 py-1 text-xs font-semibold text-page-cream shadow-sm backdrop-blur-sm" />
          </div>

          <div ref={heroRef} className="relative z-10 flex flex-col items-center px-6 pb-8 pt-12 text-center">
        <h1 ref={titleRef} className="font-bangla text-5xl font-bold text-page-cream opacity-0">
          {t("welcome.title")}
        </h1>
        <p ref={subtitleRef} className="mt-2 font-bangla text-lg text-page-cream/90 opacity-0">
          {t("welcome.subtitle")}
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-page-cream/15 px-3 py-1 text-xs font-medium text-page-cream/90 ring-1 ring-page-cream/25">
          <span
            aria-hidden="true"
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)" }}
          >
            ✦
          </span>
          <span>{t("welcome.poweredBy")}</span>
        </div>
        <p ref={pitchRef} className="mt-6 max-w-xs font-bangla text-base leading-relaxed text-page-cream/85 opacity-0">
          {t("welcome.pitch")}
        </p>

        <button
          type="button"
          onClick={() => setShowStory(true)}
          className="mt-3 font-bangla text-xs text-page-cream/80 underline decoration-dotted underline-offset-2"
        >
          {t("welcome.whyRedInfo")}
        </button>

        <div ref={statsRef} className="mt-6 grid w-full grid-cols-3 gap-2 opacity-0">
          {STATS.map((s) => (
            <div key={s.labelKey} className="rounded-xl bg-page-cream/10 px-2 py-3 ring-1 ring-page-cream/20">
              <p className="font-bangla text-lg font-bold text-page-cream">{t(s.valueKey)}</p>
              <p className="font-bangla text-[11px] leading-tight text-page-cream/75">{t(s.labelKey)}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-page-cream/50">TBS News · Baki.bd</p>

        <div ref={cardsRef} className="mt-8 flex w-full flex-col gap-3">
          {FEATURES.map((f) => (
            <div
              key={f.titleKey}
              className="flex items-center gap-3 rounded-2xl bg-page-cream/95 p-3 text-left opacity-0 shadow-lg"
            >
              <span className="text-2xl" aria-hidden="true">
                {f.icon}
              </span>
              <div>
                <p className="font-bangla text-sm font-semibold text-ink">
                  {f.titleKey === "welcome.feature2.title" ? (
                    <GlossaryTerm term="glossary.baki">{t(f.titleKey)}</GlossaryTerm>
                  ) : (
                    t(f.titleKey)
                  )}
                </p>
                <p className="font-bangla text-xs text-ink/60">{t(f.bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div ref={ctaRef} className="mt-9 flex w-full flex-col items-center gap-3 opacity-0">
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => setAuthMode("signup")}
              className="flex-1 rounded-full bg-page-cream px-4 py-3 font-bangla font-semibold text-khata-red shadow-lg transition-transform active:scale-95"
            >
              {t("welcome.signup")}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className="flex-1 rounded-full border-2 border-page-cream/70 px-4 py-3 font-bangla font-semibold text-page-cream transition-transform active:scale-95"
            >
              {t("welcome.login")}
            </button>
          </div>
          <p className="font-bangla text-xs text-page-cream/70">{t("welcome.privacyNote")}</p>
        </div>

        {authMode && (
          <AuthModal mode={authMode} onClose={() => setAuthMode(null)} onAuthenticated={handleAuthenticated} />
        )}

        {pendingAccount && (
          <UsernameModal initialValue={pendingAccount.suggestedName} onSubmit={handleUsernamePicked} />
        )}

        {showStory && <CultureStoryCard onClose={() => setShowStory(false)} />}

            <div className="mt-8 flex flex-col items-center gap-2">
              <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
                <g className="xeno-ring">
                  <polygon
                    points="20,2 35,11 35,29 20,38 5,29 5,11"
                    fill="none"
                    stroke="var(--color-page-cream)"
                    strokeOpacity="0.6"
                    strokeWidth="1.5"
                  />
                </g>
                <text x="20" y="25" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-page-cream)">
                  6
                </text>
              </svg>
              <p className="font-bangla text-xs text-page-cream/60">Made with ♥ by Team 6</p>
              <p className="font-bangla text-xs text-page-cream/60">U222, U224, U202</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
