import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dbSource, getSql } from "@/lib/db";
import type { Preset } from "@/data/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, loadPlan } from "@/lib/billing";

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

type EqHit = { modelId: string; closeness: string; how: string };

const miss = {
  hit: false as const,
  kind: "",
  preset: null as Preset | null,
  matches: [] as EqHit[],
  hitCount: 0,
};

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
    await sql`update rig_cache set hit_count = hit_count + 1, updated_at = now() where cache_key = ${key}`;
    return {
      hit: true as const,
      kind: row.kind,
      preset: row.preset,
      matches: Array.isArray(row.matches) ? row.matches : [],
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
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    // Guessing cache keys must still consume a research slot for free users.
    if (!plan.paid && !plan.canResearch) return miss;
    return lookupCacheRaw(data.key);
  });

export const saveSongCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveSongIn.parse(input))
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      const presetJson = JSON.stringify(data.preset);
      await sql.query(
        `insert into rig_cache (cache_key, kind, song, artist, instrument, stomp_model, preset)
         values ($1, 'song', $2, $3, $4, $5, $6::jsonb)
         on conflict (cache_key) do update set hit_count = rig_cache.hit_count + 1, updated_at = now()`,
        [data.key, data.song, data.artist, data.instrument, data.stompModel, presetJson],
      );
      return { saved: true as const };
    } catch {
      return { saved: false as const };
    }
  });

export const saveEqCache = createServerFn({ method: "POST" })
  .validator((input: unknown) => SaveEqIn.parse(input))
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      const matchesJson = JSON.stringify(data.matches);
      await sql.query(
        `insert into rig_cache (cache_key, kind, query, matches) values ($1, 'eq', $2, $3::jsonb)
         on conflict (cache_key) do nothing`,
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
      stompModel: "hx-stomp" | "hx-stomp-xl";
      hitCount: number;
      key: string;
    }[];
  });

/** Hidden from visitors — kept so old imports compile. */
export const listCachedSongs = listSharedLibrary;
