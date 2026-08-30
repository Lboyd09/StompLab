import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractJson } from "./preset-schema";

/**
 * Gemini Developer API — August 2026.
 *
 * Free-tier keys reliably have gemini-2.5-flash. 3.7 Flash is often
 * overloaded ("too many users") and 429'd — try 2.5 first, then 3.x.
 * Prefer the visitor's browser: Google rejects many datacenter IPs.
 */
const PREFERRED_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash"] as const;

const GENERATE_MS = 28000;
const LIST_MS = 8000;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

type GeminiPart = { text?: string; thought?: boolean };
type GeminiBody = {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; code?: number };
};

function normalizeKey(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, "").replace(/\s+/g, "");
}

function isBusyStatus(status: number, message: string, apiStatus: string): boolean {
  const lower = `${message} ${apiStatus}`.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    apiStatus === "RESOURCE_EXHAUSTED" ||
    apiStatus === "UNAVAILABLE" ||
    /quota|overloaded|too many|high demand|unavailable|resource_exhausted|try again later/.test(lower)
  );
}

function googleMessage(status: number, body: string): string {
  let message = "";
  let apiStatus = "";
  try {
    const parsed = JSON.parse(body) as GeminiBody;
    message = parsed.error?.message ?? "";
    apiStatus = parsed.error?.status ?? "";
  } catch {
    message = body.slice(0, 240);
  }
  if (isBusyStatus(status, message, apiStatus)) {
    return "Gemini is busy on that model. Trying another Flash model.";
  }
  const lower = `${message} ${apiStatus}`.toLowerCase();
  if (
    status === 401 ||
    apiStatus === "UNAUTHENTICATED" ||
    /api[_ ]?key not valid|invalid api key|api key not valid|unregistered/.test(lower)
  ) {
    return "That Gemini key was rejected. Open Settings and paste an unrestricted key from Google AI Studio (aistudio.google.com/apikey) — do not lock it to an HTTP referrer.";
  }
  if (status === 403) {
    return "Gemini refused the key. In Google AI Studio, create a key with the Gemini API enabled (not a Cloud/Vertex key), with no application restriction.";
  }
  if (status === 404) {
    return "That Gemini model isn't on this key. We'll try another Flash model.";
  }
  if (message) return message.slice(0, 220);
  return `Gemini error ${status}`;
}

function isNetworkError(message: string): boolean {
  return /failed to fetch|networkerror|load failed|abort|timed out|cors/i.test(message);
}

function extractText(body: GeminiBody): string {
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => Boolean(p.text) && !p.thought)
    .map((p) => p.text as string)
    .join("")
    .trim();
}

function thinkingFor(model: string): Record<string, unknown> | undefined {
  if (model.includes("2.5") && !model.includes("lite")) {
    return { thinkingConfig: { thinkingBudget: 0 } };
  }
  // 3.x: omit thinking config. "minimal" 400s on some keys and eats JSON.
  return undefined;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function listFlashModels(apiKey: string): Promise<string[]> {
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: "GET" },
    LIST_MS,
  );
  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new Error(googleMessage(res.status, raw));
  let body: { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  try {
    body = JSON.parse(raw) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
  } catch {
    throw new Error("Gemini sent a broken model list.");
  }
  const names = (body.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter(Boolean);
  const ranked: string[] = [];
  for (const pref of [...PREFERRED_MODELS, "gemini-3.6-flash", "gemini-2.5-flash-lite"]) {
    if (names.includes(pref) && !ranked.includes(pref)) ranked.push(pref);
  }
  for (const n of names) {
    if (ranked.includes(n)) continue;
    if (!/flash/i.test(n)) continue;
    if (/tts|image|live|exp|pro/i.test(n)) continue;
    ranked.push(n);
  }
  if (!ranked.length) {
    throw new Error(
      "This key has no Gemini Flash model enabled. In Google AI Studio, create a new unrestricted key with the Gemini API turned on.",
    );
  }
  return ranked;
}

async function generateJson(
  apiKey: string,
  model: string,
  prompt: string,
  maxOutputTokens: number,
  extra?: Record<string, unknown>,
): Promise<{ ok: true; json: unknown } | { ok: false; status: number; error: string; raw: string }> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.2,
    maxOutputTokens,
    responseMimeType: "application/json",
    ...extra,
  };
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
      },
      GENERATE_MS,
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, status: 0, error: "Gemini timed out. Try again.", raw: "" };
    }
    const msg = err instanceof Error ? err.message : "network";
    return { ok: false, status: 0, error: msg, raw: "" };
  }
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    return { ok: false, status: res.status, error: googleMessage(res.status, raw), raw };
  }
  let body: GeminiBody;
  try {
    body = JSON.parse(raw) as GeminiBody;
  } catch {
    return { ok: false, status: 200, error: "Gemini sent a broken response.", raw };
  }
  if (body.promptFeedback?.blockReason) {
    return { ok: false, status: 200, error: "Gemini blocked that request. Try a different song title.", raw };
  }
  const text = extractText(body);
  if (!text) {
    const reason = body.candidates?.[0]?.finishReason ?? "empty";
    return {
      ok: false,
      status: 200,
      error: reason === "MAX_TOKENS" ? "Gemini ran out of room. Try again." : "Gemini returned an empty answer.",
      raw,
    };
  }
  try {
    return { ok: true, json: extractJson(text) };
  } catch {
    return { ok: false, status: 200, error: "Gemini JSON could not be read. Try again.", raw };
  }
}

