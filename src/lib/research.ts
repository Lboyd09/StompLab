import { compactCatalogForPrompt, MODEL_MAP } from "@/data/catalog";
import { FEATURED } from "@/data/featured";
import { DEVICE_MAP } from "@/data/categories";
import type { Preset, UserGear } from "@/data/types";
import {
  eqCacheKey,
  lookupCache,
  saveEqCache,
  saveSongCache,
  songCacheKey,
  soundCacheKey,
} from "./cache";
import { geminiJson } from "./gemini";
import {
  jsonSchemaHint,
  overlayUserGear,
  parsePresetJson,
  publicPreset,
  systemForDevice,
  toPreset,
} from "./preset-schema";
import { newId } from "./preset-utils";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchFeatured(
  song: string,
  artist: string | undefined,
  instrument: "guitar" | "bass",
  stompModel: "hx-stomp" | "hx-stomp-xl",
): Preset | null {
  const s = norm(song);
  const a = norm(artist ?? "");
  const hit = FEATURED.find((p) => {
    if (p.instrument !== instrument) return false;
    const ps = norm(p.song ?? "");
    const pa = norm(p.artist ?? "");
    if (ps === s) return !a || pa.includes(a) || a.includes(pa);
    return ps.includes(s) || s.includes(ps);
  });
  if (!hit) return null;
  return {
    ...hit,
    id: newId("pst"),
    createdAt: Date.now(),
    stompModel,
    footswitches:
      stompModel === "hx-stomp"
        ? hit.footswitches.filter((f) => f.index <= 3)
        : hit.footswitches,
  };
}

function gearLine(gear: UserGear[]): string {
  if (!gear.length) return "";
  return `\nPlayer owns (recommend these when they fit; do not invent extras): ${gear
    .map((g) => `${g.kind}: ${g.name}${g.notes ? ` (${g.notes})` : ""}`)
    .join("; ")}`;
}

export type ResearchOk = { ok: true; preset: Preset; source: "library" | "cache" | "gemini" };
export type ResearchErr = { ok: false; error: string; needKey?: boolean };
export type ResearchResult = ResearchOk | ResearchErr;

