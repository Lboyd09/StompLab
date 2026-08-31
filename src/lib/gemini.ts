import { extractJson } from "./preset-schema";

/**
 * Research backend: Gemini 2.5 Flash only.
 *
 * Two ways the owner can attach a key (checked in this order):
 *   1. A Google AI Studio key (`AIza…`) in GEMINI_API_KEY / GOOGLE_API_KEY /
 *      GOOGLE_GENERATIVE_AI_API_KEY / or even AI_GATEWAY_API_KEY — we send it
 *      to Google's own generateContent endpoint. Putting a Google key in the
 *      Gateway slot used to silently fail.
 *   2. A Vercel AI Gateway key / OIDC token — `google/gemini-2.5-flash` via
 *      ai-gateway.vercel.sh.
 *
 * Never fall back to 3.x or any other model.
 */
const GOOGLE_MODEL = "gemini-2.5-flash";
const GATEWAY_MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const GOOGLE_GENERATE = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent`;
const GENERATE_MS = 32000;
const BUSY = "Research is busy. Try again in a minute.";
const SYSTEM =
  "You are a session tech programming Line 6 HX Stomp presets. Reply with a single JSON object. No markdown.";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type ResearchBackend = "google" | "gateway";

export function classifyKey(raw: string | undefined | null): ResearchBackend | "empty" {
  const key = (raw ?? "").trim();
  if (!key) return "empty";
  if (key.startsWith("AIza") || key.startsWith("AIzaSy")) return "google";
  return "gateway";
}

export function collectResearchKeys(env: NodeJS.ProcessEnv = process.env): {
  google: string;
  gateway: string;
} {
  const namedGoogle =
    env.GEMINI_API_KEY?.trim() ||
    env.GOOGLE_API_KEY?.trim() ||
    env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    "";
  const gatewayOrMixed = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim() || "";
  const mixedKind = classifyKey(gatewayOrMixed);
  const google = namedGoogle || (mixedKind === "google" ? gatewayOrMixed : "");
  const gateway = mixedKind === "google" ? "" : gatewayOrMixed;
  return { google, gateway };
}

export function geminiConfigured() {
  const { google, gateway } = collectResearchKeys();
  return Boolean(google || gateway);
}

function isBusyStatus(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    /quota|overloaded|too many|high demand|unavailable|resource_exhausted|try again later|rate limit|billing|credit/.test(
      lower,
    )
  );
}

function friendlyGoogleError(status: number, raw: string): string {
  const lower = raw.toLowerCase();
  if (status === 400 && /api.?key|invalid/i.test(raw)) {
    return "The research key was rejected. Check GEMINI_API_KEY on the host.";
  }
  if (status === 403 || /permission|disabled/i.test(lower)) {
    return "Research is blocked on this key. Enable Gemini 2.5 Flash for it in Google AI Studio.";
  }
  if (isBusyStatus(status, raw) || /billing|credit|quota/i.test(lower)) {
    return "Research is waiting on API billing. Add credit, wait a minute, try a demo in the meantime.";
  }
  if (status === 404) return "Gemini 2.5 Flash isn't available on this key yet.";
  return raw.slice(0, 220) || `Research failed (${status}). Try again.`;
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

async function googleGenerate(key: string, prompt: string): Promise<string> {
  const url = `${GOOGLE_GENERATE}?key=${encodeURIComponent(key)}`;
  const payload: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    }),
  };

  let res: Response | null = null;
  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchWithTimeout(url, payload, GENERATE_MS);
      raw = await res.text().catch(() => "");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new Error(BUSY);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }
      throw err;
    }
    if (res.ok) break;
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 900));
      continue;
    }
    throw new Error(friendlyGoogleError(res.status, raw));
  }
  if (!res || !res.ok) throw new Error(friendlyGoogleError(res?.status ?? 0, raw));

  let text = "";
  try {
    const body = JSON.parse(raw) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
    };
    if (body.error?.message) throw new Error(friendlyGoogleError(res.status, body.error.message));
    if (body.promptFeedback?.blockReason) {
      throw new Error("Research blocked that prompt. Try a different song title.");
    }
    text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  } catch (err) {
    if (err instanceof Error && /blocked|rejected|billing|Research/.test(err.message)) throw err;
    throw new Error("Could not read that answer. Try the song again.");
  }
  if (!text.trim()) throw new Error("Empty answer. Try again.");
  return text;
}

async function gatewayGenerate(token: string, prompt: string): Promise<string> {
  const res = await fetchWithTimeout(
    GATEWAY,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GATEWAY_MODEL,
        temperature: 0.2,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    },
    GENERATE_MS,
  );
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    if (isBusyStatus(res.status, raw)) throw new Error(BUSY);
    let message = "";
    try {
      message = String((JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? "");
    } catch {
      message = raw.slice(0, 220);
    }
    if (isBusyStatus(res.status, message)) throw new Error(BUSY);
    throw new Error(message || `Research failed (${res.status}). Try again.`);
  }
  try {
    const body = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("Empty answer. Try again.");
    return content;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Empty")) throw err;
    throw new Error("Could not read that answer. Try the song again.");
  }
}

export async function geminiJson(prompt: string): Promise<unknown> {
  const { google, gateway } = collectResearchKeys();
  if (!google && !gateway) {
    throw new Error("Song research isn't configured on this copy yet. Try a featured demo, or try again later.");
  }

  const errors: string[] = [];
  const tryGoogle = async () => {
    if (!google) return null;
    try {
      return extractJson(await googleGenerate(google, prompt));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google research failed.";
      if (err instanceof Error && err.name === "AbortError") throw new Error(BUSY);
      errors.push(msg);
      return null;
    }
  };
  const tryGateway = async () => {
    if (!gateway) return null;
    try {
      return extractJson(await gatewayGenerate(gateway, prompt));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new Error(BUSY);
      errors.push(err instanceof Error ? err.message : "Gateway research failed.");
      return null;
    }
  };

  // Prefer the backend that matches the key the owner actually paid for.
  const first = google ? await tryGoogle() : await tryGateway();
  if (first) return first;
  const second = google ? await tryGateway() : await tryGoogle();
  if (second) return second;
  throw new Error(errors[0] || BUSY);
}

/** Admin-only connectivity check. Never returns the key. */
export async function probeResearch(): Promise<{
  configured: boolean;
  google: "ok" | "missing" | "error";
  gateway: "ok" | "missing" | "error";
  detail: string;
}> {
  const { google, gateway } = collectResearchKeys();
  const ping = 'Reply with JSON {"ok":true} and nothing else.';
  let gStatus: "ok" | "missing" | "error" = google ? "error" : "missing";
  let wStatus: "ok" | "missing" | "error" = gateway ? "error" : "missing";
  const notes: string[] = [];
  if (google) {
    try {
      await googleGenerate(google, ping);
      gStatus = "ok";
    } catch (err) {
      notes.push(`Google: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  if (gateway) {
    try {
      await gatewayGenerate(gateway, ping);
      wStatus = "ok";
    } catch (err) {
      notes.push(`Gateway: ${err instanceof Error ? err.message : "failed"}`);
    }
  }
  return {
    configured: Boolean(google || gateway),
    google: gStatus,
    gateway: wStatus,
    detail: notes.join(" · ") || (google || gateway ? "Ready." : "No research key is set."),
  };
}

/** @deprecated visitor keys are gone — kept so old imports compile until call sites move */
export async function testGeminiKey(_key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: false, error: "Visitor API keys are no longer used." };
}
