import { FEATURED } from "@/data/featured";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { FootswitchAssign, Preset, StompBlock, StompModelId } from "@/data/types";

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

/** Visual 1 is top-left on XL. Hardware FS1 is the closest-to-you left switch. */
export function visualToHardwareFs(index: number, xl: boolean): number {
  if (!xl) return index;
  const map: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3, 7: 7, 8: 8 };
  return map[index] ?? index;
}

export function featuredBaseId(id: string): string {
  return id.replace(/-hx-stomp-xl$/, "").replace(/-hx-stomp$/, "");
}

export function stompModelFromId(id: string): StompModelId | undefined {
  if (id.endsWith("-hx-stomp-xl")) return "hx-stomp-xl";
  if (id.endsWith("-hx-stomp")) return "hx-stomp";
  return undefined;
}

const MODE_FS: FootswitchAssign = {
  index: 7,
  label: "MODE",
  color: "#5a5e62",
  action: "mode",
  notes: "MODE",
};
const TAP_FS: FootswitchAssign = {
  index: 8,
  label: "TAP",
  color: "#e24a3a",
  action: "tap",
  notes: "TAP",
};

export function featuredOriginal(id: string): Preset | undefined {
  const base = featuredBaseId(id);
  return FEATURED.find((p) => p.id === base || p.id === id);
}

export function withStompModel(preset: Preset, model: StompModelId): Preset {
  const maxSnaps = DEVICE_MAP[model].snapshots;
  const snapshots = preset.snapshots.slice(0, maxSnaps);
  const snapIds = new Set(snapshots.map((s) => s.id));

  let fs = preset.footswitches.filter((f) => f.index <= 6);
  if (model === "hx-stomp") {
    const low = fs.filter((f) => f.index <= 3);
    const high = fs.filter((f) => f.index >= 4 && f.index <= 6);
    fs = high.length ? high.map((f) => ({ ...f, index: f.index - 3 })) : low;
  } else {
    const low = fs.filter((f) => f.index <= 3);
    const high = fs.filter((f) => f.index >= 4 && f.index <= 6);
    if (low.length && !high.length && low.every((f) => f.action === "snapshot")) {
      fs = low.map((f) => ({ ...f, index: f.index + 3 }));
    }
    const fourth = snapshots[3];
    if (
      fourth &&
      !fs.some((f) => f.snapshotId === fourth.id) &&
      !fs.some((f) => f.index === 1)
    ) {
      fs = [
        {
          index: 1,
          label: fourth.name.slice(0, 8).toUpperCase(),
          color: fourth.color,
          action: "snapshot" as const,
          snapshotId: fourth.id,
          notes: fourth.notes,
        },
        ...fs.filter((f) => f.index !== 1),
      ];
    }
    fs = [...fs.filter((f) => f.index <= 6), MODE_FS, TAP_FS];
  }
  fs = fs.filter((f) => f.action !== "snapshot" || (f.snapshotId && snapIds.has(f.snapshotId)));
  const base = featuredBaseId(preset.id);
  const id = base.startsWith("featured-") ? `${base}-${model}` : preset.id;
  return { ...preset, id, stompModel: model, footswitches: fs, snapshots };
}

export function resolveNamedPreset(id: string, model: StompModelId, stored: Preset[]): Preset | null {
  const featured = featuredOriginal(id);
  const fromStore =
    stored.find((p) => p.id === id) ??
    (featured ? stored.find((p) => featuredBaseId(p.id) === featured.id) : undefined);
  const source = fromStore ?? featured;
  if (!source) return null;
  return withStompModel({ ...source, createdAt: fromStore?.createdAt ?? Date.now() }, model);
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function withSnapshot(preset: Preset, snapshotIndex: number): Preset {
  const snap = preset.snapshots[snapshotIndex];
  if (!snap) return preset;
  const blocks = preset.blocks.map((b) => {
    const enabled = snap.enabledBlocks.length ? snap.enabledBlocks.includes(b.id) : b.enabled;
    const over = snap.paramOverrides?.[b.id];
    return {
      ...b,
      enabled,
      params: over ? { ...b.params, ...over } : b.params,
    };
  });
  return { ...preset, blocks };
}
