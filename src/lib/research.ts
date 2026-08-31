import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { compactCatalogForPrompt, MODEL_MAP } from "@/data/catalog";
import { FEATURED } from "@/data/featured";
import { DEVICE_MAP } from "@/data/categories";
import type { Preset, UserGear } from "@/data/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, loadPlan, recordBuild, recordFailure } from "@/lib/billing";
import { eqCacheKey, lookupCache, saveEqCache, saveSongCache, songCacheKey, soundCacheKey } from "./cache";
import { geminiJson } from "./gemini";
import {
  GearSchema,
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

export function matchFeatured(
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
export type ResearchErr = {
  ok: false;
  error: string;
  reason?: "signin" | "paywall" | "quota" | "busy";
};
export type ResearchResult = ResearchOk | ResearchErr;

const ResearchIn = z.object({
  song: z.string().min(1).max(120),
  artist: z.string().max(120).optional(),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: z.enum(["hx-stomp", "hx-stomp-xl"]),
  userGear: z.array(GearSchema).optional().default([]),
});

const CreateIn = z.object({
  description: z.string().min(4).max(800),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: z.enum(["hx-stomp", "hx-stomp-xl"]),
  userGear: z.array(GearSchema).optional().default([]),
});

const EqIn = z.object({ query: z.string().min(2).max(120) });

function blocked(reason: "paywall" | "quota"): ResearchErr {
  if (reason === "quota") {
    return {
      ok: false,
      reason: "quota",
      error: "You've used this month's 50 Gemini builds. Featured songs and cache hits still work. Resets next calendar month.",
    };
  }
  return {
    ok: false,
    reason: "paywall",
    error: "0 free songs left. Unlock StompLab to research any song.",
  };
}

async function runGeminiPreset(opts: {
  prompt: string;
  instrument: "guitar" | "bass";
  stompModel: "hx-stomp" | "hx-stomp-xl";
  source: "song" | "custom";
  song?: string;
  artist?: string;
  userGear: UserGear[];
}): Promise<Preset> {
  const json = await geminiJson(opts.prompt);
  const parsed = parsePresetJson(json);
  return overlayUserGear(
    toPreset(parsed, {
      source: opts.source,
      instrument: opts.instrument,
      stompModel: opts.stompModel,
      song: opts.song,
      artist: opts.artist,
    }),
    opts.userGear,
  );
}

export const researchSongFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ResearchIn.parse(input))
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    const featured = matchFeatured(data.song, data.artist, data.instrument, data.stompModel);
    if (featured) {
      return { ok: true, preset: overlayUserGear(featured, data.userGear), source: "library" };
    }

    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    const key = songCacheKey(data.song, data.artist, data.instrument, data.stompModel);

    if (plan.canSharedLibrary) {
      try {
        const cached = await lookupCache({ data: { key } });
        if (cached.hit && cached.preset) {
          const preset: Preset = { ...cached.preset, id: newId("pst"), createdAt: Date.now() };
          return { ok: true, preset: overlayUserGear(preset, data.userGear), source: "cache" };
        }
      } catch {
        /* miss */
      }
    }

    if (!plan.canResearch) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");

    try {
      const catalog = compactCatalogForPrompt(data.instrument);
      const prompt = `${systemForDevice(data.stompModel, data.instrument)}

Song: ${data.song}${data.artist ? ` by ${data.artist}` : ""}
Research the original recorded ${data.instrument} tone. Be specific about album, year, and the chain that was actually used. The HX path should sound like that record, not a generic genre patch.
${gearLine(data.userGear)}

Catalog (id | name | based on | dsp):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
      const preset = await runGeminiPreset({
        prompt,
        instrument: data.instrument,
        stompModel: data.stompModel,
        source: "song",
        song: data.song,
        artist: data.artist,
        userGear: data.userGear,
      });
      await recordBuild(context.userId, "song", data.song.trim());
      void saveSongCache({
        data: {
          key,
          song: data.song.trim(),
          artist: (data.artist ?? "").trim(),
          instrument: data.instrument,
          stompModel: data.stompModel,
          preset: publicPreset(preset),
        },
      }).catch(() => undefined);
      return { ok: true, preset, source: "gemini" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Research failed";
      await recordFailure(context.userId, data.song, data.artist ?? "", message);
      return {
        ok: false,
        error: message,
        reason: /busy|try again in a minute/i.test(message) ? "busy" : undefined,
      };
    }
  });

export const createCustomSoundFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => CreateIn.parse(input))
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    const key = soundCacheKey(data.description, data.instrument, data.stompModel);

    if (plan.canSharedLibrary) {
      try {
        const cached = await lookupCache({ data: { key } });
        if (cached.hit && cached.preset) {
          const preset: Preset = { ...cached.preset, id: newId("pst"), createdAt: Date.now() };
          return { ok: true, preset: overlayUserGear(preset, data.userGear), source: "cache" };
        }
      } catch {
        /* miss */
      }
    }

    if (!plan.canCreate) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");

    try {
      const catalog = compactCatalogForPrompt(data.instrument);
      const prompt = `${systemForDevice(data.stompModel, data.instrument)}

Build this sound on the ${DEVICE_MAP[data.stompModel].name}:
${data.description}
${gearLine(data.userGear)}

Catalog (id | name | based on | dsp):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
      const preset = await runGeminiPreset({
        prompt,
        instrument: data.instrument,
        stompModel: data.stompModel,
        source: "custom",
        userGear: data.userGear,
      });
      await recordBuild(context.userId, "create", preset.name);
      void saveSongCache({
        data: {
          key,
          song: preset.name,
          artist: "custom",
          instrument: data.instrument,
          stompModel: data.stompModel,
          preset: publicPreset(preset),
        },
      }).catch(() => undefined);
      return { ok: true, preset, source: "gemini" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not build that sound";
      await recordFailure(context.userId, data.description.slice(0, 80), "custom", message);
      return {
        ok: false,
        error: message,
        reason: /busy|try again in a minute/i.test(message) ? "busy" : undefined,
      };
    }
  });