export async function researchSong(input: {
  song: string;
  artist?: string;
  instrument: "guitar" | "bass";
  stompModel: "hx-stomp" | "hx-stomp-xl";
  userGear: UserGear[];
  apiKey: string;
}): Promise<ResearchResult> {
  const featured = matchFeatured(input.song, input.artist, input.instrument, input.stompModel);
  if (featured) {
    return { ok: true, preset: overlayUserGear(featured, input.userGear), source: "library" };
  }

  const key = songCacheKey(input.song, input.artist, input.instrument, input.stompModel);
  try {
    const cached = await lookupCache({ data: { key } });
    if (cached.hit && cached.preset) {
      const preset: Preset = {
        ...cached.preset,
        id: newId("pst"),
        createdAt: Date.now(),
      };
      return { ok: true, preset: overlayUserGear(preset, input.userGear), source: "cache" };
    }
  } catch {
    // Cache miss / db not ready — continue to Gemini
  }

  if (!input.apiKey.trim()) {
    return {
      ok: false,
      needKey: true,
      error:
        "This song isn't in the shared library yet. Add a free Gemini API key in Settings — it stays in your browser and uses Google's free Gemini Flash tier.",
    };
  }

  try {
    const catalog = compactCatalogForPrompt(input.instrument);
    const prompt = `${systemForDevice(input.stompModel, input.instrument)}

Song: ${input.song}${input.artist ? ` by ${input.artist}` : ""}
Research the original recorded ${input.instrument} tone. Be specific about album, year, and the chain that was actually used. The HX path should sound like that record, not a generic genre patch.
${gearLine(input.userGear)}

Catalog (id | name | based on | dsp):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
    const json = await geminiJson(input.apiKey, prompt);
    const parsed = parsePresetJson(json);
    const preset = overlayUserGear(
      toPreset(parsed, {
        source: "song",
        instrument: input.instrument,
        stompModel: input.stompModel,
        song: input.song,
        artist: input.artist,
      }),
      input.userGear,
    );
    void saveSongCache({
      data: {
        key,
        song: input.song.trim(),
        artist: (input.artist ?? "").trim(),
        instrument: input.instrument,
        stompModel: input.stompModel,
        preset: publicPreset(preset),
      },
    }).catch(() => undefined);
    return { ok: true, preset, source: "gemini" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Research failed" };
  }
}

export async function createCustomSound(input: {
  description: string;
  instrument: "guitar" | "bass";
  stompModel: "hx-stomp" | "hx-stomp-xl";
  userGear: UserGear[];
  apiKey: string;
}): Promise<ResearchResult> {
  const key = soundCacheKey(input.description, input.instrument, input.stompModel);
  try {
    const cached = await lookupCache({ data: { key } });
    if (cached.hit && cached.preset) {
      const preset: Preset = { ...cached.preset, id: newId("pst"), createdAt: Date.now() };
      return { ok: true, preset: overlayUserGear(preset, input.userGear), source: "cache" };
    }
  } catch {
    // continue
  }

  if (!input.apiKey.trim()) {
    return {
      ok: false,
      needKey: true,
      error:
        "Add a free Gemini API key in Settings to describe a new sound. Cached sounds don't need a key.",
    };
  }

  try {
    const catalog = compactCatalogForPrompt(input.instrument);
    const prompt = `${systemForDevice(input.stompModel, input.instrument)}

Build this sound on the ${DEVICE_MAP[input.stompModel].name}:
${input.description}
${gearLine(input.userGear)}

Catalog (id | name | based on | dsp):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
    const json = await geminiJson(input.apiKey, prompt);
    const parsed = parsePresetJson(json);
    const preset = overlayUserGear(
      toPreset(parsed, {
        source: "custom",
        instrument: input.instrument,
        stompModel: input.stompModel,
      }),
      input.userGear,
    );
    void saveSongCache({
      data: {
        key,
        song: preset.name,
        artist: "custom",
        instrument: input.instrument,
        stompModel: input.stompModel,
        preset: publicPreset(preset),
      },
    }).catch(() => undefined);
    return { ok: true, preset, source: "gemini" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not build that sound" };
  }
}

export type EqMatch = { modelId: string; closeness: string; how: string };

export async function lookupEquivalent(input: {
  query: string;
  apiKey: string;
}): Promise<{ ok: true; matches: EqMatch[]; source: "local" | "cache" | "gemini" } | ResearchErr> {
  const key = eqCacheKey(input.query);
  try {
    const cached = await lookupCache({ data: { key } });
    if (cached.hit && Array.isArray(cached.matches)) {
      return { ok: true, matches: cached.matches as EqMatch[], source: "cache" };
    }
  } catch {
    // continue
  }

  if (!input.apiKey.trim()) {
    return {
      ok: false,
      needKey: true,
      error: "No shared match yet. Add a Gemini key in Settings to research this pedal.",
    };
  }

  try {
    const catalog = compactCatalogForPrompt();
    const json = (await geminiJson(
      input.apiKey,
      `Map this real pedal or amp to Line 6 HX models. Return ONLY JSON:
{"matches":[{"modelId":"","closeness":"exact|close|similar","how":"1-3 sentences"}]}
Use only catalog modelId values. 1-4 matches, best first. Say when Helix has no exact model and why the stand-in is closest.

Query: ${input.query}

Catalog:
${catalog}`,
    )) as { matches?: EqMatch[] };
    const matches = (json.matches ?? [])
      .filter((m) => MODEL_MAP[m.modelId])
      .slice(0, 4);
    void saveEqCache({ data: { key, query: input.query, matches } }).catch(() => undefined);
    return { ok: true, matches, source: "gemini" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Lookup failed" };
  }
}
