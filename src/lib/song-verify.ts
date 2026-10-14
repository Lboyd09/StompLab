import { matchReleasedRecording, SONG_NOT_FOUND, type ItunesTrack } from "./song-check";

export { SONG_NOT_FOUND };

export type ConfirmedSong = { song: string; artist: string; album: string };

/** iTunes Search confirms a commercial recording. A miss is a miss — we do not invent one. */
export async function confirmReleasedSong(
  song: string,
  artist?: string,
): Promise<ConfirmedSong | null> {
  const q = [song, artist ?? ""].map((s) => s.trim()).filter(Boolean).join(" ");
  if (!q) return null;
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8`;
  let results: ItunesTrack[] = [];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "StompLab/1.0 (song check)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: ItunesTrack[] };
    results = body.results ?? [];
  } catch {
    return null;
  }
  return matchReleasedRecording(song, artist, results);
}
