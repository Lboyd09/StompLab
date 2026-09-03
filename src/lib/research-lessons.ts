/**
 * Standing research rules. Feedback must change the ALGORITHM, never a
 * named song. Players never see this text — it only goes into Gemini.
 */

const SONG_SHAPED = /\b(teen spirit|enter sandman|numb|everlong|like a stone|show me how to live|smells like|black hole sun|creep|hurt|wonderwall)\b/gi;

export const STANDING_RESEARCH_RULES = `Standing research rules (apply to EVERY future song — never retune a named title from feedback):
- Work like Guitar Chalk / a session tech: album + year, studio vs live, which player; guitar/pickups/selector; amp head + channel; pedal order as tracked; cab + mic; then technique. Only then map to catalog modelId values.
- BOSS DS-1 (Nevermind, MIJ yellow) is deez-one-vintage. Keeley-mod DS-1 is deez-one-mod. NEVER stupor-od for a DS-1 — stupor-od is the SD-1 Super OverDrive.
- BOSS SD-1 → stupor-od. Ibanez TS808/TS-9 tightener (Drive 1–2.5, Level 7–8) → scream-808. ProCo RAT → vermin-dist. EHX Small Clone → 70s-chorus.
- One amp. Snapshot Drive / Ch Vol instead of a second amp. Distortion Mix is not a factory knob — omit it.
- Never dime Drive. Pedals ~noon. Amp Drive: clean intro 1.5–3, crunch 3–5, high-gain rhythm 5–6.5, metal 5–7.
- Snapshot 1 is the recorded OPENING (often cleaner than the chorus). A solo / signature trick is its own snapshot with a different tone — boost, delay Mix up, not a copy of the rhythm snap.
- Footswitches 1, 2, 3 (closest row on XL / POD Go / Helix) carry Intro / Verse / Chorus in that order. Far-row 4–6 are later sections. Do not spend FS1–3 on TAP/MODE.
- Only catalog modelId values that exist in the list. Factory HX names only. No invented models, no dual-path splits, no IRs unless the catalog has that id.
- Prefer the tracking/studio rig over a later tour rig when sources disagree.
- Do not "fix" a previous song by name. If a note says a part was wrong, turn it into a general rule (gain staging, missing solo snap, wrong dirt pedal) and apply it next time.`;

export function generalizeLesson(raw: string): string | null {
  let s = raw.replace(/\s+/g, " ").trim();
  if (s.length < 8) return null;
  s = s.replace(SONG_SHAPED, "this kind of arrangement");
  s = s.replace(/\b(for|on|in)\s+["'][^"']{2,40}["']/gi, "");
  s = s.replace(/\b(fix|retune|redo|change)\s+["'][^"']{2,40}["']/gi, "for similar rigs");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length < 8) return null;
  if (/^\s*(fix|change|retune|redo)(\s+this kind of arrangement)?\s*$/i.test(s)) return null;
  if (/^\s*(fix|change|retune|redo)\s+[A-Z][\w'’]+(\s+[A-Z][\w'’]+){0,5}\s*$/.test(s)) return null;
  return s.slice(0, 160);
}

export function standingRulesBlock(feedbackBits: string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of feedbackBits) {
    const g = generalizeLesson(raw);
    if (!g) continue;
    const key = g.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(g);
    if (unique.length >= 8) break;
  }
  const extra = unique.length
    ? `\nPlayer-derived rules (general — NEVER a named song):\n${unique.map((s) => `- ${s}`).join("\n")}`
    : "";
  return `\n${STANDING_RESEARCH_RULES}${extra}\n`;
}
