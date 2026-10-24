import { CATEGORY_MAP } from "@/data/categories";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import type { Preset } from "@/data/types";
import { blockModel, sortedBlocks } from "@/lib/preset-utils";

/**
 * The demo the first-run screens show. Intro, Riff and Solo each light a different chain
 * (amp only; Screamer, gate and scoop; boost and delay), so one tap shows the point.
 */
export const WELCOME_DEMO_ID = "featured-sandman";

/** Whole-number knobs carry a setting, not a 0–10 position; a dial would misread them. */
const STEPPED = new Set(["Note", "Mic", "Interval", "Mode", "Clipping"]);

export type RigBlock = {
  id: string;
  name: string;
  basedOn: string;
  short: string;
  color: string;
  on: boolean;
};

export type RigKnob = { block: string; short: string; name: string; value: number; changed: boolean };

export function welcomeDemo(): Preset {
  return FEATURED.find((p) => p.id === WELCOME_DEMO_ID) ?? FEATURED[0];
}

/** Free demos for this instrument. Bass has none yet, so it gets the guitar ones (never a paid featured rig). */
export function demosFor(instrument: "guitar" | "bass"): { demos: Preset[]; fallback: boolean } {
  const all = FEATURED.filter((p) => (DEMO_IDS as readonly string[]).includes(p.id));
  const mine = all.filter((p) => p.instrument === instrument);
  return mine.length ? { demos: mine, fallback: false } : { demos: all, fallback: true };
}

/** Signal chain as the unit shows it, lit for one snapshot. */
export function rigBlocks(preset: Preset, snapshot: number): RigBlock[] {
  const snap = preset.snapshots[snapshot];
  return sortedBlocks(preset).map((b) => {
    const m = blockModel(b);
    const cat = m ? CATEGORY_MAP[m.category] : undefined;
    return {
      id: b.id,
      name: m?.name ?? b.modelId,
      basedOn: m?.basedOn ?? "",
      short: cat?.short ?? "",
      color: cat?.lcd ?? "#8b909a",
      on: snap ? snap.enabledBlocks.includes(b.id) : b.enabled,
    };
  });
}

/** Knobs this snapshot recalls, with the value it sets. `changed` = differs from the previous switch. */
export function rigKnobs(preset: Preset, snapshot: number, previous?: number): RigKnob[] {
  const snap = preset.snapshots[snapshot];
  if (!snap?.paramOverrides) return [];
  const prev = previous === undefined ? undefined : preset.snapshots[previous];
  const out: RigKnob[] = [];
  for (const [blockId, params] of Object.entries(snap.paramOverrides)) {
    const block = preset.blocks.find((b) => b.id === blockId);
    if (!block || !snap.enabledBlocks.includes(blockId)) continue;
    const model = blockModel(block);
    const name = model?.name ?? block.modelId;
    const short = model ? (CATEGORY_MAP[model.category]?.short ?? "") : "";
    for (const [knob, value] of Object.entries(params)) {
      if (STEPPED.has(knob)) continue;
      const before = prev ? (prev.paramOverrides?.[blockId]?.[knob] ?? block.params[knob]) : value;
      const wasOn = prev ? prev.enabledBlocks.includes(blockId) : true;
      out.push({ block: name, short, name: knob, value, changed: Boolean(prev) && (!wasOn || before !== value) });
    }
  }
  // What moved comes first, so a short list still shows the change.
  return out.sort((a, b) => Number(b.changed) - Number(a.changed));
}
