import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { compactCatalogForPrompt, MODEL_MAP } from "@/data/catalog";
import { FEATURED } from "@/data/featured";
import { DEVICE_MAP } from "@/data/categories";
import type { PlaybackTarget, Preset, StompModelId, UserGear } from "@/data/types";
import { PLAYBACK_TARGET_IDS, STOMP_MODEL_IDS } from "@/data/types";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  confirmBuildSlot,
  emailFor,
  isEmailVerified,
  loadPlan,
  loadPlanStrict,
  recordFailure,
  releaseBuildSlot,
  reserveBuildSlot,
} from "@/lib/billing";
import type { Plan } from "./plan";
import { getSql } from "@/lib/db";
import { lookupCacheRaw, persistEqCache, persistSongCache, saveCacheBpm, songCacheKey, soundCacheKey, eqCacheKey, lookupSongCache, lookupNotesCache, notesCacheKey, persistNotesCache } from "./cache";
import { libraryServesFeatured, parseGuitarRole, songBuildRole, type GuitarRole } from "./guitar-role";
import { sanitizeSnapshots } from "./snapshot-sanitize";
import { standingRulesBlock } from "./research-lessons";
import { friendlyResearchError, geminiGroundedNotes, geminiJson, CUSTOM_SYSTEM, SYSTEM, PRESET_RESPONSE_SCHEMA, BPM_RESPONSE_SCHEMA } from "./gemini";
import { confirmReleasedSong, SONG_NOT_FOUND } from "./song-verify";
import { VERIFY_EMAIL_LINE } from "./copy";
import { keepDirtyIntro, finishTone } from "./tone-finish";
import { applyRouting } from "./rig-routing";
import {
  GearSchema,
  jsonSchemaHint,
  jsonSchemaHintCustom,
  overlayUserGear,
  parsePresetJson,
  parseRecordNotes,
  RECORD_NOTES_SYSTEM,
  recordNotesPrompt,
  publicPreset,
  songResearchInstructions,
  customSoundInstructions,
  systemForDevice,
  systemForCustomSound,
  toPreset,
} from "./preset-schema";
import { isDemoId, newId, withStompModel } from "./preset-utils";
import { applyWahPreference, parseWahMode, parseWahModelId, wahPromptLine } from "./wah";

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
    // A title that only contains (or is contained in) a demo title is a different
    // song unless the artist matches too: "Sandman" by America is not Metallica,
    // and "Higher Love" is not Creed's "Higher". No artist, no loose match.
    if (!a || !pa) return false;
    if (!(pa.includes(a) || a.includes(pa))) return false;
    return ps.includes(s) || (s.includes(ps) && ps.length >= 5);
  });
}

export function matchFeatured(
  song: string,
  artist: string | undefined,
  instrument: "guitar" | "bass",
  stompModel: StompModelId,
  /** Ignored: a featured preset is served whole, whatever part was picked. */
  _guitarRole?: GuitarRole,
): Preset | null {
  const hit = findFeaturedSource(song, artist, instrument);
  if (!hit) return null;
  return withStompModel({ ...hit, id: newId("pst"), createdAt: Date.now() }, stompModel);
}

const GEAR_KINDS = new Set(["guitar", "bass", "amp", "cab", "pedal", "pickup"]);
const MAX_GEAR_ITEMS = 12;
const MAX_GEAR_TEXT = 80;

