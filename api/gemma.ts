// Vercel Edge Function — the ONLY place GEMINI_API_KEY is read.
// The browser never talks to generativelanguage.googleapis.com directly;
// the weekly insight card is routed through this proxy. See PRD §6.
//
// This used to also handle voice-entry extraction (transcript/audio ->
// ledger JSON) — removed once src/lib/localExtraction.ts replaced it with a
// local, non-API engine (see RULE_BASED_EXTRACTION_PLAN.md) and nothing
// called the extract/extract-audio modes anymore.
import { GEMMA_MODEL, GEMMA_TIMEOUT_MS } from "../src/config";
import { buildInsightPrompt } from "../src/lib/prompt";

export const config = { runtime: "edge" };

function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Best-effort in-memory rate limit per IP. Edge instances are ephemeral and
// distributed, so this does not enforce a hard global cap — it just blunts a
// single hot client hammering the free-tier quota during the demo/judging
// window. A real deployment would back this with Vercel KV or similar.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

interface GemmaRequestBody {
  /** PRD §4.2 S3: weekly-summary text -> one short Bangla insight sentence. */
  insightData?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "server_misconfigured", message: "GEMINI_API_KEY is not set" }, 500);
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return json({ error: "rate_limited" }, 429);
  }

  let body: GemmaRequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_request", message: "Body must be JSON" }, 400);
  }

  if (!body.insightData || !body.insightData.trim()) {
    return json({ error: "invalid_request", message: "insightData is required" }, 400);
  }
  const promptText = buildInsightPrompt(body.insightData);

  const geminiPayload = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      // gemma-4-*-it spends part of its output budget on internal "thought"
      // tokens before the final answer (thinkingConfig can't disable it —
      // verified 400 "Thinking budget is not supported for this model").
      // Budget generously so the actual answer isn't truncated away.
      maxOutputTokens: 4096,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMMA_TIMEOUT_MS);

  try {
    const upstream = await fetch(geminiUrl(GEMMA_MODEL), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(geminiPayload),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return json({ error: "upstream_error", status: upstream.status, message: errText }, 502);
    }

    const data = await upstream.json();
    const parts: Array<{ text?: string; thought?: boolean }> = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("");

    if (!text) {
      return json({ error: "empty_response", message: "Gemma returned no text" }, 502);
    }

    return json({ text });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return json({ error: isAbort ? "timeout" : "proxy_error", message: String(err) }, isAbort ? 504 : 500);
  } finally {
    clearTimeout(timeout);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
