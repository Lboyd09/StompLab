export const GUITAR_ROLE_IDS = ["rhythm", "lead", "both"] as const;
export type GuitarRole = (typeof GUITAR_ROLE_IDS)[number];

export function parseGuitarRole(value: string | null | undefined): GuitarRole {
  return value === "rhythm" || value === "lead" || value === "both" ? value : "both";
}

/** Gemini only — the player never picks a part. Always default to both. */
export function guitarRolePrompt(role: GuitarRole, instrument: "guitar" | "bass"): string {
  if (instrument === "bass") {
    return "Bass: treat groove vs featured line as separate snapshots when the recorded tone actually changes. Do not invent a guitar-style solo boost. Do not mash groove and featured line into one snapshot.";
  }
  if (role === "rhythm") {
    return "RHYTHM snapshots only: verse/chorus rhythm as tracked. Do not add a lead/solo snapshot, a solo boost, or extra delay Mix. Do not mix a lead tone into the rhythm chain.";
  }
  if (role === "lead") {
    return "LEAD / solo only: the featured lead tone of the record. Do not add a chunky rhythm snapshot or a high-gain chug scene. Do not mix rhythm into the lead chain.";
  }
  return [
    "Always split rhythm and lead into different snapshots in the same preset. The player is not asked which part they play.",
    "Snapshot 1 (and chorus if it is a different sound) is rhythm as tracked: dirt, amp, cab of the song's main guitar. No solo boost. No extra delay Mix.",
    "A later snapshot is the lead/solo: boost and/or Ch Vol / Presence / delay Mix. Never the rhythm chain with more Drive.",
    "NEVER combine rhythm crunch and lead boost in one snapshot. They share amp+cab; extra lead blocks turn on ONLY on the lead snapshot.",
    "A solo, lead break, or signature trick that changes the tone MUST be its own snapshot.",
    "enabledModelIds on every snapshot MUST include the amp and cab.",
  ].join(" ");
}
