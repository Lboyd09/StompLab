import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FEATURED } from "@/data/featured";
import { rankSongHits } from "./song-check";
import { getSql } from "./db";
import { currentClientIp, rateLimited } from "./rate-limit";

export type SongHit = {
  id: string;
  song: string;
  artist: string;
  album: string;
  artwork: string;
  featuredId?: string;
};

function featuredHits(q: string, instrument: "guitar" | "bass"): SongHit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  return FEATURED.filter((p) => {
    if (p.instrument !== instrument) return false;
    const hay = `${p.song ?? ""} ${p.artist ?? ""}`.toLowerCase();
    return hay.includes(needle) || (p.song ?? "").toLowerCase().startsWith(needle);
  }).map((p) => ({
    id: p.id,
    song: p.song ?? p.name,
    artist: p.artist ?? "",
    album: "Demo",
    artwork: "",
    featuredId: p.id,
  }));
}

function itunesArtwork(url: string): string {
  return url.replace(/\/\d+x\d+bb\./, "/200x200bb.");
}

/** Suggestion lookups per address per minute. Typing a title is a handful; a scraper is hundreds. */
export const SUGGEST_PER_IP_PER_MINUTE = 60;
const SUGGEST_TTL_MS = 10 * 60_000;
const SUGGEST_CACHE_MAX = 500;
const suggestCache = new Map<string, { at: number; hits: SongHit[] }>();

export function suggestCacheKey(q: string, instrument: "guitar" | "bass"): string {
  return `${instrument}|${q.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

/** Popular prefixes ("ever", "smells") repeat across players; serve them from memory for a few minutes. */
export function cachedSuggestions(key: string, now = Date.now()): SongHit[] | null {
  const hit = suggestCache.get(key);
  if (!hit) return null;
  if (now - hit.at > SUGGEST_TTL_MS) {
    suggestCache.delete(key);
    return null;
  }
  return hit.hits;
}

export function rememberSuggestions(key: string, hits: SongHit[], now = Date.now()) {
  if (suggestCache.size >= SUGGEST_CACHE_MAX) {
    const oldest = suggestCache.keys().next().value;
    if (oldest !== undefined) suggestCache.delete(oldest);
  }
  suggestCache.set(key, { at: now, hits });
}

export const suggestSongsFn = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().min(2).max(80),
        instrument: z.enum(["guitar", "bass"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SongHit[]> => {
    const instrument = data.instrument ?? "guitar";
    const local = featuredHits(data.q, instrument);
    const cacheKey = suggestCacheKey(data.q, instrument);
    const cached = cachedSuggestions(cacheKey);
    if (cached) return cached;
    const ip = await currentClientIp();
    if (await rateLimited(getSql, `suggest:${ip}`, SUGGEST_PER_IP_PER_MINUTE, 60)) return local.slice(0, 8);
    const seen = new Set(local.map((h) => `${h.song.toLowerCase()}|${h.artist.toLowerCase()}`));
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(data.q)}&entity=song&limit=15`;
      const res = await fetch(url, {
        headers: { "User-Agent": "StompLab/1.0 (song suggest)" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return local.slice(0, 8);
      const body = (await res.json()) as {
        results?: {
          trackId?: number;
          trackName?: string;
          artistName?: string;
          collectionName?: string;
          artworkUrl100?: string;
        }[];
      };
      const remote: SongHit[] = [];
      for (const r of body.results ?? []) {
        const song = (r.trackName ?? "").trim();
        const artist = (r.artistName ?? "").trim();
        if (!song || !artist) continue;
        const key = `${song.toLowerCase()}|${artist.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        remote.push({
          id: String(r.trackId ?? key),
          song,
          artist,
          album: r.collectionName ?? "",
          artwork: r.artworkUrl100 ? itunesArtwork(r.artworkUrl100) : "",
        });
      }
      const hits = rankSongHits(data.q, [...local, ...remote]).slice(0, 8);
      rememberSuggestions(cacheKey, hits);
      return hits;
    } catch {
      return local.slice(0, 8);
    }
  });
