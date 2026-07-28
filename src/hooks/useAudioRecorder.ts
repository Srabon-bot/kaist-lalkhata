import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_RECORDING_SECONDS } from "../config";
import type { Lang } from "../lib/i18n";

export type RecordingStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported";

export interface UseAudioRecorderResult {
  status: RecordingStatus;
  /** Live caption text from the best-effort in-browser SpeechRecognition run
   * alongside the recording — cosmetic only; the audio itself is what gets sent. */
  interimText: string;
  elapsedSeconds: number;
  start: () => void;
  stop: () => void;
  cancel: () => void;
}

// Chrome/Android (this app's target browser bar) only ever offers a webm
// container for MediaRecorder; the fallbacks matter for Safari/desktop
// testing. Live-tested against the Gemini API: it decodes the actual audio
// bytes rather than trusting the declared mimeType, so a bare "audio/webm"
// (no codec suffix) is fine to send even though it's not one of the
// container types the docs explicitly list.
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c)) ?? null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const RECOGNITION_LOCALE: Record<Lang, string> = { bn: "bn-BD", en: "en-US", ko: "ko-KR" };

// The Web Speech API's SpeechRecognition/webkitSpeechRecognition isn't part
// of TypeScript's DOM lib. Minimal shape for what this hook actually uses —
// see the (now-unused-for-extraction) useSpeechRecognition.ts for the
// original, fuller version of this same shim.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
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

/**
 * Hybrid capture: MediaRecorder captures the real audio (sent to Gemini for
 * transcription + extraction — see extractFromAudio / api/gemma.ts
 * "extract-audio" mode), while the browser's own SpeechRecognition runs
 * alongside it, purely so the mic sheet can show live captions as the
 * shopkeeper speaks. That rough browser transcript is also passed along
 * with the audio as a disambiguation hint (buildAudioExtractionPrompt
 * treats it as a hint, never authoritative — the audio is what's actually
 * transcribed). SpeechRecognition is best-effort only: if it's unsupported,
 * denied, or errors out, the audio recording is completely unaffected —
 * only `status`/`start`/`stop`/`cancel` (all MediaRecorder-driven) control
 * whether a recording happens at all.
 */
export function useAudioRecorder(
  onFinished: (audioBase64: string, mimeType: string, transcriptHint: string | null) => void,
  recognitionLang: Lang = "bn",
): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const cancelledRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    finalTranscriptRef.current = "";
    try {
      const recognition = new Ctor();
      recognition.lang = RECOGNITION_LOCALE[recognitionLang];
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscriptRef.current += result[0].transcript;
          else interim += result[0].transcript;
        }
        setInterimText(finalTranscriptRef.current + interim);
      };
      // Live captions are cosmetic and the transcript is only ever a hint —
      // an error here (no-speech, network, denied, aborted) just means no
      // caption/hint this time, never a reason to disturb the recording.
      recognition.onerror = () => {
        recognitionRef.current = null;
      };
      recognition.onend = () => {
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  }, [recognitionLang]);

  const stopRecognition = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore — best-effort only
    }
  }, []);

  const abortRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopRecognition();
  }, [stopRecognition]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    abortRecognition();
    teardownStream();
    clearTimer();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setStatus("idle");
    setInterimText("");
    setElapsedSeconds(0);
  }, [abortRecognition, clearTimer, teardownStream]);

  const start = useCallback(() => {
    const mimeType = pickMimeType();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !mimeType) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    cancelledRef.current = false;
    chunksRef.current = [];
    setInterimText("");
    // Gemini's inlineData.mimeType wants the bare container type, not the codec param.
    mimeTypeRef.current = mimeType.split(";")[0];

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          clearTimer();
          abortRecognition();
          teardownStream();
          mediaRecorderRef.current = null;
          setStatus("idle");
          setInterimText("");
          setElapsedSeconds(0);

          const chunks = chunksRef.current;
          chunksRef.current = [];
          if (cancelledRef.current || chunks.length === 0) return;

          const blob = new Blob(chunks, { type: mimeTypeRef.current });
          if (blob.size === 0) return;

          const transcriptHint = finalTranscriptRef.current.trim() || null;
          void blobToBase64(blob).then((base64) => onFinished(base64, mimeTypeRef.current, transcriptHint));
        };

        recorder.start();
        startRecognition();
        setStatus("listening");
        startedAtRef.current = Date.now();
        setElapsedSeconds(0);
        timerRef.current = window.setInterval(() => {
          const secs = (Date.now() - startedAtRef.current) / 1000;
          setElapsedSeconds(secs);
          if (secs >= MAX_RECORDING_SECONDS) recorder.stop();
        }, 100);
      })
      .catch(() => {
        setStatus("denied");
      });
  }, [abortRecognition, clearTimer, onFinished, startRecognition, teardownStream]);

  useEffect(
    () => () => {
      mediaRecorderRef.current?.stop();
      abortRecognition();
      teardownStream();
      clearTimer();
    },
    [abortRecognition, clearTimer, teardownStream],
  );

  return { status, interimText, elapsedSeconds, start, stop, cancel };
}
