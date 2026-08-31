import { extractJson } from "./preset-schema";

/**
 * Gemini 2.5 Flash only, via Vercel AI Gateway.
 * Key lives on the server (AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN).
 * Never fall back to 3.x or any other model.
 */
const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";
const GENERATE_MS = 28000;
const BUSY = "Research is busy. Try again in a minute.";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function gatewayToken(): string {
  return (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    ""
  );
}

export function geminiConfigured() {
  return Boolean(gatewayToken());
}

function isBusyStatus(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    /quota|overloaded|too many|high demand|unavailable|resource_exhausted|try again later|rate limit/.test(
      lower,
    )
  );
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

export async function geminiJson(prompt: string): Promise<unknown> {
  const token = gatewayToken();
  if (!token) {
    throw new Error("Song research isn't configured on this copy yet. Try a featured demo, or try again later.");
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      GATEWAY,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          max_tokens: 8192,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a session tech programming Line 6 HX Stomp presets. Reply with a single JSON object. No markdown.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
      GENERATE_MS,
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(BUSY);
    }
    throw new Error(BUSY);
  }

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

  let content = "";
  try {
    const body = JSON.parse(raw) as {
      choices?: { message?: { content?: string } }[];
    };
    content = body.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new Error("Could not read that answer. Try the song again.");
  }
  if (!content.trim()) throw new Error("Empty answer. Try again.");
  try {
    return extractJson(content);
  } catch {
    throw new Error("Could not read that preset. Try the song again.");
  }
}

/** @deprecated visitor keys are gone — kept so old imports compile until call sites move */
export async function testGeminiKey(_key: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: false, error: "Visitor API keys are no longer used." };
}
