/** Player-facing copy when a title is not a real recording. */
export const SONG_NOT_FOUND =
  "We couldn't find that song. Check the title and artist, or open a demo.";

function lettersOf(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "");
}

/** Gibberish, keyboard mash, or an empty title. Real short titles like YYZ still pass. */
export function looksLikeJunkTitle(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 120) return true;
  const letters = lettersOf(s);
  if (letters.length < 2) return true;
  const vowels = letters.match(/[aeiouy]/g)?.length ?? 0;
  if (letters.length >= 5 && vowels / letters.length < 0.18) return true;
  if (/(.)\1{4,}/.test(letters)) return true;
  const counts = new Map<string, number>();
  for (const c of letters) counts.set(c, (counts.get(c) ?? 0) + 1);
  const top = Math.max(...counts.values());
  if (letters.length >= 8 && top / letters.length > 0.42) return true;
  return false;
}

/** Basic client check: not junk, and the artist (if typed) looks like a name. */
export function looksLikeRealSong(song: string, artist?: string): boolean {
  if (looksLikeJunkTitle(song)) return false;
  const who = (artist ?? "").trim();
  if (who && looksLikeJunkTitle(who)) return false;
  return true;
}

export type ItunesTrack = {
  trackName?: string;
  artistName?: string;
  collectionName?: string;
};

export function normTitle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(feat|ft|featuring)\b.+$/i, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looseIncludes(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** True when this iTunes row is a compilation, live set, or karaoke — rank it under the studio album. */
export function isCompilationAlbum(name: string): boolean {
  return /greatest hits|best of|anthology|\bessential\b|karaoke|tribute|\bcovers\b|soundtrack|live at|live in|super hits|playlist|\bthank you\b/i.test(
    name,
  );
}

/**
 * Pick a real iTunes row for this title. Null when nothing confirms the song
 * (and the artist, when one was typed).
 */
export function matchReleasedRecording(
  song: string,
  artist: string | undefined,
  results: ItunesTrack[],
): { song: string; artist: string; album: string } | null {
  const wantSong = normTitle(song);
  const wantArtist = normTitle(artist ?? "");
  if (!wantSong || looksLikeJunkTitle(song)) return null;
  let best: { song: string; artist: string; album: string; score: number } | null = null;
  for (const row of results) {
    const title = (row.trackName ?? "").trim();
    const who = (row.artistName ?? "").trim();
    const album = (row.collectionName ?? "").trim();
    if (!title || !who) continue;
    const gotSong = normTitle(title);
    const gotArtist = normTitle(who);
    if (!gotSong) continue;
    const songExact = gotSong === wantSong;
    const songClose = songExact || (wantSong.length >= 4 && looseIncludes(gotSong, wantSong) && Math.abs(gotSong.length - wantSong.length) <= 8);
    if (!songClose) continue;
    if (wantArtist && !looseIncludes(gotArtist, wantArtist)) continue;
    if (!wantArtist && !songExact) continue;
    let score = songExact ? 10 : 4;
    if (wantArtist && gotArtist === wantArtist) score += 6;
    if (album && !isCompilationAlbum(album)) score += 3;
    if (!best || score > best.score) best = { song: title, artist: who, album, score };
  }
  if (!best) return null;
  return { song: best.song, artist: best.artist, album: best.album };
}

/** Studio album first, then everything else. Exact title before a partial. */
export function rankSongHits<T extends { song: string; album?: string }>(query: string, hits: T[]): T[] {
  const want = normTitle(query);
  return [...hits].sort((a, b) => scoreHit(want, a) - scoreHit(want, b));
}

function scoreHit(want: string, hit: { song: string; album?: string }): number {
  const title = normTitle(hit.song);
  const exact = title === want ? 0 : 1;
  const comp = hit.album && isCompilationAlbum(hit.album) ? 2 : 0;
  return exact * 10 + comp;
}
