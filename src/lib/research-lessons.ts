/**
 * Standing research rules. Feedback must change the ALGORITHM, never a
 * named song. Players never see this text — it only goes into Gemini.
 */

const SONG_SHAPED = /\b(teen spirit|enter sandman|numb|everlong|like a stone|show me how to live|smells like|black hole sun|creep|hurt|wonderwall)\b/gi;

export const STANDING_RESEARCH_RULES = `Standing research rules (apply to EVERY future song — never retune a named title from feedback):
- Work like Guitar Chalk / a session tech: album + year, studio vs live, which player; guitar/pickups; amp + channel; pedal order as tracked; cab + mic; then technique. Map to catalog modelId values only after that.
- Session credits beat a simplified method. Tracking rig beats a later tour rig.
- BOSS DS-1 is deez-one-vintage (MIJ) or deez-one-mod (Keeley). NEVER stupor-od for a DS-1 — stupor-od is the SD-1 Super OverDrive.
- BOSS SD-1 → stupor-od. Ibanez TS808/TS-9 tightener (Drive 1–2.5, Level 7–8) → scream-808. ProCo RAT → vermin-dist. EHX Small Clone → 70s-chorus.
- One amp. Snapshot Drive / Ch Vol instead of a second amp.
- Never dime Drive. Pedals ~noon unless the session documented a specific number — then use that number.
- Snapshot 1 is the recorded OPENING. Only add a snapshot when the TONE changes (blocks or knobs). Intro and verse that share a chain are ONE snapshot. A solo / signature trick is its own snapshot.
- Footswitches 1, 2, 3 carry the first three snapshots. Spare FS (4+) = GATE then EQ then WAH bypass. No TAP on FS1–3.
- ONLY catalog modelId values. Factory HX names only. Never invent models or IRs.
- Cab = a factory HD2 cab. Prefer the tracking/studio rig over a later tour rig.
- Set every factory knob. Missing params become 5 and miss the record.
- Match the record's brightness and midrange. Do not scoop a mid-forward guitar or brighten a dark one.
- GATE: only if the record is tight high-gain / palm-muted / documented as gated. The gate sits IN FRONT of the amp, never after the cab. Threshold stays at or under 4.2 — hotter than that closes on a chord and the snapshot goes silent. Hard Gate must store OpenThreshold and CloseThreshold in dB (about −80 to −28, Close ~8 dB lower, Level 0). A missing open threshold lands at 0 dB and the snapshot is blank.
- EQ: only if the session used a dedicated EQ (Mesa graphic, rack EQ). A session graphic sits BETWEEN the amp and the cab (in the loop), never after the speaker.
- WAH: do not put a wah block in the chain unless the wah instruction says the player wants Helix wah. A real wah lives in front of the unit.
- Do not "fix" a previous song by name. Turn a miss into a general rule.
- CLEAN OPENING: if the recorded intro/verse is clean, snapshot 1 MUST be clean — dirt pedals OFF, amp Drive 1.2–2.4, gate OFF. A dirty opening means you left a dirt pedal on or Drive ≥ 3.
- PEDAL-PLATFORM AMPS: when the session used a clean preamp/head as a pedal platform (Mesa Studio Pre rhythm-clean, Hiwatt, Twin), use the CLEAN channel (cali-iv-rhythm-1, us-double-nrm, whowatt-100). Do not sneak the crunch/lead channel. The pedal is the dirty channel.
- SOLOS: raise Ch Vol / Presence / a clean boost — not Drive. Extra Drive on the same amp is a different song.
- VERSE CHORUS/MOD: if a chorus/vibe is the verse identity, it turns OFF for the dry anthem chorus (Small Clone pattern). Do not leave it on for the loud section unless the record did.
- SATURATING ECHO: tape/Echorec/Memory Man that was tracked in front of a muff'd or cranked amp stays BEFORE the amp block so repeats saturate. Digital dotted-8th (SDD-3000) is often after.
- SINGING FUZZ: Big Muff / Ram's Head used for a vocal lead needs Mid around 5–6, not a deep scoop. Do not stack a Tube Screamer on a muff+clean-head rig unless the session did.
- TIGHT CHUG: TS tightener Drive 1–2.5 / Level 7–8 into a Recto/high-gain amp. Keep amp Drive in the 3–4.5 range — a wall of Drive 7+ is mush, not palm-mute tightness. Gate ON for the chug snapshot only; OFF for clean/wah intros.
- PUBLISHED NUMBERS WIN: Guitar World / session-credit knob numbers beat "noon on everything." Copy them onto the matching catalog params.`;

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

export function playerDerivedRules(feedbackBits: string[]): string {
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
  return unique.length
    ? `\nPlayer-derived rules (general — NEVER a named song):\n${unique.map((s) => `- ${s}`).join("\n")}\n`
    : "";
}

export function standingRulesBlock(feedbackBits: string[]): string {
  return `\n${STANDING_RESEARCH_RULES}${playerDerivedRules(feedbackBits)}`;
}
