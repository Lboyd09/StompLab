import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { Preset, StompBlock } from "@/data/types";

export function blockModel(block: StompBlock) {
  return MODEL_MAP[block.modelId];
}

export function sortedBlocks(preset: Preset): StompBlock[] {
  return [...preset.blocks].sort((a, b) => a.position - b.position);
}

export function paramEntries(block: StompBlock): { name: string; value: number }[] {
  const model = blockModel(block);
  const names = model?.params ?? Object.keys(block.params);
  return names.map((name) => ({ name, value: block.params[name] ?? 5 }));
}

export function formatParam(value: number): string {
  return value.toFixed(1).replace(/\.0$/, ".0");
}

export function dspLoad(preset: Preset): number {
  const weight = { light: 8, medium: 14, heavy: 28 };
  const used = preset.blocks.reduce((sum, b) => {
    const m = blockModel(b);
    return sum + (m ? weight[m.dsp] : 12);
  }, 0);
  return Math.min(100, Math.round(used));
}

export function deviceFor(preset: Preset) {
  return DEVICE_MAP[preset.stompModel];
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
