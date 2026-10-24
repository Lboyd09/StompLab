/**
 * Standing research rules. Feedback must change the ALGORITHM, never a
 * named song. Players never see this text — it only goes into Gemini.
 */

const SONG_SHAPED = /\b(teen spirit|enter sandman|numb|everlong|like a stone|show me how to live|smells like|black hole sun|creep|hurt|wonderwall)\b/gi;

/**
 * The tone and hardware rules themselves live once, in SYSTEM (src/lib/gemini.ts)
 * and systemForDevice (src/lib/preset-schema.ts). This is only the frame for the
 * player-derived lessons, so nothing is said twice in the prompt.
 */
export const STANDING_RESEARCH_RULES = `Standing rule: never retune a named title from feedback. A miss becomes a general rule for every song.`;

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
