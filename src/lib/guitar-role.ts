import type { GuitarArrangement } from "@/data/guitar-parts";
import type { Preset } from "@/data/types";

export const GUITAR_ROLE_IDS = ["rhythm", "lead", "both"] as const;
export type GuitarRole = (typeof GUITAR_ROLE_IDS)[number];

export function parseGuitarRole(value: string | null | undefined): GuitarRole {
  return value === "rhythm" || value === "lead" || value === "both" ? value : "both";
}

const LEAD_NAME = /\b(lead|solo|lick)\b/i;
const RHYTHM_NAME = /\b(rhythm|chug|riff)\b/i;

/**
 * Drop the other guitar part when the player picked rhythm or lead.
 * Intro / verse / hello stay — they are not a lead or a rhythm name.
 * No-op if that would empty the preset or nothing matches.
 */
export function focusGuitarRole(preset: Preset, role: GuitarRole): Preset {
  if (role === "both" || preset.instrument === "bass") return preset;
  const drop = role === "lead" ? RHYTHM_NAME : LEAD_NAME;
  const keep = role === "lead" ? LEAD_NAME : RHYTHM_NAME;
  const snapshots = preset.snapshots.filter((s) => !(drop.test(s.name) && !keep.test(s.name)));
  if (!snapshots.length || snapshots.length === preset.snapshots.length) return preset;
  const ids = new Set(snapshots.map((s) => s.id));
  return {
    ...preset,
    snapshots,
    footswitches: preset.footswitches.filter((f) => {
      if (f.action !== "snapshot") return true;
      return f.snapshotId != null && ids.has(f.snapshotId);
    }),
  };
}

/**
 * Gemini brief. Rhythm and lead are different guitarists, not a Drive nudge.
 * "both" means one guitarist — do not invent a second part.
 */
export function guitarRolePrompt(
  role: GuitarRole,
  instrument: "guitar" | "bass",
  arrangement: GuitarArrangement = "unknown",
): string {
  if (instrument === "bass") {
    return "Bass: one player. Snapshots are tone changes of that bass (finger vs pick, clean vs grind), not a guitar-style solo boost. Do not invent a second bassist.";
  }
  if (role === "rhythm" || (arrangement === "dual" && role !== "lead")) {
    return [
      "RHYTHM GUITARIST ONLY. Research THAT player's guitar, pickups, amp, channel, and pedals.",
      "Do not research the lead guitarist. Do not return the lead chain with Drive or Ch Vol turned down.",
      "No lead snapshot, no solo boost, no solo delay, no wah that belongs to the other player.",
      "Example: Metallica rhythm is James's Explorer, Tube Screamer, and Recto chug — not Kirk's lead guitar.",
      "One rig. Snapshots are tone changes of the rhythm part only (clean intro vs the riff).",
    ].join(" ");
  }
  if (role === "lead") {
    return [
      "LEAD GUITARIST ONLY. Research THAT player's guitar, pickups, amp, and pedals as a different rig.",
      "Not the rhythm chain with Drive, Ch Vol, or Presence nudged. Different guitar if they played one. Different gain. Different effects (wah, boost, delay) if that player used them.",
      "Do not include the rhythm chug, the rhythm guitarist's guitar, or a 'both parts' snapshot.",
      "Example: Metallica lead is Kirk's guitar and lead tone, not James's scooped Recto with the volume up.",
      "One rig for the lead part. If a song's 'lead' is just the rhythm tone played higher, say so and still build the lead player's chain, not a mash of both.",
    ].join(" ");
  }
  return "One guitarist carries this song. Build that one rig. Do not invent a second guitarist, a lead snapshot, or a rhythm-plus-lead mash. Snapshots are tone changes of this part only (clean vs dirty), not two players.";
}