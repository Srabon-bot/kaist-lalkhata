import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_SECONDS } from "../config";
import type { Lang } from "../lib/i18n";

const RECOGNITION_LOCALE: Record<Lang, string> = { bn: "bn-BD", en: "en-US", ko: "ko-KR" };

export type RecognitionStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported";

// The Web Speech API's SpeechRecognition/webkitSpeechRecognition isn't part
// of TypeScript's DOM lib. Minimal shape for what this hook actually uses —
// not a full spec implementation.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Android's OS-level speech recognizer has no real continuous mode: Chrome
// emulates `continuous: true` by silently restarting the native recognizer,
// and on each restart it re-announces the whole session so far as a new
// "final" result — producing runaway, ever-growing duplicated transcripts.
// This is a long-standing, still-open Chromium bug (crbug 258985 /
// issues.chromium.org/issues/40324711), not something fixable from
// application code while `continuous: true` is in use. Desktop Chrome has no
// such bug. See useSpeechRecognition's Android branch below for the
// workaround: run single-shot sessions and restart them ourselves.
function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

export interface UseSpeechRecognitionResult {
  status: RecognitionStatus;
  interimText: string;
  elapsedSeconds: number;
  start: () => void;
  stop: () => void;
  cancel: () => void;
}

/**
 * Captures a spoken transaction as text via the browser's built-in speech
 * recognition (Chrome/Android — same browser support bar the app already
 * targets). Replaces raw-audio capture: Gemma's audio input isn't enabled
 * for this project's API key (see src/config.ts), so the transcript is what
 * gets sent to Gemma for structured extraction.
 *
 * `recognitionLang` follows the app's EN/BN UI toggle rather than being a
 * separate setting — someone who can't speak Bangla should still be able to
 * dictate a transaction once they've switched the app to English. Gemma's
 * extraction is language-agnostic, so an English utterance still parses
 * into the same structured ledger entry.
 */
export function useSpeechRecognition(
  onFinished: (transcript: string) => void,
  recognitionLang: Lang = "bn",
): UseSpeechRecognitionResult {
  const [status, setStatus] = useState<RecognitionStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const deniedRef = useRef(false);
  const stoppingRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    stoppingRef.current = true;
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
    }
    recognitionRef.current = null;
    clearTimer();
    finalTranscriptRef.current = "";
    setStatus("idle");
    setInterimText("");
    setElapsedSeconds(0);
  }, [clearTimer]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    deniedRef.current = false;
    stoppingRef.current = false;
    finalTranscriptRef.current = "";
    const android = isAndroid();

    const finishUp = () => {
      clearTimer();
      recognitionRef.current = null;
      const finished = finalTranscriptRef.current.trim();
      setStatus("idle");
      setInterimText("");
      setElapsedSeconds(0);
      if (finished) onFinished(finished);
    };

    const runSession = (isRestart: boolean) => {
      const recognition = new Ctor();
      recognition.lang = RECOGNITION_LOCALE[recognitionLang];
      // Android: single-shot session, manually restarted on `onend` (see
      // isAndroid() above for why). Desktop: real continuous mode works.
      recognition.continuous = !android;
      recognition.interimResults = true;

      recognition.onstart = () => {
        lastErrorRef.current = null;
        setStatus("listening");
        // Keep the elapsed-time timer running across Android's session
        // restarts instead of resetting it per-session.
        if (timerRef.current === null) {
          startedAtRef.current = Date.now();
          setElapsedSeconds(0);
          timerRef.current = window.setInterval(() => {
            const secs = (Date.now() - startedAtRef.current) / 1000;
            setElapsedSeconds(secs);
            if (secs >= MAX_RECORDING_SECONDS) {
              stoppingRef.current = true;
              recognition.stop();
            }
          }, 100);
        }
      };

      recognition.onresult = (event) => {
        let sessionFinal = "";
        let interim = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            sessionFinal += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (android) {
          // Each single-shot session's results are self-contained, so we
          // own accumulation across sessions instead of trusting Chrome's
          // (broken, on Android) continuous-mode result buffer.
          const trimmed = sessionFinal.trim();
          if (trimmed) {
            finalTranscriptRef.current = finalTranscriptRef.current
              ? `${finalTranscriptRef.current} ${trimmed}`
              : trimmed;
          }
        } else {
          // Rebuild from index 0 every event rather than appending via
          // event.resultIndex, so a spurious replayed final can't double up.
          finalTranscriptRef.current = sessionFinal;
        }
        setInterimText(interim);
      };

      recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          deniedRef.current = true;
          stoppingRef.current = true;
          setStatus("denied");
          return;
        }
        lastErrorRef.current = event.error;
        // Other errors (no-speech, aborted, network) resolve via onend below.
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        if (deniedRef.current) {
          clearTimer();
          return;
        }
        // A persistent hardware/connectivity error (as opposed to the
        // expected "no-speech" pause) shouldn't retry forever — Android's
        // restart-on-end loop would otherwise beep and retry indefinitely.
        const hardFailure = lastErrorRef.current === "audio-capture" || lastErrorRef.current === "network";
        if (!android || stoppingRef.current || hardFailure) {
          finishUp();
          return;
        }
        // Android ends each single-shot session after a short pause;
        // immediately start the next one so listening feels continuous.
        runSession(true);
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        if (isRestart) {
          // The native recognizer sometimes isn't fully released yet right
          // after the previous session ended; retry shortly instead of
          // surfacing a spurious "denied" state to the user.
          window.setTimeout(() => runSession(true), 250);
        } else {
          setStatus("denied");
        }
      }
    };

    runSession(false);
  }, [clearTimer, onFinished, recognitionLang]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
      clearTimer();
    },
    [clearTimer],
  );

  return { status, interimText, elapsedSeconds, start, stop, cancel };
}
