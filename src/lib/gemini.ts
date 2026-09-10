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
const GENERATE_MS = 50000;
const BUSY = "Research is busy. Try again in a minute.";
export const SYSTEM =
  "Session tech. One job: a Line 6 Helix-family preset that A/Bs against THIS record (brightness, dirt, mids, pick attack, room). JSON object only. No markdown. Never a generic genre patch. " +
  "Do the research in thinking BEFORE any modelId. Fill originalGear with REAL product names first — 'tube amp' or 'distortion pedal' means you have not finished. " +
  "Protocol (Guitar Chalk tone-language + Guitar World / session-credit method): " +
  "1) album, year, studio, producer, which player — studio album beats a later live version. " +
  "2) one-sentence tone fingerprint of the recorded guitar/bass (put it first in summary). " +
  "3) guitar + pickups + selector + volume/tone + tuning as tracked. " +
  "4) amp + channel + published Drive/Bass/Mid/Treble/Presence/Master — published numbers beat guesses. Unknown rock ≠ Dual Rectifier. Unknown Fender ≠ Deluxe. Twin Reverb is not a Deluxe. " +
  "5) pedal order on THAT session, not a later tour board. Distortion ~noon unless a published number exists. " +
  "6) cab + speakers + mic + distance; close and dry unless the record is roomy. " +
  "7) technique in tips (pick, palm mute, guitar volume as a gain stage). " +
  "8) arrangement by TONE not lyrics — sections that share a chain are one snapshot; a solo is its own snapshot only if the tone changes. " +
  "9) THEN map each real piece to a catalog modelId. " +
  "Session credits beat a simplified 'use a Twin' guide. Tracking rig beats a later tour rig. Guitar Chalk is good for tone language; credits win on gear. " +
  "Listener test: album in one ear, this preset in the other.";
export const CUSTOM_SYSTEM =
  "You are a session tech. Invent one original Line 6 Helix-family preset from a player's description. This is a custom sound, not a song replica. Do not copy a famous player's documented rig or a similar recorded song unless they named that song. Reply with a single JSON object. No markdown.";

export function friendlyResearchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (/self-signed|certificate|unable_to_verify|cert_|ssl alert|tls/i.test(lower)) {
    return "Could not reach research (secure connection failed). Try a demo, then try again in a minute.";
  }
  return msg || "Research failed";
}

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

/** Drop Gemini thinking parts so `{` in the chain-of-thought cannot break JSON. */
export function googleAnswerText(
  parts: { text?: string; thought?: boolean }[] | undefined,
): string {
  return (parts ?? [])
    .filter((p) => p.thought !== true)
    .map((p) => p.text ?? "")
    .join("");
}

async function googleGenerate(key: string, prompt: string, system = SYSTEM): Promise<string> {
  const url = `${GOOGLE_GENERATE}?key=${encodeURIComponent(key)}`;
  let payload: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.15,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4096 },
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
      throw new Error(friendlyResearchError(err));
    }
    if (res.ok) break;
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 900));
      continue;
    }
    if (res.status === 400 && attempt === 0 && /thinking/i.test(raw)) {
      payload = {
        ...payload,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      };
      continue;
    }
    throw new Error(friendlyGoogleError(res.status, raw));
  }
  if (!res || !res.ok) throw new Error(friendlyGoogleError(res?.status ?? 0, raw));

  let text = "";
  try {
    const body = JSON.parse(raw) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
      error?: { message?: string };
    };
    if (body.error?.message) throw new Error(friendlyGoogleError(res.status, body.error.message));
    if (body.promptFeedback?.blockReason) {
      throw new Error("Research blocked that prompt. Try a different song title.");
    }
    text = googleAnswerText(body.candidates?.[0]?.content?.parts);
  } catch (err) {
    if (err instanceof Error && /blocked|rejected|billing|Research/.test(err.message)) throw err;
    throw new Error("Could not read that answer. Try the song again.");
  }
  if (!text.trim()) throw new Error("Empty answer. Try again.");
  return text;
}

async function gatewayGenerate(token: string, prompt: string, system = SYSTEM): Promise<string> {
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
        temperature: 0.15,
        max_tokens: 8192,
        reasoning_effort: "medium",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
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

export async function geminiJson(prompt: string, opts?: { system?: string }): Promise<unknown> {
  const { google, gateway } = collectResearchKeys();
  if (!google && !gateway) {
    throw new Error("Song research isn't configured on this copy yet. Try a featured demo, or try again later.");
  }
  const system = opts?.system ?? SYSTEM;

  const errors: string[] = [];
  const tryGoogle = async () => {
    if (!google) return null;
    try {
      return extractJson(await googleGenerate(google, prompt, system));
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
      return extractJson(await gatewayGenerate(gateway, prompt, system));
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
  throw new Error(friendlyResearchError(errors[0] || BUSY));
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