/** One short plain line: no control characters, no line breaks, capped. */
export function oneLine(value: unknown, max: number): string {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * The player's gear goes into the prompt, so it is trimmed here: at most 12
 * items, 80 characters a field, one line each. GearSchema (preset-schema.ts)
 * stays as it is.
 */
export function cleanUserGear(gear: UserGear[] | undefined): UserGear[] {
  const out: UserGear[] = [];
  for (const g of gear ?? []) {
    if (out.length >= MAX_GEAR_ITEMS) break;
    if (!g || !GEAR_KINDS.has(g.kind)) continue;
    const name = oneLine(g.name, MAX_GEAR_TEXT);
    if (!name) continue;
    out.push({ id: oneLine(g.id, 40), kind: g.kind, name, notes: oneLine(g.notes, MAX_GEAR_TEXT) });
  }
  return out;
}

function gearLine(gear: UserGear[]): string {
  if (!gear.length) return "";
  return `\nPlayer locker — name these in recommendedGear when they fit, and tell the player which piece to grab: ${gear
    .map((g) => `${g.kind}: ${g.name}${g.notes ? ` (${g.notes})` : ""}`)
    .join("; ")}
Voice every knob for the RECORD's guitar, not the locker's: the app adjusts drive and treble for the player's pickups afterwards.`;
}

export async function standingFeedbackLessons(): Promise<string> {
  const g = globalThis as typeof globalThis & {
    __stompLessonsAt__?: number;
    __stompLessons__?: string;
  };
  if (g.__stompLessons__ && Date.now() - (g.__stompLessonsAt__ ?? 0) < 10 * 60_000) {
    return g.__stompLessons__;
  }
  try {
    const sql = await getSql();
    const rows = await sql<{ closer_tweaks: string; want_preset: string; message: string; rating: number | null }>`
      select closer_tweaks, want_preset, message, rating
      from feedback
      where kind in ('preset', 'revise', 'site')
        and approved_at is not null
      order by approved_at desc
      limit 24
    `;
    const bits: string[] = [];
    for (const r of rows) {
      // Approved by an admin, and still capped before it reaches a prompt.
      const tweak = oneLine(r.closer_tweaks, 240);
      const want = oneLine(r.want_preset, 240);
      const msg = oneLine(r.message, 240);
      if (typeof r.rating === "number" && r.rating <= 2 && want.length >= 8) bits.push(want);
      else if (tweak.length >= 8) bits.push(tweak);
      else if (want.length >= 8) bits.push(want);
      else if (msg.length >= 12) bits.push(msg);
    }
    const extra = standingRulesBlock(bits);
    g.__stompLessons__ = extra;
    g.__stompLessonsAt__ = Date.now();
    return extra;
  } catch {
    const extra = standingRulesBlock([]);
    g.__stompLessons__ = extra;
    g.__stompLessonsAt__ = Date.now();
    return extra;
  }
}

const researchHits = new Map<string, number[]>();
function tooManyResearches(userId: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const prev = (researchHits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= 8) {
    researchHits.set(userId, prev);
    return true;
  }
  prev.push(now);
  researchHits.set(userId, prev);
  return false;
}

export type ResearchOk = { ok: true; preset: Preset; source: "library" | "gemini" | "cache" };
export type ResearchErr = {
  ok: false;
  error: string;
  reason?: "signin" | "paywall" | "quota" | "busy" | "verify";
};
export type ResearchResult = ResearchOk | ResearchErr;

const DeviceEnum = z.enum(STOMP_MODEL_IDS);
const PlaybackEnum = z.enum(PLAYBACK_TARGET_IDS);

const ResearchIn = z.object({
  song: z.string().min(1).max(200),
  artist: z.string().max(120).optional(),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: DeviceEnum,
  playbackTarget: PlaybackEnum.optional().default("frfr"),
  userGear: z.array(GearSchema).max(40).optional().default([]),
  wahMode: z.enum(["pedal", "exp", "fs"]).optional().default("pedal"),
  wahModelId: z.string().max(40).optional().default("teardrop-310"),
  // Ignored (always the lead part). Tolerated so an older client still validates.
  guitarRole: z.string().max(20).optional(),
});

function cleanResearchInput(d: z.infer<typeof ResearchIn>) {
  return {
    ...d,
    song: oneLine(d.song, 200),
    artist: d.artist === undefined ? undefined : oneLine(d.artist, 120),
    userGear: cleanUserGear(d.userGear),
  };
}

const CreateIn = z.object({
  description: z.string().min(4).max(800),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: DeviceEnum,
  playbackTarget: PlaybackEnum.optional().default("frfr"),
  userGear: z.array(GearSchema).max(40).optional().default([]),
  wahMode: z.enum(["pedal", "exp", "fs"]).optional().default("pedal"),
  wahModelId: z.string().max(40).optional().default("teardrop-310"),
  guitarRole: z.enum(["rhythm", "lead", "both"]).optional().default("both"),
  playerName: z.string().max(80).optional().default(""),
});

function cleanCreateInput(d: z.infer<typeof CreateIn>) {
  return {
    ...d,
    description: oneLine(d.description, 800),
    playerName: oneLine(d.playerName, 80),
    userGear: cleanUserGear(d.userGear),
  };
}

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
    error: "0 free custom builds left. Subscribe for 50 custom builds a month. Demos stay free.",
  };
}

