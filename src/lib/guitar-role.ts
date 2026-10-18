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
 * The value is also the last field of the v11 cache key, so "both" keeps every
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
  "LEAD GUITARIST'S PART, THE WHOLE SONG. This record has more than one guitar part. Build the lead player's part: the player who plays the solo, the signature lines, and the hooks.",
  "Research THAT player's guitar, pickup, amp and channel, and pedals on this session.",
  "Snapshots follow that one player through the song: their intro, their verse, their chorus, their solo. Add a snapshot only where their tone changes. If they play rhythm under the vocal, that is their verse tone, on their rig.",
  "Never the rhythm guitarist's chain. Never a blend of two players in one preset or one snapshot.",
  "Example: Guns N' Roses is Slash's Les Paul and Marshall, not Izzy Stradlin's rig.",
].join(" ");

const ONE_PART = [
  "Build the part of the guitarist who carries this song, through the whole song.",
  "If the record has more than one electric guitar part (a rhythm bed under a lead line, a second player, ambient swells over chords), build the LEAD part: the one with the solo, the melodic lines, and the hooks. Never the rhythm-only part, never a blend of two players.",
  "Snapshots are that one player's tone changes (clean vs dirty, the solo), not a second guitarist.",
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
