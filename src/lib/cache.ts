import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import { STOMP_MODEL_IDS } from "@/data/types";
import type { Preset } from "@/data/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, loadPlan } from "@/lib/billing";
import { parseGuitarRole, type GuitarRole } from "@/lib/guitar-role";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function songCacheKey(
  song: string,
  artist: string | undefined,
  instrument: string,
  stompModel: string,
  playbackTarget = "frfr",
  wahMode = "pedal",
  guitarRole: GuitarRole | string = "both",
) {
  return `song|v9|${norm(song)}|${norm(artist ?? "")}|${instrument}|${stompModel}|${playbackTarget}|${wahMode}|${parseGuitarRole(guitarRole)}`;
}

/** Previous key — still looked up so older rows hit. */
export function songCacheKeyV8(
  song: string,
  artist: string | undefined,
  instrument: string,
  stompModel: string,
  playbackTarget = "frfr",
  wahMode = "pedal",
) {
  return `song|v8|${norm(song)}|${norm(artist ?? "")}|${instrument}|${stompModel}|${playbackTarget}|${wahMode}`;
}

export function soundCacheKey(
  description: string,
  instrument: string,
  stompModel: string,
  playbackTarget = "frfr",
  playerName = "",
) {
  return `sound|v9|${norm(description).slice(0, 180)}|${instrument}|${stompModel}|${playbackTarget}|${norm(playerName).slice(0, 60)}`;
}

export function eqCacheKey(query: string) {
  return `eq|${norm(query)}`;
}

const LookupIn = z.object({ key: z.string().min(4).max(240) });

const SaveSongIn = z.object({
  key: z.string().min(4).max(240),
  song: z.string().max(120),
  artist: z.string().max(120),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: z.enum(STOMP_MODEL_IDS),
  preset: z.unknown(),
});

const SaveEqIn = z.object({
  key: z.string().min(4).max(240),
  query: z.string().max(120),
  matches: z.unknown(),
});

type EqHit = { modelId: string; closeness: string; how: string };

const miss = {
  hit: false as const,
  kind: "",
  preset: null as Preset | null,
  matches: [] as EqHit[],
  hitCount: 0,
};

function playablePreset(raw: unknown): Preset | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Preset;
  if (!Array.isArray(p.blocks) || !p.blocks.length) return null;
  return p;
}

/** Internal cache read — used by research so we never list a public library. */
export async function lookupCacheRaw(key: string) {
  try {
    const sql = await getSql();
    const rows = await sql<{
      preset: Preset | null;
      matches: EqHit[] | null;
      kind: string;
      hit_count: number;
    }>`select preset, matches, kind, hit_count from rig_cache where cache_key = ${key} limit 1`;
    const row = rows[0];
    if (!row) return miss;
    const preset = playablePreset(row.preset);
    if (row.kind === "song" && !preset) return miss;
    await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${key}`;
    return {
      hit: true as const,
      kind: row.kind,
      preset,
      matches: Array.isArray(row.matches) ? row.matches : [],
      hitCount: Number(row.hit_count) + 1,
    };
  } catch {
    return miss;
  }
}

/**
 * Shared across accounts (rig_cache has no user_id). Exact key first, then
 * older v8 keys, then any row with the same song + instrument.
 */
export async function lookupSongCache(opts: {
  song: string;
  artist?: string;
  instrument: string;
  stompModel: string;
  playbackTarget?: string;
  wahMode?: string;
  guitarRole?: string;
}) {
  const playback = opts.playbackTarget ?? "frfr";
  const wah = opts.wahMode ?? "pedal";
  const role = parseGuitarRole(opts.guitarRole);
  const keys = [
    songCacheKey(opts.song, opts.artist, opts.instrument, opts.stompModel, playback, wah, role),
    songCacheKeyV8(opts.song, opts.artist, opts.instrument, opts.stompModel, playback, wah),
    songCacheKey(opts.song, "", opts.instrument, opts.stompModel, playback, wah, role),
    songCacheKeyV8(opts.song, "", opts.instrument, opts.stompModel, playback, wah),
  ];
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const row = await lookupCacheRaw(key);
    if (row.hit && row.preset) return row;
  }
  try {
    const sql = await getSql();
    const songN = norm(opts.song);
    const rows = await sql<{
      preset: Preset | null;
      hit_count: number;
      cache_key: string;
    }>`
      select preset, hit_count, cache_key from rig_cache
      where kind = 'song'
        and lower(trim(song)) = ${songN}
        and instrument = ${opts.instrument}
      order by
        case when stomp_model = ${opts.stompModel} then 0 else 1 end,
        hit_count desc,
        updated_at desc
      limit 1
    `;
    const row = rows[0];
    const preset = playablePreset(row?.preset);
    if (!row || !preset) return miss;
    await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${row.cache_key}`;
    return {
      hit: true as const,
      kind: "song",
      preset,
      matches: [] as EqHit[],
      hitCount: Number(row.hit_count) + 1,
    };
  } catch {
    return miss;
  }
}

export const lookupCache = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => LookupIn.parse(input))
  .handler(async ({ context, data }) => {
    const email = await emailFor(context.userId, context.email);
    const plan = await loadPlan(context.userId, email);
    // Guessing cache keys must still consume a research slot for free users.
    if (!plan.paid && !plan.canResearch) return miss;
    return lookupCacheRaw(data.key);
  });

/** Write (or refresh) a song/sound cache row. Conflict must keep the preset. */
export async function persistSongCache(data: {
  key: string;
  song: string;
  artist: string;
  instrument: string;
  stompModel: string;
  preset: unknown;
}): Promise<boolean> {
  try {
    const sql = await getSql();
    const presetJson = JSON.stringify(data.preset);
    await sql.query(
      `insert into rig_cache (cache_key, kind, song, artist, instrument, stomp_model, preset, updated_at)
       values ($1, 'song', $2, $3, $4, $5, $6::jsonb, now())
       on conflict (cache_key) do update set
         preset = excluded.preset,
         song = excluded.song,
         artist = excluded.artist,
         instrument = excluded.instrument,
         stomp_model = excluded.stomp_model,
         updated_at = now()`,
      [data.key, data.song, data.artist, data.instrument, data.stompModel, presetJson],
    );
    return true;
  } catch {
    return false;
  }
}

export const saveSongCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveSongIn.parse(input))
  .handler(async ({ data }) => {
    const saved = await persistSongCache(data);
    return { saved };
  });

export const saveEqCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveEqIn.parse(input))
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      const matchesJson = JSON.stringify(data.matches);
      await sql.query(
        `insert into rig_cache (cache_key, kind, query, matches) values ($1, 'eq', $2, $3::jsonb)
         on conflict (cache_key) do update set matches = excluded.matches, updated_at = now()`,
        [data.key, data.query, matchesJson],
      );
      return { saved: true as const };
    } catch {
      return { saved: false as const };
    }
  });

export const cacheHealth = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::int as n from rig_cache`;
    if (!rows[0]) {
      return { ok: false, entries: 0, backend: "none" as const };
    }
    return { ok: true, entries: Number(rows[0].n ?? 0), backend: dbSource };
  } catch {
    return { ok: false, entries: 0, backend: "none" as const };
  }
});

/** Intentionally empty — shared cache is not a browseable library. */
export const listSharedLibrary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    return [] as {
      song: string;
      artist: string;
      instrument: "guitar" | "bass";
      stompModel: string;
      hitCount: number;
      key: string;
    }[];
  });

/** Hidden from visitors — kept so old imports compile. */
export const listCachedSongs = listSharedLibrary;