async function runGeminiPreset(opts: {
  prompt: string;
  system?: string;
  instrument: "guitar" | "bass";
  stompModel: StompModelId;
  playbackTarget?: PlaybackTarget;
  source: "song" | "custom";
  song?: string;
  artist?: string;
  userGear: UserGear[];
}): Promise<Preset> {
  const json = await geminiJson(opts.prompt, {
    ...(opts.system ? { system: opts.system } : {}),
    schema: PRESET_RESPONSE_SCHEMA,
  });
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

type FinishOpts = {
  userGear: UserGear[];
  wahMode?: string;
  wahModelId?: string;
  playbackTarget?: PlaybackTarget;
};

/**
 * Wah + gear overlay + finishTone, then the player's rig routing (SL-62) on every path — library,
 * cache (a fallback row may be from another playback target), and a fresh build — then sanitize.
 */
function finishPreset(preset: Preset, opts: FinishOpts, bpm?: number | null): Preset {
  const toned = finishTone(
    applyWahPreference(
      overlayUserGear(preset, opts.userGear),
      parseWahMode(opts.wahMode),
      parseWahModelId(opts.wahModelId),
    ),
    bpm,
    { userGear: opts.userGear },
  );
  return sanitizeSnapshots(applyRouting(toned, opts.playbackTarget ?? "frfr"));
}

/** Step 1 of a song build. Never throws; empty notes when search is unavailable. */
async function researchRecord(
  song: string,
  artist: string,
  album: string,
  instrument: "guitar" | "bass",
  role: GuitarRole,
): Promise<{ notes: string; bpm: number | null }> {
  const key = notesCacheKey(song, artist, instrument, role);
  const cached = await lookupNotesCache(key);
  if (cached) return cached;
  const text = await geminiGroundedNotes(recordNotesPrompt(song, artist, album, instrument, role), RECORD_NOTES_SYSTEM);
  const parsed = parseRecordNotes(text);
  void persistNotesCache(key, { song, artist, instrument, notes: parsed.notes, bpm: parsed.bpm });
  return parsed;
}

async function lookupBpm(song: string, artist: string, album: string): Promise<number | null> {
  try {
    const json = (await geminiJson(
      `Studio tempo in BPM for the original recording of "${song}" by ${artist}${album ? ` on ${album}` : ""}. Reply {"bpm": <integer>}. Use the album tempo, not a live version. If you are not sure, reply {"bpm": 0}. Never answer 120 unless the song is actually about 120.`,
      { system: "Reply with one JSON object and nothing else.", schema: BPM_RESPONSE_SCHEMA, thinkingBudget: 512, maxOutputTokens: 2048 },
    )) as { bpm?: number };
    const bpm = Number(json?.bpm);
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240) return null;
    return Math.round(bpm);
  } catch {
    return null;
  }
}

function verifyEmailError(): ResearchErr {
  return { ok: false, reason: "verify", error: VERIFY_EMAIL_LINE };
}

function planUnavailable(): ResearchErr {
  return {
    ok: false,
    reason: "busy",
    error: "We couldn't check your builds just now. Try again in a minute.",
  };
}

function slotFailure(reason: "paywall" | "quota" | "unavailable"): ResearchErr {
  return reason === "unavailable" ? planUnavailable() : blocked(reason);
}

/**
 * Custom builds need a confirmed email, so a throwaway address cannot farm the
 * free builds. Paying players (and the admin) skip the check: they paid.
 */
async function needsEmailConfirmation(userId: string, plan: Plan): Promise<boolean> {
  if (plan.paid || plan.admin) return false;
  return !(await isEmailVerified(userId));
}

