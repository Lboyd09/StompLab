import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { compactCatalogForPrompt, MODEL_MAP } from "@/data/catalog";
import { FEATURED } from "@/data/featured";
import { DEVICE_MAP } from "@/data/categories";
import type { PlaybackTarget, Preset, StompModelId, UserGear } from "@/data/types";
import { STOMP_MODEL_IDS } from "@/data/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, loadPlan, recordBuild, recordFailure } from "@/lib/billing";
import { getSql } from "@/lib/db";
import { lookupCacheRaw, persistSongCache, saveEqCache, songCacheKey, soundCacheKey, eqCacheKey } from "./cache";
import { standingRulesBlock } from "./research-lessons";
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
import { isDemoId, newId, withStompModel } from "./preset-utils";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findFeaturedSource(
  song: string,
  artist: string | undefined,
  instrument: "guitar" | "bass",
): (typeof FEATURED)[number] | undefined {
  const s = norm(song);
  const a = norm(artist ?? "");
  return FEATURED.find((p) => {
    if (p.instrument !== instrument) return false;
    const ps = norm(p.song ?? "");
    const pa = norm(p.artist ?? "");
    if (ps === s) return !a || pa.includes(a) || a.includes(pa);
    if (s.length < 5) return false;
    return ps.includes(s) || (s.includes(ps) && ps.length >= 5);
  });
}

export function matchFeatured(
  song: string,
  artist: string | undefined,
  instrument: "guitar" | "bass",
  stompModel: StompModelId,
): Preset | null {
  const hit = findFeaturedSource(song, artist, instrument);
  if (!hit) return null;
  return withStompModel({ ...hit, id: newId("pst"), createdAt: Date.now() }, stompModel);
}

function gearLine(gear: UserGear[]): string {
  if (!gear.length) return "";
  return `\nPlayer owns (recommend these when they fit; do not invent extras): ${gear
    .map((g) => `${g.kind}: ${g.name}${g.notes ? ` (${g.notes})` : ""}`)
    .join("; ")}`;
}

async function standingFeedbackLessons(): Promise<string> {
  try {
    const sql = await getSql();
    const rows = await sql<{ closer_tweaks: string; want_preset: string; message: string; rating: number | null }>`
      select closer_tweaks, want_preset, message, rating
      from feedback
      where kind in ('preset', 'revise', 'site')
      order by created_at desc
      limit 40
    `;
    const bits: string[] = [];
    for (const r of rows) {
      const tweak = (r.closer_tweaks || "").trim();
      const want = (r.want_preset || "").trim();
      const msg = (r.message || "").trim();
      if (typeof r.rating === "number" && r.rating <= 2 && want.length >= 8) bits.push(want);
      else if (tweak.length >= 8) bits.push(tweak);
      else if (want.length >= 8) bits.push(want);
      else if (msg.length >= 12) bits.push(msg);
    }
    return standingRulesBlock(bits);
  } catch {
    return standingRulesBlock([]);
  }
}

export type ResearchOk = { ok: true; preset: Preset; source: "library" | "gemini" };
export type ResearchErr = {
  ok: false;
  error: string;
  reason?: "signin" | "paywall" | "quota" | "busy";
};
export type ResearchResult = ResearchOk | ResearchErr;

const DeviceEnum = z.enum(STOMP_MODEL_IDS);
const PlaybackEnum = z.enum(["frfr", "guitar-amp", "headphones", "pa", "monitors"]);

const ResearchIn = z.object({
  song: z.string().min(1).max(120),
  artist: z.string().max(120).optional(),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: DeviceEnum,
  playbackTarget: PlaybackEnum.optional().default("frfr"),
  userGear: z.array(GearSchema).optional().default([]),
});

const CreateIn = z.object({
  description: z.string().min(4).max(800),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: DeviceEnum,
  playbackTarget: PlaybackEnum.optional().default("frfr"),
  userGear: z.array(GearSchema).optional().default([]),
});

const EqIn = z.object({ query: z.string().min(2).max(120) });

function blocked(reason: "paywall" | "quota"): ResearchErr {
  if (reason === "quota") {
    return {
      ok: false,
      reason: "quota",
      error: "You've used this month's 50 custom builds. Featured demos still work. Resets next calendar month.",
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
  stompModel: StompModelId;
  playbackTarget?: PlaybackTarget;
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
      playbackTarget: opts.playbackTarget,
    }),
    opts.userGear,
  );
}

