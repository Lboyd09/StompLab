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
  "8) arrangement by TONE not lyrics — walk the song section by section (intro, verse, chorus, bridge, solo, outro) and write down what the player's tone does in each: dirt on/off, pickup, guitar volume, delay/reverb amount, modulation. Sections that share a chain are one snapshot; a solo is its own snapshot only if the tone changes. One player's part, never two players mashed into one snapshot. Amp + cab stay ON in every snapshot. " +
  "9) time effects from the tempo: name the delay as a note value (dotted eighth, quarter) when it follows the beat, or in ms for a slapback; say how wet the delay and reverb sit in the mix. " +
  "10) THEN map each real piece to a catalog modelId, and copy published settings onto the matching knobs. " +
  "Session credits beat a simplified 'use a Twin' guide. Tracking rig beats a later tour rig. Guitar Chalk is good for tone language; credits win on gear. " +
  "Listener test: album in one ear, this preset in the other. " +
  "If the opening is clean, snapshot 1 is clean (dirt OFF, Drive 1.2–2.4). If a clean head is a pedal platform, use the clean channel — the pedal is the dirty channel. " +
  "Solos: kinky-boost switched on for the solo snapshot, not extra amp Drive and not only a Ch Vol nudge. Verse chorus/mod turns off for a dry anthem chorus unless the record left it on. " +
  "Saturating echo (Echorec, tape) goes before the amp. Singing muffs (Big Muff: Sustain, Tone, Level only — no Mid knob) keep Tone near 4–5. Tight chug = TS tightener + moderate amp Drive, not a wall.";
export const CUSTOM_SYSTEM =
  "You are a session tech. Invent one original Line 6 Helix-family preset from a player's description. This is a custom sound, not a song replica. Do not copy a famous player's documented rig or a similar recorded song unless they named that song. Reply with a single JSON object. No markdown.";

export function friendlyResearchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();
  if (/self-signed|certificate|unable_to_verify|cert_|ssl alert|tls/i.test(lower)) {
    return "Could not reach research (secure connection failed). Try a demo, then try again in a minute.";
  }
  if (/expected ','|expected ']'|unexpected token|position \d+|no json|syntaxerror|unterminated/i.test(lower)) {
    return "We couldn't read that preset. Try that song again.";
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

/** Short player copy for a failed model call. The provider's own text goes to the server log only. */
export const RESEARCH_UNAVAILABLE = "Research isn't available right now. Try a demo, then try again later.";

function friendlyGoogleError(status: number, raw: string): string {
  const lower = raw.toLowerCase();
  console.error("[research] model request failed", status, raw.slice(0, 300));
  if (isBusyStatus(status, raw) || /billing|credit|quota/i.test(lower)) return BUSY;
  return RESEARCH_UNAVAILABLE;
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

type GoogleOpts = {
  system?: string;
  schema?: unknown;
  /** Thinking tokens count toward maxOutputTokens on 2.5, so the cap leaves room for the answer. */
  thinkingBudget?: number;
  maxOutputTokens?: number;
  /** Google Search grounding. 2.5 Flash cannot combine it with a JSON response, so it is text only. */
  search?: boolean;
  timeoutMs?: number;
};

function googleBody(prompt: string, system: string, opts: GoogleOpts, plain = false): string {
  const json = !opts.search;
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    ...(opts.search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: opts.maxOutputTokens ?? 16384,
      ...(json ? { responseMimeType: "application/json" } : {}),
      ...(json && opts.schema && !plain ? { responseSchema: opts.schema } : {}),
      ...(plain ? {} : { thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 4096 } }),
    },
  });
}

async function googleGenerate(key: string, prompt: string, system = SYSTEM, opts: GoogleOpts = {}): Promise<string> {
  // The key goes in the x-goog-api-key header only, never in the URL (URLs get logged).
  const url = GOOGLE_GENERATE;
  const headers = { "Content-Type": "application/json", "x-goog-api-key": key };
  let payload: RequestInit = { method: "POST", headers, body: googleBody(prompt, system, opts) };

  let res: Response | null = null;
  let raw = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchWithTimeout(url, payload, opts.timeoutMs ?? GENERATE_MS);
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
    if (res.status === 400 && attempt === 0 && /thinking|schema|response_schema/i.test(raw)) {
      // A rejected schema or thinking config: ask again as plain JSON so the build still lands.
      console.error("[research] request config rejected, retrying without schema", raw.slice(0, 300));
      payload = { ...payload, body: googleBody(prompt, system, opts, true) };
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
    if (err instanceof Error && /blocked|Research|busy/i.test(err.message)) throw err;
    throw new Error("Could not read that answer. Try the song again.");
  }
  if (!text.trim()) throw new Error("Empty answer. Try again.");
  return text;
}

/**
 * Step 1 of a song build: a Google-Search-grounded look at the record (gear,
 * settings, sections, tempo, tuning). Plain text, because 2.5 Flash cannot
 * ground and return a JSON schema in one call. Google key only; the gateway has
 * no search. Never throws: no notes just means the preset call works from memory.
 */
