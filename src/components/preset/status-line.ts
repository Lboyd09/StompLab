import type { FootswitchAssign, StompBlock } from "@/data/types";
import { blockModel } from "@/lib/preset-utils";
import { isAmpOrCab } from "@/lib/snapshot-sanitize";

const TYPE_WORD = /^(eq|booster|boost|delay|echo|reverb|chorus|compressor|fuzz|overdrive|distortion|wah|tremolo|phaser|flanger|vibe)$/i;

/**
 * The real pedal a model stands in for, short enough for one line under the replica:
 * "BOSS DS-1 Distortion (Made-in-Japan)" → "DS-1", "Xotic EP Booster" → "EP Booster".
 */
export function shortGearName(basedOn: string | undefined, fallback: string): string {
  const head = (basedOn ?? "").split(/\s*\(|,|\s+\/\s+/)[0].trim();
  const words = head.split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  // First word is the brand when there is more than one.
  const rest = words.length > 1 ? words.slice(1) : words;
  // A model number names the pedal (DS-1, TS808, CE-1); a bare number does not (Phase 90).
  const numbered = rest.find((w) => /\d/.test(w) && /[a-z]/i.test(w) && w.length <= 10);
  const last = rest[rest.length - 1];
  const name = numbered
    ? numbered
    : rest.length > 2 && TYPE_WORD.test(last)
      ? rest.slice(-2).join(" ")
      : rest.slice(0, 2).join(" ");
  return name.length > 18 ? fallback : name;
}

function gearName(block: StompBlock): string {
  const model = blockModel(block);
  return model ? shortGearName(model.basedOn, model.name) : "Effect";
}

/** "DS-1 off, Small Clone on": the effects (not amp or cab) as this part loads them. */
export function effectsLine(blocks: StompBlock[]): string {
  return blocks
    .filter((b) => blockModel(b) && !isAmpOrCab(b.modelId))
    .map((b) => `${gearName(b)} ${b.enabled ? "on" : "off"}`)
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
}): string {
  if (opts.stompMode) {
    const stomps = opts.footswitches
      .filter((f) => f.action === "bypass" && f.targetBlockId && opts.stompFs.includes(f.index))
      .sort((a, b) => a.index - b.index)
      .map((f) => {
        const b = opts.blocks.find((x) => x.id === f.targetBlockId);
        return b ? `FS${f.index} ${gearName(b)} ${b.enabled ? "on" : "off"}` : "";
      })
      .filter(Boolean);
    return stomps.length ? stomps.join(" · ") : "No effects on the switches yet.";
  }
  const fx = effectsLine(opts.blocks);
  const head = [opts.partFs ? `FS${opts.partFs}` : "", opts.partName ?? ""].filter(Boolean).join(" · ");
  if (!fx) return head ? `${head}: amp and cab only` : "Amp and cab only";
  return head ? `${head}: ${fx}` : fx;
}
