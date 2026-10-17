import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import type { Preset } from "@/data/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { parseGuitarRole, type GuitarRole } from "@/lib/guitar-role";
import { playableIssues, sanitizeSnapshots } from "@/lib/snapshot-sanitize";

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
  return `song|v11|${norm(song)}|${norm(artist ?? "")}|${instrument}|${stompModel}|${playbackTarget}|${wahMode}|${parseGuitarRole(guitarRole)}`;
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
  return `sound|v10|${norm(description).slice(0, 180)}|${instrument}|${stompModel}|${playbackTarget}|${norm(playerName).slice(0, 60)}`;
}

export function eqCacheKey(query: string) {
  return `eq|${norm(query)}`;
}

type EqHit = { modelId: string; closeness: string; how: string };

const miss = {
  hit: false as const,
  key: "",
  kind: "",
  preset: null as Preset | null,
  matches: [] as EqHit[],
  hitCount: 0,
  bpm: null as number | null,
};

function playablePreset(raw: unknown): Preset | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Preset;
  if (!Array.isArray(p.blocks) || !p.blocks.length) return null;
  const healed = sanitizeSnapshots(p);
  if (playableIssues(healed).some((issue) => issue.reason !== "cab sits before the amp")) return null;
  return healed;
}

function cachedBpm(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 40 && n <= 240 ? Math.round(n) : null;
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
      bpm: number | null;
    }>`select preset, matches, kind, hit_count, bpm from rig_cache where cache_key = ${key} limit 1`;
    const row = rows[0];
    if (!row) return miss;
    const preset = playablePreset(row.preset);
    if (row.kind === "song" && !preset) return miss;
    await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${key}`;
    return {
      hit: true as const,
      key,
      kind: row.kind,
      preset,
      matches: Array.isArray(row.matches) ? row.matches : [],
      hitCount: Number(row.hit_count) + 1,
      bpm: cachedBpm(row.bpm),
    };
  } catch {
    return miss;
  }
}

/**
 * Shared across accounts (rig_cache has no user_id). Exact v11 key first.
 * The loose fallback only reuses the current key version for this unit, and it
 * needs the same title AND the same artist: a title alone is a different song
 * ("Creep" by TLC is not Radiohead's rig).
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
  const artistN = norm(opts.artist ?? "");
  // A lookup with no artist cannot say which song it means, so it never hits.
  if (!artistN) return miss;
  const exact = songCacheKey(opts.song, opts.artist, opts.instrument, opts.stompModel, playback, wah, role);
  const row = await lookupCacheRaw(exact);
  if (row.hit && row.preset) return row;
  try {
    const sql = await getSql();
    const songN = norm(opts.song);
    const rows = await sql<{
      preset: Preset | null;
      hit_count: number;
      cache_key: string;
      bpm: number | null;
    }>`
      select preset, hit_count, cache_key, bpm from rig_cache
      where kind = 'song'
        and lower(trim(song)) = ${songN}
        and lower(trim(artist)) = ${artistN}
        and instrument = ${opts.instrument}
        and cache_key like ${"song|v11|%|" + role}
        and stomp_model = ${opts.stompModel}
      order by
        hit_count desc,
        updated_at desc
      limit 1
    `;
    const found = rows[0];
    const preset = playablePreset(found?.preset);
    if (!found || !preset) return miss;
    await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${found.cache_key}`;
    return {
      hit: true as const,
      key: found.cache_key,
      kind: "song",
      preset,
      matches: [] as EqHit[],
      hitCount: Number(found.hit_count) + 1,
      bpm: cachedBpm(found.bpm),
    };
  } catch {
    return miss;
  }
}

/** Write (or refresh) a song/sound cache row. Conflict must keep the preset. */
export async function persistSongCache(data: {
  key: string;
  song: string;
  artist: string;
  instrument: string;
  stompModel: string;
  preset: unknown;
  bpm?: number | null;
}): Promise<boolean> {
  try {
    const sql = await getSql();
    const presetJson = JSON.stringify(data.preset);
    await sql.query(
      `insert into rig_cache (cache_key, kind, song, artist, instrument, stomp_model, preset, bpm, updated_at)
       values ($1, 'song', $2, $3, $4, $5, $6::jsonb, $7, now())
       on conflict (cache_key) do update set
         preset = excluded.preset,
         song = excluded.song,
         artist = excluded.artist,
         instrument = excluded.instrument,
         stomp_model = excluded.stomp_model,
         bpm = coalesce(excluded.bpm, rig_cache.bpm),
         updated_at = now()`,
      [data.key, data.song, data.artist, data.instrument, data.stompModel, presetJson, cachedBpm(data.bpm)],
    );
    return true;
  } catch {
    return false;
  }
}

/** Remember the studio tempo on a row that was cached before tempo was stored. */
export async function saveCacheBpm(key: string, bpm: number): Promise<void> {
  const value = cachedBpm(bpm);
  if (!value || !key) return;
  try {
    const sql = await getSql();
    await sql`update rig_cache set bpm = ${value} where cache_key = ${key} and bpm is null`;
  } catch {
    /* next hit asks again */
  }
}

/**
 * Internal only. Never a server function: the pedal-match cache is written by
 * research after a real answer, not by the browser.
 */
export async function persistEqCache(data: { key: string; query: string; matches: unknown }): Promise<boolean> {
  try {
    const sql = await getSql();
    await sql.query(
      `insert into rig_cache (cache_key, kind, query, matches) values ($1, 'eq', $2, $3::jsonb)
       on conflict (cache_key) do update set matches = excluded.matches, updated_at = now()`,
      [data.key, data.query, JSON.stringify(data.matches)],
    );
    return true;
  } catch {
    return false;
  }
}

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