export const researchSongFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => cleanResearchInput(ResearchIn.parse(input)))
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    // guitarRole from the client is ignored: a song build is always the lead part.
    const featuredSrc = findFeaturedSource(data.song, data.artist, data.instrument);
    const email = await emailFor(context.userId, context.email);
    const screenPlan = await loadPlan(context.userId, email);

    if (featuredSrc && libraryServesFeatured(isDemoId(featuredSrc.id), screenPlan.paid)) {
      const featured = withStompModel(
        { ...featuredSrc, id: newId("pst"), createdAt: Date.now() },
        data.stompModel,
      );
      return { ok: true, preset: finishPreset(featured, data), source: "library" };
    }

    // From here on a build costs money, so the plan must be readable. Fail closed.
    let plan: Plan;
    try {
      plan = await loadPlanStrict(context.userId, email);
    } catch {
      return planUnavailable();
    }
    if (!plan.canResearch) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");
    if (await needsEmailConfirmation(context.userId, plan)) return verifyEmailError();
    if (tooManyResearches(context.userId)) {
      return { ok: false, reason: "busy", error: "Too many custom builds in a minute. Wait a bit, then try again." };
    }

    const confirmed = await confirmReleasedSong(data.song, data.artist);
    if (!confirmed) {
      return { ok: false, error: SONG_NOT_FOUND };
    }
    const role = songBuildRole(data.instrument, confirmed.song, confirmed.artist);
    const key = songCacheKey(
      confirmed.song,
      confirmed.artist,
      data.instrument,
      data.stompModel,
      data.playbackTarget,
      data.wahMode,
      role,
    );

    // A cache hit was confirmed when it was cached, so it skips the tempo lookup
    // and the model. It is still a build and still counts.
    try {
      const cached = await lookupSongCache({
        song: confirmed.song,
        artist: confirmed.artist,
        instrument: data.instrument,
        stompModel: data.stompModel,
        playbackTarget: data.playbackTarget,
        wahMode: data.wahMode,
        guitarRole: role,
      });
      if (cached.hit && cached.preset) {
        const slot = await reserveBuildSlot({
          userId: context.userId,
          email,
          plan,
          kind: "song",
          song: confirmed.song,
          confirmed: true,
        });
        if (!slot.ok) return slotFailure(slot.reason);
        let bpm = cached.bpm;
        if (!bpm) {
          // Rows cached before tempo was stored: ask once, then keep the answer.
          bpm = await lookupBpm(confirmed.song, confirmed.artist, confirmed.album);
          if (bpm) void saveCacheBpm(cached.key, bpm);
        }
        const preset = withStompModel(
          { ...cached.preset, id: newId("pst"), createdAt: Date.now() },
          data.stompModel,
        );
        return { ok: true, preset: finishPreset(preset, data, bpm), source: "cache" };
      }
    } catch {
      /* miss */
    }

    // Reserve the slot before the model call, so two builds in flight cannot
    // both take the last one. It is confirmed on success and released on failure.
    const slot = await reserveBuildSlot({
      userId: context.userId,
      email,
      plan,
      kind: "song",
      song: confirmed.song,
    });
    if (!slot.ok) return slotFailure(slot.reason);
    let settled = false;
    try {
      // Step 1: a search-grounded look at the record (gear, settings, sections,
      // tempo, tuning). Fail-soft: without it the preset call works from memory.
      const [record, lessons] = await Promise.all([
        researchRecord(confirmed.song, confirmed.artist, confirmed.album, data.instrument, role),
        standingFeedbackLessons(),
      ]);
      const bpm = record.bpm ?? (await lookupBpm(confirmed.song, confirmed.artist, confirmed.album));
      const catalog = compactCatalogForPrompt(data.instrument, data.stompModel, {
        omitWah: data.wahMode === "pedal",
      });
      const wah = wahPromptLine(parseWahMode(data.wahMode), parseWahModelId(data.wahModelId));
      const prompt = `${lessons}

Confirmed recording: "${confirmed.song}" by ${confirmed.artist}${confirmed.album ? `, album ${confirmed.album}` : ""}.
${bpm ? `Studio tempo is ${bpm} BPM. Set the preset tempo to ${bpm}.` : "Set tempo to the recording's real BPM. Do not use 120 unless the song is actually about 120."}
${record.notes ? `\nResearch notes from a web search of this recording. Use these facts over memory when they are specific; ignore anything about a live rig or a different song:\n${record.notes}\n` : ""}
${songResearchInstructions(confirmed.song, confirmed.artist, data.instrument, wah, role)}
${gearLine(data.userGear)}

Catalog (id|basedOn|knobs):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
      const generated = await runGeminiPreset({
        prompt,
        system: `${SYSTEM}

${systemForDevice(data.stompModel, data.instrument, data.playbackTarget)}`,
        instrument: data.instrument,
        stompModel: data.stompModel,
        source: "song",
        song: confirmed.song,
        artist: confirmed.artist,
        playbackTarget: data.playbackTarget,
        userGear: data.userGear,
      });
      const preset = keepDirtyIntro(generated, record.notes);
      await confirmBuildSlot(slot.reservation);
      settled = true;
      try {
        await persistSongCache({
          key,
          song: confirmed.song,
          artist: confirmed.artist,
          instrument: data.instrument,
          stompModel: data.stompModel,
          preset: publicPreset(preset),
          bpm,
        });
      } catch {
        /* cache miss next time is fine */
      }
      return { ok: true, preset: finishPreset(preset, data, bpm), source: "gemini" };
    } catch (err) {
      const message = friendlyResearchError(err);
      try {
        await recordFailure(context.userId, data.song, data.artist ?? "", message);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: message,
        reason: /busy|try again in a minute/i.test(message) ? "busy" : undefined,
      };
    } finally {
      if (!settled) await releaseBuildSlot(slot.reservation);
    }
  });

export const createCustomSoundFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => cleanCreateInput(CreateIn.parse(input)))
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    const email = await emailFor(context.userId, context.email);
    let plan: Plan;
    try {
      plan = await loadPlanStrict(context.userId, email);
    } catch {
      return planUnavailable();
    }
    const player = (data.playerName ?? "").trim();
    const key = soundCacheKey(data.description, data.instrument, data.stompModel, data.playbackTarget, player);

    if (!plan.canCreate) {
      if (plan.blockedReason === "quota") return blocked("quota");
      return {
        ok: false,
        reason: "paywall",
        error: "Create is a subscriber feature. Song research still uses your free builds.",
      };
    }
    if (await needsEmailConfirmation(context.userId, plan)) return verifyEmailError();
    if (tooManyResearches(context.userId)) {
      return { ok: false, reason: "busy", error: "Too many custom builds in a minute. Wait a bit, then try again." };
    }

    try {
      const cached = await lookupCacheRaw(key);
      if (cached.hit && cached.preset) {
        const slot = await reserveBuildSlot({
          userId: context.userId,
          email,
          plan,
          kind: "create",
          song: data.description.slice(0, 80),
          confirmed: true,
        });
        if (!slot.ok) return slotFailure(slot.reason);
        const preset = withStompModel(
          { ...cached.preset, id: newId("pst"), createdAt: Date.now() },
          data.stompModel,
        );
        return { ok: true, preset: finishPreset(preset, data), source: "cache" };
      }
    } catch {
      /* miss */
    }

    const slot = await reserveBuildSlot({
      userId: context.userId,
      email,
      plan,
      kind: "create",
      song: data.description.slice(0, 80),
    });
    if (!slot.ok) return slotFailure(slot.reason);
    let settled = false;
    try {
      const catalog = compactCatalogForPrompt(data.instrument, data.stompModel, {
        omitWah: data.wahMode === "pedal",
      });
      const wah = wahPromptLine(parseWahMode(data.wahMode), parseWahModelId(data.wahModelId));
      const prompt = `${customSoundInstructions(data.description, data.instrument, wah, parseGuitarRole(data.guitarRole), player)}
${gearLine(data.userGear)}

Catalog (id|basedOn|knobs):
${catalog}

JSON schema:
${jsonSchemaHintCustom()}`;
      const preset = await runGeminiPreset({
        prompt,
        system: `${CUSTOM_SYSTEM}

${systemForCustomSound(data.stompModel, data.instrument, data.playbackTarget)}`,
        instrument: data.instrument,
        stompModel: data.stompModel,
        source: "custom",
        playbackTarget: data.playbackTarget,
        userGear: data.userGear,
      });
      await confirmBuildSlot(slot.reservation);
      settled = true;
      try {
        await persistSongCache({
          key,
          song: preset.name,
          artist: "custom",
          instrument: data.instrument,
          stompModel: data.stompModel,
          preset: publicPreset(preset),
        });
      } catch {
        /* ignore */
      }
      return { ok: true, preset: finishPreset(preset, data), source: "gemini" };
    } catch (err) {
      const message = friendlyResearchError(err);
      try {
        await recordFailure(context.userId, data.description.slice(0, 80), "custom", message);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: message,
        reason: /busy|try again in a minute/i.test(message) ? "busy" : undefined,
      };
    } finally {
      if (!settled) await releaseBuildSlot(slot.reservation);
    }
  });

export type EqMatch = { modelId: string; closeness: string; how: string };

export const lookupEquivalentFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => EqIn.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; matches: EqMatch[]; source: "gemini" } | ResearchErr> => {
    const email = await emailFor(context.userId, context.email);
    const plan = await loadPlan(context.userId, email);
    const query = oneLine(data.query, 120);
    const key = eqCacheKey(query);

    if (!plan.paid) {
      return {
        ok: false,
        reason: "paywall",
        error: "Catalog browse is free. Pedal matching unlocks with StompLab.",
      };
    }
    if (tooManyResearches(context.userId)) {
      return { ok: false, reason: "busy", error: "Too many lookups in a minute. Wait a bit, then try again." };
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

Query: ${query}

Catalog:
${catalog}`,
      )) as { matches?: EqMatch[] };
      const matches = (json.matches ?? []).filter((m) => MODEL_MAP[m.modelId]).slice(0, 4);
      void persistEqCache({ key, query, matches }).catch(() => undefined);
      return { ok: true, matches, source: "gemini" };
    } catch (err) {
      const message = friendlyResearchError(err);
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
  userGear: z.array(GearSchema).max(40).optional().default([]),
});