export type EqMatch = { modelId: string; closeness: string; how: string };

export const lookupEquivalentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => EqIn.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; matches: EqMatch[]; source: "cache" | "gemini" } | ResearchErr> => {
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    const key = eqCacheKey(data.query);

    if (plan.canSharedLibrary) {
      try {
        const cached = await lookupCache({ data: { key } });
        if (cached.hit && Array.isArray(cached.matches) && cached.matches.length) {
          return { ok: true, matches: cached.matches as EqMatch[], source: "cache" };
        }
      } catch {
        /* miss */
      }
    }

    if (!plan.paid) {
      return {
        ok: false,
        reason: "paywall",
        error: "Catalog browse is free. Gemini pedal matching unlocks with StompLab.",
      };
    }

    try {
      const catalog = compactCatalogForPrompt();
      const json = (await geminiJson(
        `Map this real pedal or amp to Line 6 HX models. Return ONLY JSON:
{"matches":[{"modelId":"","closeness":"exact|close|similar","how":"1-3 sentences"}]}
Use only catalog modelId values. 1-4 matches, best first. Say when Helix has no exact model and why the stand-in is closest.

Query: ${data.query}

Catalog:
${catalog}`,
      )) as { matches?: EqMatch[] };
      const matches = (json.matches ?? []).filter((m) => MODEL_MAP[m.modelId]).slice(0, 4);
      void saveEqCache({ data: { key, query: data.query, matches } }).catch(() => undefined);
      return { ok: true, matches, source: "gemini" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lookup failed";
      return {
        ok: false,
        error: message,
        reason: /busy|try again in a minute/i.test(message) ? "busy" : undefined,
      };
    }
  });

/** @deprecated client wrappers — use the *Fn server functions */
export async function researchSong(): Promise<ResearchResult> {
  return { ok: false, error: "Research now runs on the server.", reason: "signin" };
}
export async function createCustomSound(): Promise<ResearchResult> {
  return { ok: false, error: "Create now runs on the server.", reason: "signin" };
}
export async function lookupEquivalent(): Promise<ResearchErr> {
  return { ok: false, error: "Lookup now runs on the server.", reason: "signin" };
}