export async function geminiGroundedNotes(prompt: string, system: string, timeoutMs = 30000): Promise<string | null> {
  const { google } = collectResearchKeys();
  if (!google) return null;
  try {
    const text = await googleGenerate(google, prompt, system, {
      search: true,
      thinkingBudget: 1024,
      maxOutputTokens: 6144,
      timeoutMs,
    });
    return text.trim() || null;
  } catch (err) {
    console.error("[research] grounded notes skipped", err instanceof Error ? err.message : "failed");
    return null;
  }
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
        max_tokens: 16384,
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
    console.error("[research] gateway request failed", res.status, message.slice(0, 300));
    throw new Error(RESEARCH_UNAVAILABLE);
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

/**
 * Knob lists are arrays of {name, value}. Gemini's response schema cannot hold
 * an open object: an OBJECT with no properties is rejected (and the call fell
 * back to no schema) or comes back empty. parsePresetJson accepts this shape
 * and the older {Knob: value} map.
 */
const KNOBS = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: { name: { type: "STRING" }, value: { type: "NUMBER" } },
    required: ["name", "value"],
    propertyOrdering: ["name", "value"],
  },
};

const STRINGS = { type: "ARRAY", items: { type: "STRING" } };

/** Research fields come first, so the model commits to the record before any modelId. */
export const PRESET_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    error: { type: "STRING" },
    guitarist: { type: "STRING" },
    tuning: { type: "STRING" },
    tempo: { type: "NUMBER" },
    originalGear: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          role: { type: "STRING" },
          name: { type: "STRING" },
          notes: { type: "STRING" },
        },
        required: ["role", "name", "notes"],
        propertyOrdering: ["role", "name", "notes"],
      },
    },
    fingerprint: { type: "STRING" },
    summary: { type: "STRING" },
    name: { type: "STRING" },
    blocks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          modelId: { type: "STRING" },
          enabled: { type: "BOOLEAN" },
          params: KNOBS,
        },
        required: ["modelId", "enabled", "params"],
        propertyOrdering: ["modelId", "enabled", "params"],
      },
    },
    snapshots: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          sections: { type: "STRING" },
          changes: { type: "STRING" },
          color: { type: "STRING" },
          enabledModelIds: STRINGS,
          paramOverrides: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { modelId: { type: "STRING" }, params: KNOBS },
              required: ["modelId", "params"],
              propertyOrdering: ["modelId", "params"],
            },
          },
        },
        required: ["name", "sections", "changes", "enabledModelIds"],
        propertyOrdering: ["name", "sections", "changes", "color", "enabledModelIds", "paramOverrides"],
      },
    },
    footswitches: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          label: { type: "STRING" },
          color: { type: "STRING" },
          action: {
            type: "STRING",
            enum: ["bypass", "snapshot", "tap", "tuner", "looper", "preset-up", "preset-down", "mode"],
          },
          snapshotName: { type: "STRING" },
          targetModelId: { type: "STRING" },
        },
        required: ["index", "label", "action"],
        propertyOrdering: ["index", "label", "color", "action", "snapshotName", "targetModelId"],
      },
    },
    programming: STRINGS,
    tips: STRINGS,
  },
  required: ["name", "tempo", "tuning", "guitarist", "originalGear", "fingerprint", "summary", "blocks", "snapshots", "footswitches", "tips"],
  propertyOrdering: [
    "error",
    "guitarist",
    "tuning",
    "tempo",
    "originalGear",
    "fingerprint",
    "summary",
    "name",
    "blocks",
    "snapshots",
    "footswitches",
    "programming",
    "tips",
  ],
};

export const BPM_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: { bpm: { type: "NUMBER" } },
  required: ["bpm"],
};

export async function geminiJson(
  prompt: string,
  opts?: { system?: string; schema?: unknown; thinkingBudget?: number; maxOutputTokens?: number },
): Promise<unknown> {
  const { google, gateway } = collectResearchKeys();
  if (!google && !gateway) {
    throw new Error("Song research isn't configured on this copy yet. Try a featured demo, or try again later.");
  }
  const system = opts?.system ?? SYSTEM;
  const gOpts: GoogleOpts = {
    schema: opts?.schema,
    thinkingBudget: opts?.thinkingBudget,
    maxOutputTokens: opts?.maxOutputTokens,
  };

  const errors: string[] = [];
  const read = async (text: string, repair: () => Promise<string>): Promise<unknown | null> => {
    try {
      return extractJson(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!/expected|json|position|unexpected|unterminated/i.test(msg)) {
        errors.push(friendlyResearchError(err));
        return null;
      }
      try {
        return extractJson(await repair());
      } catch (again) {
        errors.push(friendlyResearchError(again));
        return null;
      }
    }
  };
  const tryGoogle = async (userPrompt: string) => {
    if (!google) return null;
    try {
      const text = await googleGenerate(google, userPrompt, system, gOpts);
      return await read(text, () =>
        googleGenerate(
          google,
          `${userPrompt}\n\nThe previous answer was not valid JSON. Reply with one JSON object only.`,
          system,
          gOpts,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google research failed.";
      if (err instanceof Error && err.name === "AbortError") throw new Error(BUSY);
      errors.push(friendlyResearchError(msg));
      return null;
    }
  };
  const tryGateway = async (userPrompt: string) => {
    if (!gateway) return null;
    try {
      const text = await gatewayGenerate(gateway, userPrompt, system);
      return await read(text, () =>
        gatewayGenerate(
          gateway,
          `${userPrompt}\n\nThe previous answer was not valid JSON. Reply with one JSON object only.`,
          system,
        ),
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw new Error(BUSY);
      errors.push(friendlyResearchError(err));
      return null;
    }
  };

  const first = google ? await tryGoogle(prompt) : await tryGateway(prompt);
  if (first) return first;
  const second = google ? await tryGateway(prompt) : await tryGoogle(prompt);
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