export const researchSongFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ResearchIn.parse(input))
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    const featuredSrc = findFeaturedSource(data.song, data.artist, data.instrument);
    if (featuredSrc && isDemoId(featuredSrc.id)) {
      const featured = withStompModel(
        { ...featuredSrc, id: newId("pst"), createdAt: Date.now() },
        data.stompModel,
      );
      return { ok: true, preset: overlayUserGear(featured, data.userGear), source: "library" };
    }

    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);

    if (featuredSrc && plan.paid) {
      const featured = withStompModel(
        { ...featuredSrc, id: newId("pst"), createdAt: Date.now() },
        data.stompModel,
      );
      return { ok: true, preset: overlayUserGear(featured, data.userGear), source: "library" };
    }

    const key = songCacheKey(
      data.song,
      data.artist,
      data.instrument,
      data.stompModel,
      data.playbackTarget,
    );

    if (!plan.canResearch) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");

    try {
      const cached = await lookupCacheRaw(key);
      if (cached.hit && cached.preset) {
        const preset: Preset = { ...cached.preset, id: newId("pst"), createdAt: Date.now() };
        await recordBuild(context.userId, "song", data.song.trim());
        return { ok: true, preset: overlayUserGear(preset, data.userGear), source: "gemini" };
      }
    } catch {
      /* miss */
    }

    try {
      const catalog = compactCatalogForPrompt(data.instrument, data.stompModel);
      const lessons = await standingFeedbackLessons();
      const prompt = `${systemForDevice(data.stompModel, data.instrument, data.playbackTarget)}
${lessons}

Song: ${data.song}${data.artist ? ` by ${data.artist}` : ""}
Research the original recorded ${data.instrument} tone before you pick a single model:
1. Exact recording (album, year, studio vs live, which player if a band).
2. Guitar + pickups + selector + volume/tone as played on that track.
3. Amp head, channel, and documented settings if they exist.
4. Pedal order as used on that session — not a generic chain.
5. Cab + speakers + mic + distance.
6. Technique: pick vs fingers, attack, palm mute, volume-knob clean-up.
Only then map each real piece to a catalog modelId. If sources disagree, prefer the tracking/studio rig over a later live rig.
Map the arrangement: intro, verse, chorus, SOLO, outro, and any signature trick. Each distinctive part is its own snapshot with a different tone — a solo is almost never the rhythm tone.
${gearLine(data.userGear)}

Catalog (id|basedOn):
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
        playbackTarget: data.playbackTarget,
        userGear: data.userGear,
      });
      await recordBuild(context.userId, "song", data.song.trim());
      await persistSongCache({
        key,
        song: data.song.trim(),
        artist: (data.artist ?? "").trim(),
        instrument: data.instrument,
        stompModel: data.stompModel,
        preset: publicPreset(preset),
      });
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
    const key = soundCacheKey(data.description, data.instrument, data.stompModel, data.playbackTarget);

    if (!plan.canCreate) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");

    try {
      const cached = await lookupCacheRaw(key);
      if (cached.hit && cached.preset) {
        const preset: Preset = { ...cached.preset, id: newId("pst"), createdAt: Date.now() };
        await recordBuild(context.userId, "create", data.description.slice(0, 80));
        return { ok: true, preset: overlayUserGear(preset, data.userGear), source: "gemini" };
      }
    } catch {
      /* miss */
    }

    try {
      const catalog = compactCatalogForPrompt(data.instrument, data.stompModel);
      const lessons = await standingFeedbackLessons();
      const prompt = `${systemForDevice(data.stompModel, data.instrument, data.playbackTarget)}
${lessons}

Build this sound on the ${DEVICE_MAP[data.stompModel].name}:
${data.description}
${gearLine(data.userGear)}

Catalog (id|basedOn):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
      const preset = await runGeminiPreset({
        prompt,
        instrument: data.instrument,
        stompModel: data.stompModel,
        source: "custom",
        playbackTarget: data.playbackTarget,
        userGear: data.userGear,
      });
      await recordBuild(context.userId, "create", preset.name);
      await persistSongCache({
        key,
        song: preset.name,
        artist: "custom",
        instrument: data.instrument,
        stompModel: data.stompModel,
        preset: publicPreset(preset),
      });
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
  .handler(async ({ context, data }): Promise<{ ok: true; matches: EqMatch[]; source: "gemini" } | ResearchErr> => {
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    const key = eqCacheKey(data.query);

    if (!plan.paid) {
      return {
        ok: false,
        reason: "paywall",
        error: "Catalog browse is free. Pedal matching unlocks with StompLab.",
      };
    }

    try {
      const cached = await lookupCacheRaw(key);
      if (cached.hit && Array.isArray(cached.matches) && cached.matches.length) {
        return { ok: true, matches: cached.matches as EqMatch[], source: "gemini" };
      }
    } catch {
      /* miss */
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

const ReviseIn = z.object({
  song: z.string().min(1).max(120),
  artist: z.string().max(120).optional(),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: DeviceEnum,
  playbackTarget: PlaybackEnum.optional().default("frfr"),
  note: z.string().min(2).max(240),
  current: z.string().max(2000),
  userGear: z.array(GearSchema).optional().default([]),
});

export const revisePresetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => ReviseIn.parse(input))
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    if (!plan.canResearch) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");
    try {
      const catalog = compactCatalogForPrompt(data.instrument, data.stompModel);
      const lessons = await standingFeedbackLessons();
      const prompt = `${systemForDevice(data.stompModel, data.instrument, data.playbackTarget)}
${lessons}

Revise this ${DEVICE_MAP[data.stompModel].name} path. Keep factory model ids. Only change what the note asks.

Song: ${data.song}${data.artist ? ` by ${data.artist}` : ""}
Current path: ${data.current}
Note from the player: ${data.note}
${gearLine(data.userGear)}

Catalog (id|basedOn):
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
        playbackTarget: data.playbackTarget,
        userGear: data.userGear,
      });
      await recordBuild(context.userId, "revise", data.song.trim());
      return { ok: true, preset, source: "gemini" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not revise that sound";
      await recordFailure(context.userId, data.song, data.artist ?? "", message);
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
