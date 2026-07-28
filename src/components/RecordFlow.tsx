import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { MicRecorder } from "./MicRecorder";
import { ConfirmationCard, type EditedEntry } from "./ConfirmationCard";
import { extractLocally } from "../lib/localExtraction";
import { recordEntry } from "../lib/db";
import type { ExtractionResult } from "../lib/schema";
import { useT, useLang } from "../lib/i18n";

type Phase = "capture" | "confirm" | "error";

interface RecordFlowProps {
  open: boolean;
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RecordFlow({ open, onClose }: RecordFlowProps) {
  const t = useT();
  const { lang } = useLang();
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<Phase>("capture");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const lastTranscriptRef = useRef<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const errorBoxRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setPhase("capture");
    setResult(null);
    lastTranscriptRef.current = null;
  };

  const handleClose = () => {
    onClose();
  };

  // Bottom sheet slide-up on open, slide-down before actually unmounting on
  // close — a real transition instead of the modal snapping in/out (PRD §5.4
  // motion table calls for settled, deliberate transitions everywhere).
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;

    if (open) {
      if (prefersReducedMotion()) {
        backdrop.style.opacity = "1";
        sheet.style.opacity = "1";
        sheet.style.transform = "none";
        return;
      }
      animate(backdrop, { opacity: [0, 1], duration: 200, ease: "outQuad" });
      animate(sheet, { translateY: [48, 0], opacity: [0, 1], duration: 320, ease: "outQuad" });
      return;
    }

    if (prefersReducedMotion()) {
      reset();
      setMounted(false);
      return;
    }
    animate(backdrop, { opacity: [1, 0], duration: 180, ease: "inQuad" });
    animate(sheet, {
      translateY: [0, 48],
      opacity: [1, 0],
      duration: 220,
      ease: "inQuad",
      onComplete: () => {
        reset();
        setMounted(false);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  // Local rule-based extraction (src/lib/localExtraction.ts) — no network
  // call, so this always succeeds structurally (worst case: type
  // "unclear"). The try/catch is just a safety net against an unexpected
  // exception, not a real error-handling path the way the old
  // Gemini-backed version needed (network/timeout/quota failures don't
  // apply anymore — see RULE_BASED_EXTRACTION_PLAN.md).
  const runExtraction = (transcript: string) => {
    lastTranscriptRef.current = transcript;
    try {
      setResult(extractLocally(transcript, lang));
      setPhase("confirm");
    } catch {
      setPhase("error");
    }
  };

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A single gentle shake on arrival at the error state — never looping
  // (PRD §5.4: "gentle single shake / fade-in, nothing looping").
  useEffect(() => {
    if (phase !== "error" || prefersReducedMotion() || !errorBoxRef.current) return;
    animate(errorBoxRef.current, {
      translateX: [0, -8, 8, -6, 6, 0],
      duration: 400,
      ease: "inOutQuad",
    });
  }, [phase]);

  if (!mounted) return null;

  const handleConfirm = async (entry: EditedEntry) => {
    await recordEntry({
      type: entry.type,
      customerName: entry.customer,
      item: entry.item,
      itemTranslations: entry.itemTranslations,
      amountTaka: entry.amountTaka,
      confidence: result?.confidence ?? null,
      transcript: result?.transcript ?? null,
      edited: entry.edited,
    });
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={t("record.dialogLabel")}>
      <div ref={backdropRef} className="absolute inset-0 bg-ink/40 opacity-0" aria-hidden="true" />
      <div ref={sheetRef} className="relative w-full max-w-md rounded-t-3xl bg-page-cream p-6 pb-8 opacity-0 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex justify-end">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label={t("common.close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-ink/50"
          >
            ✕
          </button>
        </div>

        {phase === "capture" && (
          <div className="flex justify-center pb-2">
            <MicRecorder onRecorded={runExtraction} />
          </div>
        )}

        {phase === "confirm" && result && (
          <ConfirmationCard result={result} onConfirm={handleConfirm} onReRecord={reset} />
        )}

        {phase === "error" && (
          <div ref={errorBoxRef} className="flex flex-col items-center gap-4 py-4 text-center" role="alert">
            <p className="font-bangla text-lg font-semibold text-khata-red">{t("error.server")}</p>
            <button
              type="button"
              onClick={() => lastTranscriptRef.current && runExtraction(lastTranscriptRef.current)}
              className="rounded-full bg-khata-red px-6 py-3 font-bangla font-semibold text-white"
            >
              {t("common.tryAgain")}
            </button>
            <button type="button" onClick={reset} className="font-bangla text-sm text-ink/60 underline">
              {t("record.speakAgain")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
