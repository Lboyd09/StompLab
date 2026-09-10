import { MODEL_MAP } from "@/data/catalog";
import type { Preset, StompBlock } from "@/data/types";
import { newId } from "./preset-utils";

export const WAH_MODES = ["pedal", "exp", "fs"] as const;
export type WahMode = (typeof WAH_MODES)[number];

export function parseWahMode(value: string | null | undefined): WahMode {
  return value && (WAH_MODES as readonly string[]).includes(value) ? (value as WahMode) : "pedal";
}

/** Helix wahs a player would actually own. Cry Baby first — that's the default. */
export const WAH_MODELS = [
  { id: "teardrop-310", label: "Cry Baby", basedOn: "Dunlop Cry Baby Fasel 310" },
  { id: "uk-wah-846", label: "Vox 846", basedOn: "Vox V846" },
  { id: "fassel", label: "Cry Baby Super", basedOn: "Dunlop Cry Baby Super" },
  { id: "chrome", label: "Vox 847", basedOn: "Vox V847" },
  { id: "throaty", label: "RMC 1", basedOn: "RMC Real McCoy 1" },
] as const;

export const WAH_MODEL_IDS = new Set<string>(WAH_MODELS.map((w) => w.id));

export function parseWahModelId(value: string | null | undefined): string {
  return value && WAH_MODEL_IDS.has(value) ? value : "teardrop-310";
}

export function isWahBlock(modelId: string) {
  return MODEL_MAP[modelId]?.category === "wah";
}

const WAH_WORDS = /\bwah\b|cry baby|crybaby|v846|v847|clyde|gcb-?95|fasel/i;

export function songUsedWah(preset: Preset): boolean {
  if (preset.blocks.some((b) => isWahBlock(b.modelId))) return true;
  return preset.originalGear.some((g) => WAH_WORDS.test(`${g.role} ${g.name} ${g.notes}`));
}

function defaultWahParams(modelId: string): Record<string, number> {
  const model = MODEL_MAP[modelId];
  const params: Record<string, number> = {};
  for (const p of model?.params ?? ["Position", "Mix", "Dc Bias", "Level"]) {
    params[p] = p === "Mix" || p === "Level" ? 10 : p === "Position" ? 4 : 5;
  }
  return params;
}

function reindex(blocks: StompBlock[]): StompBlock[] {
  return blocks.map((b, i) => ({ ...b, position: i }));
}

function dropIds(preset: Preset, drop: Set<string>): Preset {
  const blocks = reindex(preset.blocks.filter((b) => !drop.has(b.id)));
  const keep = new Set(blocks.map((b) => b.id));
  return {
    ...preset,
    blocks,
    snapshots: preset.snapshots.map((s) => ({
      ...s,
      enabledBlocks: s.enabledBlocks.filter((id) => keep.has(id)),
      paramOverrides: s.paramOverrides
        ? Object.fromEntries(Object.entries(s.paramOverrides).filter(([id]) => keep.has(id)))
        : undefined,
    })),
    footswitches: preset.footswitches.filter((f) => !f.targetBlockId || keep.has(f.targetBlockId)),
  };
}

function withTip(preset: Preset, tip: string): Preset {
  if (preset.tips.some((t) => t.toLowerCase().includes(tip.slice(0, 24).toLowerCase()))) return preset;
  return { ...preset, tips: [tip, ...preset.tips] };
}

/**
 * Wah does not belong in the Helix chain unless the player wants the modeler's
 * wah on an expression pedal or a footswitch. Everyone else has a real wah
 * in front of the unit.
 */
export function applyWahPreference(preset: Preset, mode: WahMode, modelId: string): Preset {
  const model = parseWahModelId(modelId);
  const existing = preset.blocks.filter((b) => isWahBlock(b.modelId));
  const used = songUsedWah(preset);

  if (mode === "pedal") {
    let next = existing.length ? dropIds(preset, new Set(existing.map((b) => b.id))) : preset;
    if (used) {
      next = withTip(
        next,
        "This part used a wah. Plug yours in front of the unit — we did not put a wah block in the chain.",
      );
    }
    return next;
  }

  if (!used && !existing.length) return preset;

  const wah =
    existing[0] && existing[0].modelId === model
      ? existing[0]
      : {
          id: existing[0]?.id ?? newId("wah"),
          modelId: model,
          enabled: true,
          path: "main" as const,
          position: 0,
          params: existing[0]?.params ?? defaultWahParams(model),
        };

  const without = preset.blocks.filter((b) => !isWahBlock(b.modelId));
  const blocks = reindex([wah, ...without]);
  const firstSnap = preset.snapshots[0]?.id;
  const snapshots = preset.snapshots.map((s) => {
    const enabled = new Set(s.enabledBlocks.filter((id) => !existing.some((w) => w.id === id)));
    const intro = /intro|wah|clean|arp/i.test(s.name);
    if (intro || s.id === firstSnap) enabled.add(wah.id);
    return { ...s, enabledBlocks: [...enabled] };
  });

  let fs = preset.footswitches.filter((f) => !existing.some((w) => w.id === f.targetBlockId));
  if (mode === "fs" && !fs.some((f) => f.targetBlockId === wah.id)) {
    const usedIdx = new Set(fs.map((f) => f.index));
    let index = 4;
    while (usedIdx.has(index) && index <= 12) index += 1;
    if (index <= 12) {
      fs = [
        ...fs,
        {
          index,
          label: "WAH",
          color: "#f5d000",
          action: "bypass" as const,
          targetBlockId: wah.id,
          notes: "Stomp the Helix wah on/off. Park Position if you have no expression pedal.",
        },
      ].sort((a, b) => a.index - b.index);
    }
  }

  const tip =
    mode === "exp"
      ? "Assign EXP 1 to Wah Position after import. The intro/wah snapshot turns the block on."
      : "FS WAH turns the Helix wah on/off. Park Position around 4 if you sweep by hand.";

  return withTip({ ...preset, blocks, snapshots, footswitches: fs }, tip);
}

export function wahPromptLine(mode: WahMode, modelId: string): string {
  const model = parseWahModelId(modelId);
  const named = WAH_MODELS.find((w) => w.id === model)?.label ?? "Cry Baby";
  if (mode === "pedal") {
    return `WAH: the player has a real wah pedal in front of the unit. Do NOT emit any wah block (no teardrop-310, uk-wah-846, fassel, weeper, chrome, throaty, vetta-wah). If the record used a wah, put it in originalGear and tips: "plug your wah in front."`;
  }
  if (mode === "exp") {
    return `WAH: the player wants the Helix ${named} (${model}) on an expression pedal. If the record used a wah, put ${model} first in the chain and mention EXP 1 → Position. If it did not, omit wah.`;
  }
  return `WAH: the player wants the Helix ${named} (${model}) on a footswitch, not an expression pedal. If the record used a wah, put ${model} in the chain and a spare FS action "bypass" labeled WAH. If it did not, omit wah.`;
}
