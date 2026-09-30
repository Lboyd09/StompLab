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

/** Passed into Gemini. The Lab form sets this — default is both parts. */
export function guitarRolePrompt(role: GuitarRole, instrument: "guitar" | "bass"): string {
  if (instrument === "bass") {
    return "Bass: treat groove vs featured line as separate snapshots when the recorded tone actually changes. Do not invent a guitar-style solo boost. Do not mash groove and featured line into one snapshot.";
  }
  if (role === "rhythm") {
    return "The player chose RHYTHM only. Verse/chorus rhythm as tracked. Do not add a lead/solo snapshot, a solo boost, or extra delay Mix. Do not mix a lead tone into the rhythm chain.";
  }
  if (role === "lead") {
    return "The player chose LEAD / solo only. The featured lead tone of the record. Do not add a chunky rhythm snapshot or a high-gain chug scene. Do not mix rhythm into the lead chain.";
  }
  return [
    "The player chose BOTH parts. Always split rhythm and lead into different snapshots in the same preset.",
    "Snapshot 1 (and chorus if it is a different sound) is rhythm as tracked: dirt, amp, cab of the song's main guitar. No solo boost. No extra delay Mix.",
    "A later snapshot is the lead/solo: boost and/or Ch Vol / Presence / delay Mix. Never the rhythm chain with more Drive.",
    "NEVER combine rhythm crunch and lead boost in one snapshot. They share amp+cab; extra lead blocks turn on ONLY on the lead snapshot.",
    "A solo, lead break, or signature trick that changes the tone MUST be its own snapshot.",
    "enabledModelIds on every snapshot MUST include the amp and cab.",
  ].join(" ");
}