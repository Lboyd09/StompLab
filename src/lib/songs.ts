import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FEATURED } from "@/data/featured";

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
    album: "Stomp Lab library",
    artwork: "",
    featuredId: p.id,
  }));
}

function itunesArtwork(url: string): string {
  return url.replace(/\/\d+x\d+bb\./, "/200x200bb.");
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
    const seen = new Set(local.map((h) => `${h.song.toLowerCase()}|${h.artist.toLowerCase()}`));
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(data.q)}&entity=song&limit=8`;
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
      return [...local, ...remote].slice(0, 8);
    } catch {
      return local.slice(0, 8);
    }
  });
