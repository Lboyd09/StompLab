/**
 * Standing research rules. Feedback must change the ALGORITHM, never a
 * named song. Players never see this text — it only goes into Gemini.
 */

const SONG_SHAPED = /\b(teen spirit|enter sandman|numb|everlong|like a stone|show me how to live|smells like|black hole sun|creep|hurt|wonderwall)\b/gi;

export const STANDING_RESEARCH_RULES = `Standing research rules (apply to EVERY future song — never retune a named title from feedback):
- Work like Guitar Chalk / a session tech: album + year, studio vs live, which player; guitar/pickups; amp + channel; pedal order as tracked; cab + mic; then technique. Map to catalog modelId values only after that.
- Session credits beat a simplified method. Tracking rig beats a later tour rig.
- BOSS DS-1 is deez-one-vintage (MIJ) or deez-one-mod (Keeley). NEVER stupor-od for a DS-1 — stupor-od is the SD-1 Super OverDrive.
- BOSS CE-2 → chorus (not 70s-chorus). BOSS CE-1 and EHX Small Clone → 70s-chorus.
- BOSS SD-1 → stupor-od. Ibanez TS808/TS-9 tightener (Drive 1–2.5, Level 7–8) → scream-808. ProCo RAT → vermin-dist.
- One amp. Snapshot Drive / Ch Vol instead of a second amp.
- Never dime Drive. Pedals ~noon unless the session documented a specific number — then use that number.
- Snapshot 1 is the recorded OPENING. Only add a snapshot when the TONE changes (blocks or knobs). Intro and verse that share a chain are ONE snapshot. A solo / signature trick is its own snapshot.
- Footswitches 1, 2, 3 carry the first three snapshots. Spare FS (4+) = GATE then EQ then WAH bypass. No TAP on FS1–3.
- ONLY catalog modelId values. Factory HX names only. Never invent models or IRs.
- Cab = a factory HD2 cab. Prefer the tracking/studio rig over a later tour rig.
- Set every factory knob. Missing params become 5 and miss the record.
- Match the record's brightness and midrange. Do not scoop a mid-forward guitar or brighten a dark one.
- GATE: when the chain has a high-gain amp or a drive pedal, add noise-gate IN FRONT of the amp. Threshold must be 2 or lower (about 1.8), Decay about 2.4, and the clean or intro snapshot bypasses it. Never hard-gate. A missing or hot threshold mutes the snapshot. Level on a gate stays unity, never a mute.
- LEVELS: Ch Vol, Output, Level, Master, and Boost stay at 3.2 or higher on every snapshot. A 0 recalls as mute. Volume pedal Position / Level stays off the heel (never 0). Amp and cab are ON in every snapshot.
- EQ: only if the session used a dedicated EQ (Mesa graphic, rack EQ). A session graphic sits BETWEEN the amp and the cab (in the loop), never after the speaker.
- WAH: do not put a wah block in the chain unless the wah instruction says the player wants Helix wah. A real wah lives in front of the unit.
- Do not "fix" a previous song by name. Turn a miss into a general rule.
- CLEAN OPENING: if the recorded intro/verse is clean, snapshot 1 MUST be clean — dirt pedals OFF, amp Drive 1.2–2.4, gate OFF. A dirty opening means you left a dirt pedal on or Drive ≥ 3.
- PEDAL-PLATFORM AMPS: when the session used a clean preamp/head as a pedal platform (Mesa Studio Pre rhythm-clean, Hiwatt, Twin), use the CLEAN channel (cali-iv-rhythm-1, us-double-nrm, whowatt-100). Do not sneak the crunch/lead channel. The pedal is the dirty channel.
- SOLOS: about +3 dB from kinky-boost Output near 7 on the lead snapshot only, not a tiny Ch Vol nudge and not extra Drive. Extra Drive on the same amp is a different song.
- DELAY: sync to tempo (Scale 5, dotted eighth) by default. Lead Mix ≤ 2.5 and Feedback ≤ 3.5. Never set Time to 10.
- NAMES: snapshot names are 12 characters. Abbreviate (Rhy, Crnch) before cutting a word in half.
- UNSOURCED GEAR: if it is not a session credit, interview, or published rig, prefix the note with "Likely —".
- VERSE CHORUS/MOD: if a chorus/vibe is the verse identity, it turns OFF for the dry anthem chorus (Small Clone pattern). Do not leave it on for the loud section unless the record did.
- SATURATING ECHO: tape/Echorec/Memory Man that was tracked in front of a muff'd or cranked amp stays BEFORE the amp block so repeats saturate. Digital dotted-8th (SDD-3000) is often after.
- SINGING FUZZ: Big Muff / Ram's Head used for a vocal lead needs Mid around 5–6, not a deep scoop. Do not stack a Tube Screamer on a muff+clean-head rig unless the session did.
- TIGHT CHUG: TS tightener Drive 1–2.5 / Level 7–8 into a Recto/high-gain amp. Keep amp Drive in the 3–4.5 range — a wall of Drive 7+ is mush, not palm-mute tightness. Add noise-gate in front of the amp (Threshold ≤ 2), not a hard-gate.
- RHYTHM vs LEAD: when the brief says rhythm only or lead only, that is a different guitarist. Research their guitar, amp, and pedals. Do not return the other part's chain with Drive or Ch Vol nudged. Do not put both guitarists in one preset. If the song is one guitarist, build that one rig and do not invent a second part.
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
