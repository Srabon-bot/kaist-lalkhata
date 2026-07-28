import { useEffect, useRef } from "react";
import { animate, type JSAnimation } from "animejs";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { EmojiIcon } from "./EmojiIcon";
import { MAX_RECORDING_SECONDS } from "../config";
import { dict, useLang, useT, type DictKey } from "../lib/i18n";

interface MicRecorderProps {
  onRecorded: (transcript: string) => void;
  disabled?: boolean;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Lets someone who can't speak Bangla still trigger the real extraction
// pipeline end-to-end — taps feed straight into the same onRecorded
// callback a finished voice recording would, no mic required.
const SAMPLES: { transcriptKey: DictKey; glossKey: DictKey }[] = [
  { transcriptKey: "mic.sampleCreditSale", glossKey: "type.creditSale" },
  { transcriptKey: "mic.sampleCashSale", glossKey: "type.cashSale" },
  { transcriptKey: "mic.sampleRepayment", glossKey: "type.repayment" },
];

export function MicRecorder({ onRecorded, disabled }: MicRecorderProps) {
  const t = useT();
  const { lang } = useLang();
  const { status, elapsedSeconds, interimText, start, stop, cancel } = useSpeechRecognition(onRecorded, lang);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const pulseRef = useRef<JSAnimation | null>(null);

  useEffect(() => {
    if (status === "listening" && micButtonRef.current && !prefersReducedMotion()) {
      pulseRef.current = animate(micButtonRef.current, {
        scale: [1, 1.08],
        duration: 900,
        direction: "alternate",
        loop: true,
        ease: "inOutSine",
      });
    } else {
      pulseRef.current?.revert();
      pulseRef.current = null;
    }
    return () => {
      pulseRef.current?.revert();
      pulseRef.current = null;
    };
  }, [status]);

  const remaining = Math.max(0, MAX_RECORDING_SECONDS - elapsedSeconds);

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="alert">
        <p className="font-bangla text-lg font-semibold text-khata-red">{t("mic.deniedTitle")}</p>
        <p className="max-w-xs text-sm text-ink/80">{t("mic.deniedBody")}</p>
        <button
          type="button"
          onClick={start}
          className="rounded-full bg-rule-blue px-6 py-3 font-bangla font-semibold text-white"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="max-w-xs text-center font-bangla text-sm text-khata-red" role="alert">
          {t("mic.unsupported")}
        </p>
        <SampleChips onPick={onRecorded} t={t} />
      </div>
    );
  }

  if (status === "listening" || status === "requesting") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p
          className="min-h-6 max-w-xs px-4 text-center font-bangla text-base text-ink/80"
          aria-live="polite"
        >
          {status === "requesting" ? t("mic.requesting") : interimText || t("mic.listening")}
        </p>
        <p className="tabular-amount font-bangla text-sm text-ink/70" aria-live="polite">
          {Math.ceil(remaining)} {t("mic.secondsLeft")}
        </p>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={cancel}
            aria-label={t("mic.cancel")}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink/20 text-2xl text-ink/60"
          >
            ✕
          </button>
          <button
            ref={micButtonRef}
            type="button"
            onClick={stop}
            aria-label={t("mic.stop")}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-khata-red text-3xl text-white shadow-lg"
          >
            ■
          </button>
        </div>
        <p className="font-bangla text-sm text-ink/70">{t("mic.speakThenStop")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-3">
        <button
          ref={micButtonRef}
          type="button"
          disabled={disabled}
          onClick={start}
          aria-label={t("nav.mic")}
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-rule-blue text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
        >
          <EmojiIcon src="mic.png" size={30} />
        </button>
        <p className="font-bangla text-sm text-ink/70">{t("mic.tapToSpeak")}</p>
        <p className="font-bangla text-xs text-ink/50">{t("mic.speakInLang")}</p>
        <div className="flex w-full max-w-[260px] flex-col gap-1 rounded-xl bg-rule-blue/10 px-3 py-2 text-center">
          <p className="font-bangla text-xs font-medium text-rule-blue">{t("mic.structureHintSale")}</p>
          <p className="font-bangla text-xs font-medium text-rule-blue">{t("mic.structureHintRepayment")}</p>
        </div>
      </div>
      <SampleChips onPick={onRecorded} t={t} />
    </div>
  );
}

function SampleChips({ onPick, t }: { onPick: (transcript: string) => void; t: (key: DictKey) => string }) {
  const { lang } = useLang();
  return (
    <div className="flex w-full flex-col items-center gap-2 border-t border-ink/10 pt-3">
      <p className="font-bangla text-xs text-ink/50">{t("mic.orTrySample")}</p>
      <div className="flex flex-col gap-1.5 self-stretch">
        {SAMPLES.map((s) => {
          const bnTranscript = dict[s.transcriptKey].bn;
          // Send the sample in the CURRENT UI language, not always Bangla —
          // extractLocally() (src/lib/localExtraction.ts) has per-language
          // grammar rules (e.g. Bangla কে/টাকার postpositions vs Korean
          // 에게/를 particles vs English to/from/worth), so the text sent
          // has to actually match the language extraction will run as. This
          // differs from the old Gemini-based extraction, which understood
          // any of the three languages regardless of what lang hint was
          // passed, so "always send Bangla" happened to work there.
          const sampleTranscript = dict[s.transcriptKey][lang];
          return (
            <button
              key={s.transcriptKey}
              type="button"
              onClick={() => onPick(sampleTranscript)}
              className="rounded-xl border border-ink/10 bg-page-cream px-3 py-2 text-left transition-colors active:bg-ink/5"
            >
              <span className="mr-1.5 rounded-full bg-khata-red/10 px-2 py-0.5 font-bangla text-[10px] font-semibold text-khata-red">
                {t(s.glossKey)}
              </span>
              <span className="font-bangla text-xs text-ink/70">{bnTranscript}</span>
              {lang !== "bn" && <span className="block text-[11px] text-ink/50">{dict[s.transcriptKey][lang]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