export const revisePresetFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const d = ReviseIn.parse(input);
    return {
      ...d,
      song: oneLine(d.song, 120),
      artist: d.artist === undefined ? undefined : oneLine(d.artist, 120),
      note: oneLine(d.note, 240),
      current: oneLine(d.current, 2000),
      userGear: cleanUserGear(d.userGear),
    };
  })
  .handler(async ({ context, data }): Promise<ResearchResult> => {
    const email = await emailFor(context.userId, context.email);
    let plan: Plan;
    try {
      plan = await loadPlanStrict(context.userId, email);
    } catch {
      return planUnavailable();
    }
    if (!plan.canResearch) return blocked(plan.blockedReason === "quota" ? "quota" : "paywall");
    if (await needsEmailConfirmation(context.userId, plan)) return verifyEmailError();
    if (tooManyResearches(context.userId)) {
      return { ok: false, reason: "busy", error: "Too many custom builds in a minute. Wait a bit, then try again." };
    }
    const slot = await reserveBuildSlot({
      userId: context.userId,
      email,
      plan,
      kind: "revise",
      song: data.song.trim(),
    });
    if (!slot.ok) return slotFailure(slot.reason);
    let settled = false;
    try {
      const catalog = compactCatalogForPrompt(data.instrument, data.stompModel);
      const lessons = await standingFeedbackLessons();
      const prompt = `${lessons}

Revise this ${DEVICE_MAP[data.stompModel].name} path so it is closer to the RECORD. Keep factory model ids. Only change what the note asks.

Song: ${data.song}${data.artist ? ` by ${data.artist}` : ""}
Current path: ${data.current}
Note from the player: ${data.note}
${gearLine(data.userGear)}

Catalog (id|basedOn|knobs):
${catalog}

JSON schema:
${jsonSchemaHint()}`;
      const preset = await runGeminiPreset({
        prompt,
        system: `${SYSTEM}

${systemForDevice(data.stompModel, data.instrument, data.playbackTarget)}`,
        instrument: data.instrument,
        stompModel: data.stompModel,
        source: "song",
        song: data.song,
        artist: data.artist,
        playbackTarget: data.playbackTarget,
        userGear: data.userGear,
      });
      await confirmBuildSlot(slot.reservation);
      settled = true;
      return { ok: true, preset: sanitizeSnapshots(applyRouting(finishTone(preset), data.playbackTarget)), source: "gemini" };
    } catch (err) {
      const message = friendlyResearchError(err);
      try {
        await recordFailure(context.userId, data.song, data.artist ?? "", message);
      } catch {
        /* ignore */
      }
      return {
        ok: false,
        error: message,
        reason: /busy|try again in a minute/i.test(message) ? "busy" : undefined,
      };
    } finally {
      if (!settled) await releaseBuildSlot(slot.reservation);
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