function isFatalKeyError(status: number, error: string, raw: string): boolean {
  if (status === 401 || status === 403) return true;
  const lower = `${error} ${raw}`.toLowerCase();
  return /api[_ ]?key not valid|invalid api key|unregistered|key was rejected|refused the key/.test(lower);
}

function isBusyError(status: number, error: string, raw: string): boolean {
  return isBusyStatus(status, error, "") || /busy on that model|rate limit|overloaded|too many/i.test(`${error} ${raw}`);
}

async function callGemini(apiKey: string, prompt: string, maxOutputTokens = 8192): Promise<unknown> {
  const key = normalizeKey(apiKey);
  if (key.length < 20) throw new Error("Add a free Gemini API key in Settings first.");

  let queue: string[] = [...PREFERRED_MODELS];
  const tried = new Set<string>();
  let last = "Gemini request failed";
  let listed = false;
  let sawBusy = false;

  while (tried.size < 4) {
    const model = queue.find((m) => !tried.has(m));
    if (!model) break;
    tried.add(model);
    let extra = thinkingFor(model);
    const result = await generateJson(key, model, prompt, maxOutputTokens, extra);
    if (result.ok) return result.json;
    last = result.error;
    const lower = `${result.error} ${result.raw}`.toLowerCase();

    if (isFatalKeyError(result.status, result.error, result.raw)) {
      throw new Error(result.error);
    }
    if (/timed out/i.test(result.error)) {
      const retry = await generateJson(key, model, prompt, maxOutputTokens, extra);
      if (retry.ok) return retry.json;
      last = retry.error;
      if (isFatalKeyError(retry.status, retry.error, retry.raw)) throw new Error(retry.error);
      if (isBusyError(retry.status, retry.error, retry.raw)) {
        sawBusy = true;
        continue;
      }
    }
    if (isBusyError(result.status, result.error, result.raw)) {
      sawBusy = true;
      last = result.error;
      continue;
    }
    if (extra && (/thinking/i.test(lower) || result.error.includes("empty answer"))) {
      extra = undefined;
      const retry = await generateJson(key, model, prompt, maxOutputTokens, extra);
      if (retry.ok) return retry.json;
      last = retry.error;
      if (isFatalKeyError(retry.status, retry.error, retry.raw)) throw new Error(retry.error);
      if (isBusyError(retry.status, retry.error, retry.raw)) {
        sawBusy = true;
        continue;
      }
    }
    if ((result.status === 404 || /isn't on this key|not found|not supported/i.test(lower)) && !listed) {
      listed = true;
      try {
        const live = await listFlashModels(key);
        queue = [...queue, ...live.filter((n) => !tried.has(n) && !queue.includes(n))];
      } catch {
        // keep walking the preferred list
      }
    }
  }
  if (sawBusy) {
    throw new Error(
      "Gemini is busy right now. Wait a minute and try again, or open a featured song — those don't need a key.",
    );
  }
  throw new Error(last);
}

const ProxyIn = z.object({
  apiKey: z.string().min(8).max(200),
  prompt: z.string().min(1).max(80000),
  maxOutputTokens: z.number().int().min(64).max(8192).optional(),
});

export const proxyGemini = createServerFn({ method: "POST" })
  .validator((input: unknown) => ProxyIn.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; json: Json } | { ok: false; error: string }> => {
    try {
      const json = (await callGemini(
        data.apiKey,
        data.prompt,
        data.maxOutputTokens ?? 8192,
      )) as Json;
      return { ok: true, json };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Gemini failed",
      };
    }
  });

const KeyIn = z.object({ apiKey: z.string().min(8).max(200) });

export const proxyTestKey = createServerFn({ method: "POST" })
  .validator((input: unknown) => KeyIn.parse(input))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    try {
      await listFlashModels(normalizeKey(data.apiKey));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Key test failed" };
    }
  });

export async function geminiJson(apiKey: string, prompt: string): Promise<unknown> {
  const key = normalizeKey(apiKey);
  if (key.length < 20) throw new Error("Add a free Gemini API key in Settings first.");

  try {
    return await callGemini(key, prompt);
  } catch (clientErr) {
    const clientMsg = clientErr instanceof Error ? clientErr.message : "Gemini failed";
    if (!isNetworkError(clientMsg) && /key was rejected|refused the key/i.test(clientMsg)) {
      throw clientErr;
    }
    try {
      const proxied = await proxyGemini({ data: { apiKey: key, prompt } });
      if (proxied.ok) return proxied.json;
      throw new Error(isNetworkError(clientMsg) ? proxied.error : clientMsg);
    } catch (proxyErr) {
      if (isNetworkError(clientMsg) && proxyErr instanceof Error) throw proxyErr;
      throw clientErr;
    }
  }
}

export async function testGeminiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = normalizeKey(apiKey);
  if (key.length < 20) {
    return {
      ok: false,
      error: "That doesn't look like a Gemini key. Paste the full key from Google AI Studio — it starts with AIza.",
    };
  }
  try {
    await listFlashModels(key);
    return { ok: true };
  } catch (clientErr) {
    const clientMsg = clientErr instanceof Error ? clientErr.message : "Key test failed";
    try {
      const proxied = await proxyTestKey({ data: { apiKey: key } });
      if (proxied.ok) return { ok: true };
      if (isNetworkError(clientMsg)) {
        return {
          ok: false,
          error:
            "Google couldn't be reached from this browser. Create an unrestricted AI Studio key (no HTTP-referrer lock) and try Save & test again.",
        };
      }
      return { ok: false, error: clientMsg };
    } catch {
      return { ok: false, error: clientMsg };
    }
  }
}
