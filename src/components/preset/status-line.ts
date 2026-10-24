import type { FootswitchAssign, StompBlock } from "@/data/types";
import { blockModel } from "@/lib/preset-utils";
import { isAmpOrCab } from "@/lib/snapshot-sanitize";

const TYPE_WORD = /^(eq|booster|boost|delay|echo|reverb|chorus|compressor|fuzz|overdrive|distortion|wah|tremolo|phaser|flanger|vibe)$/i;
/** Brands longer than one word; the pedal name starts after them. */
const BRANDS = [
  "analog man",
  "ben adrian",
  "chase bliss",
  "dallas arbiter",
  "darkglass electronics",
  "dr. z",
  "heil sound",
  "lightfoot labs",
  "paul cochrane",
  "pro co",
  "tc electronic",
  "tech 21",
  "way huge",
  "wounded paw",
];

/** One maker's name for one pedal ("BOSS DS-1 Distortion") → "DS-1"; null when there is no clear short name. */
function shortOne(text: string): string | null {
  let words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const lower = words.join(" ").toLowerCase();
  const brand = BRANDS.find((b) => lower.startsWith(`${b} `));
  // First word is the brand when there is more than one.
  words = brand ? words.slice(brand.split(" ").length) : words.length > 1 ? words.slice(1) : words;
  if (!words.length) return null;
  // A model number names the pedal (DS-1, TS808, CE-1); a bare number does not (Phase 90).
  const numbered = words.find((w) => /\d/.test(w) && /[a-z]/i.test(w) && w.length <= 10);
  const last = words[words.length - 1];
  const whole = words.join(" ");
  const name = numbered
    ? numbered
    : words.length <= 3 && whole.length <= 18
      ? whole
      : TYPE_WORD.test(last)
        ? words.slice(-2).join(" ")
        : words.slice(0, 2).join(" ");
  // A lowercase description ("optical tremolo circuit") or a bare number is not a pedal name.
  if (!/^[A-Z]/.test(name) || name.length > 18) return null;
  return name;
}

/**
 * The real pedal a model stands in for, short enough for one line under the replica:
 * "BOSS DS-1 Distortion (Made-in-Japan)" → "DS-1", "Xotic EP Booster" → "EP Booster".
 * Falls back to the Line 6 name for Line 6 originals and anything unclear. When the model stands in
 * for two pedals ("BOSS CE-1 / EHX Small Clone"), only the one the preset's own notes name is used,
 * so the line never names a different pedal than the notes under it.
 */
export function shortGearName(basedOn: string | undefined, fallback: string, context = ""): string {
  const head = (basedOn ?? "").split(/\s*\(|,/)[0].trim();
  if (!head || /^line ?6\b/i.test(head)) return fallback;
  const alts = head.split(/\s+\/\s+/);
  if (alts.length === 1) return shortOne(alts[0]) ?? fallback;
  const text = context.toLowerCase();
  for (const alt of alts) {
    const short = shortOne(alt);
    if (!short) continue;
    if (text.includes(short.toLowerCase()) || text.includes(alt.toLowerCase())) return short;
  }
  return fallback;
}

function gearName(block: StompBlock, context: string): string {
  const model = blockModel(block);
  return model ? shortGearName(model.basedOn, model.name, context) : "Effect";
}

/** "DS-1 off, Small Clone on": the effects (not amp or cab) as this part loads them. */
export function effectsLine(blocks: StompBlock[], context = ""): string {
  return blocks
    .filter((b) => blockModel(b) && !isAmpOrCab(b.modelId))
    .map((b) => `${gearName(b, context)} ${b.enabled ? "on" : "off"}`)
    .join(", ");
}

/**
 * One plain sentence under the replica.
 * Snapshot mode: "FS2 · Pre-Chorus: Small Clone on, DS-1 off".
 * Stomp mode: "FS1 DS-1 on · FS2 Small Clone off".
 */
export function replicaStatusLine(opts: {
  stompMode: boolean;
  /** Blocks as the shown part has them (snapshot applied). */
  blocks: StompBlock[];
  partName?: string;
  partFs?: number;
  footswitches: FootswitchAssign[];
  stompFs: number[];
  /** The preset's own words (summary, part notes, original rig): picks which pedal a two-pedal model is called. */
  context?: string;
}): string {
  const context = opts.context ?? "";
  if (opts.stompMode) {
    const stomps = opts.footswitches
      .filter((f) => f.action === "bypass" && f.targetBlockId && opts.stompFs.includes(f.index))
      .sort((a, b) => a.index - b.index)
      .map((f) => {
        const b = opts.blocks.find((x) => x.id === f.targetBlockId);
        return b ? `FS${f.index} ${gearName(b, context)} ${b.enabled ? "on" : "off"}` : "";
      })
      .filter(Boolean);
    return stomps.length ? stomps.join(" · ") : "No effects on the switches yet.";
  }
  const fx = effectsLine(opts.blocks, context);
  const head = [opts.partFs ? `FS${opts.partFs}` : "", opts.partName ?? ""].filter(Boolean).join(" · ");
  if (!fx) return head ? `${head}: amp and cab only` : "Amp and cab only";
  return head ? `${head}: ${fx}` : fx;
}
