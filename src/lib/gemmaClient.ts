import { GEMMA_PROXY_ENDPOINT, GEMMA_TIMEOUT_MS } from "../config";

export type GemmaErrorKind = "network" | "timeout" | "invalid_json" | "server";

export class GemmaError extends Error {
  readonly kind: GemmaErrorKind;

  constructor(message: string, kind: GemmaErrorKind) {
    super(message);
    this.kind = kind;
    this.name = "GemmaError";
  }
}

/**
 * PRD §4.2 S3 — sends the week's already-computed summary to Gemma and
 * returns one short Bangla observation. The only remaining use of Gemma in
 * this app; voice-entry extraction runs entirely locally now (see
 * src/lib/localExtraction.ts).
 */
export async function getWeeklyInsight(summaryText: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMMA_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(GEMMA_PROXY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "insight", insightData: summaryText }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new GemmaError("Gemma request timed out", "timeout");
    }
    throw new GemmaError("Network error reaching /api/gemma", "network");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new GemmaError(`Proxy responded ${res.status}`, res.status >= 500 ? "server" : "network");
  }

  const data = (await res.json()) as { text?: string; error?: string };
  if (!data.text) {
    throw new GemmaError(data.error ?? "Empty response from proxy", "server");
  }
  return data.text.trim();
}
