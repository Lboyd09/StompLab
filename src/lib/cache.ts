import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import type { Preset } from "@/data/types";

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function songCacheKey(
  song: string,
  artist: string | undefined,
  instrument: string,
  stompModel: string,
) {
  return `song|${norm(song)}|${norm(artist ?? "")}|${instrument}|${stompModel}`;
}

export function soundCacheKey(description: string, instrument: string, stompModel: string) {
  return `sound|${norm(description).slice(0, 180)}|${instrument}|${stompModel}`;
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
  stompModel: z.enum(["hx-stomp", "hx-stomp-xl"]),
  preset: z.unknown(),
});

const SaveEqIn = z.object({
  key: z.string().min(4).max(240),
  query: z.string().max(120),
  matches: z.unknown(),
});

export const lookupCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => LookupIn.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{
      preset: Preset | null;
      matches: unknown;
      kind: string;
      hit_count: number;
    }>`select preset, matches, kind, hit_count from rig_cache where cache_key = ${data.key} limit 1`;
    const row = rows[0];
    if (!row) return { hit: false as const };
    await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${data.key}`;
    return {
      hit: true as const,
      kind: row.kind,
      preset: row.preset,
      matches: row.matches,
      hitCount: Number(row.hit_count) + 1,
    };
  });

export const saveSongCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveSongIn.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const existing = await sql<{ cache_key: string }>`
      select cache_key from rig_cache where cache_key = ${data.key} limit 1
    `;
    if (existing.length) {
      await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${data.key}`;
      return { saved: false as const };
    }
    const presetJson = JSON.stringify(data.preset);
    await sql.query(
      `insert into rig_cache (cache_key, kind, song, artist, instrument, stomp_model, preset)
       values ($1, 'song', $2, $3, $4, $5, $6::jsonb)`,
      [data.key, data.song, data.artist, data.instrument, data.stompModel, presetJson],
    );
    return { saved: true as const };
  });

export const saveEqCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveEqIn.parse(input))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const existing = await sql<{ cache_key: string }>`
      select cache_key from rig_cache where cache_key = ${data.key} limit 1
    `;
    if (existing.length) return { saved: false as const };
    const matchesJson = JSON.stringify(data.matches);
    await sql.query(
      `insert into rig_cache (cache_key, kind, query, matches) values ($1, 'eq', $2, $3::jsonb)`,
      [data.key, data.query, matchesJson],
    );
    return { saved: true as const };
  });

export const listCachedSongs = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{
    song: string;
    artist: string;
    instrument: string;
    stomp_model: string;
    hit_count: number;
    cache_key: string;
  }>`
    select song, artist, instrument, stomp_model, hit_count, cache_key
    from rig_cache
    where kind = 'song' and song <> ''
    order by hit_count desc, updated_at desc
    limit 24
  `;
  return rows.map((r) => ({
    song: r.song,
    artist: r.artist,
    instrument: r.instrument as "guitar" | "bass",
    stompModel: r.stomp_model as "hx-stomp" | "hx-stomp-xl",
    hitCount: Number(r.hit_count),
    key: r.cache_key,
  }));
});
