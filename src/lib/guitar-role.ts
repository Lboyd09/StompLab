export const GUITAR_ROLE_IDS = ["rhythm", "lead", "both"] as const;
export type GuitarRole = (typeof GUITAR_ROLE_IDS)[number];

export function parseGuitarRole(value: string | null | undefined): GuitarRole {
  return value === "rhythm" || value === "lead" || value === "both" ? value : "both";
}

export const GUITAR_ROLE_COPY: Record<GuitarRole, { label: string; hint: string }> = {
  rhythm: { label: "Rhythm", hint: "Verse and chorus. No solo boost." },
  lead: { label: "Lead", hint: "Solos and featured lines." },
  both: { label: "Both", hint: "Rhythm and lead as separate snapshots." },
};

/** Gemini: never mash rhythm + lead into one tone. */
export function guitarRolePrompt(role: GuitarRole, instrument: "guitar" | "bass"): string {
  if (instrument === "bass") {
    return "Bass: treat groove vs featured line as separate snapshots when the recorded tone actually changes. Do not invent a guitar-style solo boost.";
  }
  if (role === "rhythm") {
    return "Player wants RHYTHM only. Snapshots are verse/chorus rhythm tones. Do not add a lead/solo snapshot, a solo boost, or extra delay Mix for a solo. Do not mix a lead tone into the rhythm chain.";
  }
  if (role === "lead") {
    return "Player wants LEAD / solo only. Build the featured lead tone of the record. Do not add a chunky rhythm snapshot or a high-gain chug scene. Do not mix rhythm into the lead chain.";
  }
  return [
    "Player wants BOTH rhythm and lead in one preset.",
    "Snapshot 1 is rhythm as tracked (dirt, amp, cab as the song's main guitar).",
    "A later snapshot is lead: boost and/or Ch Vol / Presence / delay Mix — not the rhythm chain with more Drive.",
    "NEVER mash rhythm and lead into one snapshot. They share amp+cab; the extra lead pieces turn on only on the lead snapshot.",
    "enabledModelIds on every snapshot MUST include the amp and cab.",
  ].join(" ");
}
