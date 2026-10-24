import { guitarArrangement, type GuitarArrangement } from "@/data/guitar-parts";

export const GUITAR_ROLE_IDS = ["rhythm", "lead", "both"] as const;
export type GuitarRole = (typeof GUITAR_ROLE_IDS)[number];

export function parseGuitarRole(value: string | null | undefined): GuitarRole {
  return value === "rhythm" || value === "lead" || value === "both" ? value : "both";
}

/**
 * Which part a song build targets. The owner's rule: a looked-up guitar song is
 * always the LEAD player's part. Whatever the client sent is ignored.
 *
 * - Bass: "both" (one bassist, unchanged).
 * - A song we know has two guitar parts: "lead".
 * - Anything else (one guitarist, or we don't know): "both". The prompt still
 *   asks for the lead / featured part if the record turns out to have two.
 *
 * The value is also the last field of the song cache key, so "both" keeps every
 * one-guitarist row and "lead" keeps the lead rows already built.
 */
export function songBuildRole(
  instrument: "guitar" | "bass",
  song: string,
  artist: string | undefined,
): GuitarRole {
  if (instrument === "bass") return "both";
  return guitarArrangement(song, artist) === "dual" ? "lead" : "both";
}

/**
 * Featured library, decided without the guitar role: the free demos go to
 * everyone, the other featured rigs to paying players. A paid player on a
 * two-guitar song still gets the hand-built demo, never a generated part.
 */
export function libraryServesFeatured(isDemo: boolean, paid: boolean): boolean {
  return isDemo || paid;
}

const LEAD_PART = [
  "LEAD GUITARIST'S PART, THE WHOLE SONG. This record has more than one guitar part: build the player with the solo, the signature lines, and the hooks (Guns N' Roses is Slash's Les Paul and Marshall, not Izzy Stradlin's rig).",
  "Research THAT player's guitar, pickup, amp, channel, and pedals on this session.",
  "Snapshots are that player's tone changes in song order, within the unit's snapshot limit, and their solo always keeps one. Rhythm they play under the vocal is their verse tone, on their rig.",
  "Never the rhythm guitarist's chain. Never two players blended in one preset or snapshot.",
].join(" ");

const ONE_PART = [
  "Build the part of the guitarist who carries this song, through the whole song.",
  "If the record has more than one electric guitar part (a rhythm bed under a lead line, a second player, ambient swells over chords), build the LEAD part: the solo, the melodic lines, the hooks. Never the rhythm-only part, never two players blended.",
  "Snapshots are that one player's tone changes, within the unit's snapshot limit; the solo always keeps one.",
].join(" ");

/**
 * Gemini brief for whose part this is. Guitar songs are always the lead part
 * (owner decision); a one-guitarist song is just that guitarist.
 */
export function guitarRolePrompt(
  role: GuitarRole,
  instrument: "guitar" | "bass",
  arrangement: GuitarArrangement = "unknown",
): string {
  if (instrument === "bass") {
    return "Bass: one player. Snapshots are tone changes of that bass (finger vs pick, clean vs grind), not a guitar-style solo boost. Do not invent a second bassist.";
  }
  if (role === "lead" || arrangement === "dual") return LEAD_PART;
  return ONE_PART;
}
