import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractJson } from "./preset-schema";

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-flash-lite-latest",
];

function friendlyError(status: number, body: string): string {
  const lower = body.toLowerCase();
  if (status === 400 && (lower.includes("api key") || lower.includes("invalid") || lower.includes("api_key"))) {
    return "That Gemini key was rejected. Check it in Google AI Studio.";
  }
  if (status === 403) {
    return "Gemini refused the key. Confirm the free API is enabled for this key.";
  }
  if (status === 429) {
    return "Gemini free-tier rate limit hit. Wait a minute, or open a song that's already in the library.";
  }
  return `Gemini error ${status}`;
}

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    msg === "failed to fetch" ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("cors")
  );
}

async function fetchGemini(apiKey: string, model: string, prompt: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28000);
  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
        signal: ctrl.signal,
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<unknown> {
  const key = apiKey.trim();
  if (!key) throw new Error("Add a free Gemini API key in Settings first.");

  let last = "Gemini request failed";
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetchGemini(key, model, prompt);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Gemini timed out. Try again.");
      }
      throw err;
    }
    if (res.status === 404) continue;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      last = friendlyError(res.status, text);
      if (res.status === 400 || res.status === 403 || res.status === 429) throw new Error(last);
      continue;
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned an empty answer. Try again.");
    return extractJson(text);
  }
  throw new Error(last);
}

const ProxyIn = z.object({
  apiKey: z.string().min(8).max(200),
  prompt: z.string().min(1).max(80000),
});

export const proxyGemini = createServerFn({ method: "POST" })
  .validator((input: unknown) => ProxyIn.parse(input))
  .handler(async ({ data }) => {
    try {
      const json = await callGemini(data.apiKey, data.prompt);
      return { ok: true as const, json };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Gemini failed",
      };
    }
  });

export async function geminiJson(apiKey: string, prompt: string): Promise<unknown> {
  try {
    return await callGemini(apiKey, prompt);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const proxied = await proxyGemini({ data: { apiKey: apiKey.trim(), prompt } });
    if (!proxied.ok) throw new Error(proxied.error);
    return proxied.json;
  }
}

export async function testGeminiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await geminiJson(apiKey, 'Return JSON {"ok":true}');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Key test failed" };
  }
}
