import { DEMO_IDS, FEATURED } from "@/data/featured";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { CategoryId, FootswitchAssign, Preset, StompBlock, StompModelId } from "@/data/types";
import { STOMP_MODEL_IDS } from "@/data/types";

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
  return DEVICE_MAP[preset.stompModel] ?? DEVICE_MAP["hx-stomp"];
}

/**
 * Replica 1 is top-left. On XL the factory silkscreen is inverted:
 * hardware FS4/5/6 are the top row, FS1/2/3 the closest-to-you row.
 * Map visual → hardware so intro (visual 1) lands on the TOP of the unit.
 */
export function visualToHardwareFs(index: number, xl: boolean): number {
  if (!xl) return index;
  const map: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3, 7: 7, 8: 8 };
  return map[index] ?? index;
}

export function featuredBaseId(id: string): string {
  const sorted = [...STOMP_MODEL_IDS].sort((a, b) => b.length - a.length);
  for (const model of sorted) {
    if (id.endsWith(`-${model}`)) return id.slice(0, -(model.length + 1));
  }
  return id;
}

export function stompModelFromId(id: string): StompModelId | undefined {
  const sorted = [...STOMP_MODEL_IDS].sort((a, b) => b.length - a.length);
  for (const model of sorted) {
    if (id.endsWith(`-${model}`)) return model;
  }
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

export function isDemoId(id: string): boolean {
  const base = featuredBaseId(id);
  return (DEMO_IDS as readonly string[]).includes(base);
}

export function isFeaturedKnownId(id: string): boolean {
  const base = featuredBaseId(id);
  return FEATURED.some((p) => p.id === base || p.id === id);
}

/** Demos + custom builds download on free. Other known/featured rigs are replica-only until unlock. */
export function canDownloadPreset(
  id: string,
  plan: { paid?: boolean; admin?: boolean } | null | undefined,
): boolean {
  if (plan?.paid || plan?.admin) return true;
  if (isDemoId(id)) return true;
  if (isFeaturedKnownId(id)) return false;
  return true;
}

export function withStompModel(preset: Preset, model: StompModelId): Preset {
  const device = DEVICE_MAP[model] ?? DEVICE_MAP["hx-stomp"];
  const maxSnaps = device.snapshots;
  let blocks: StompBlock[] = preset.blocks;
  let snapshots = preset.snapshots.slice(0, maxSnaps);

  if (!device.hasAmpCab) {
    const ampCab = new Set<CategoryId>(["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"]);
    const kept = new Set<string>();
    blocks = preset.blocks
      .filter((b) => {
        const m = MODEL_MAP[b.modelId];
        if (!m || ampCab.has(m.category)) return false;
        kept.add(b.id);
        return true;
      })
      .map((b, i) => ({ ...b, position: i }))
      .slice(0, device.maxBlocks);
    snapshots = snapshots.map((s) => ({
      ...s,
      enabledBlocks: s.enabledBlocks.filter((id) => kept.has(id)),
      paramOverrides: s.paramOverrides
        ? Object.fromEntries(Object.entries(s.paramOverrides).filter(([id]) => kept.has(id)))
        : undefined,
    }));
  } else if (blocks.length > device.maxBlocks) {
    blocks = blocks.slice(0, device.maxBlocks);
  }

  const snapIds = new Set(snapshots.map((s) => s.id));
  let fs = preset.footswitches.filter(
    (f) => f.index >= 1 && f.index <= device.footswitches && f.action !== "mode" && f.action !== "tap",
  );

  if (device.footswitches <= 3) {
    const low = fs.filter((f) => f.index <= 3);
    const high = fs.filter((f) => f.index >= 4 && f.index <= 6);
    fs = low.length ? low : high.map((f) => ({ ...f, index: f.index - 3 }));
  } else {
    const low = fs.filter((f) => f.index <= 3);
    const high = fs.filter((f) => f.index >= 4 && f.index <= 6);
    if (!low.length && high.length) {
      fs = high.map((f) => ({ ...f, index: f.index - 3 }));
    } else {
      fs = [...low, ...high.filter((h) => !low.some((l) => l.index === h.index - 3))];
    }
    for (let i = 0; i < Math.min(snapshots.length, Math.min(device.footswitches, 8)); i++) {
      const index = i + 1;
      const snap = snapshots[i];
      if (!snap) continue;
      if (fs.some((f) => f.index === index || f.snapshotId === snap.id)) continue;
      fs = [
        ...fs.filter((f) => f.index !== index),
        {
          index,
          label: snap.name.slice(0, 8).toUpperCase(),
          color: snap.color,
          action: "snapshot" as const,
          snapshotId: snap.id,
          notes: snap.notes,
        },
      ];
    }
    if (device.layout === "xl") {
      fs = [...fs.filter((f) => f.index <= 6), MODE_FS, TAP_FS];
    } else {
      fs = fs.filter((f) => f.index <= device.footswitches);
    }
  }
  fs = fs.filter((f) => f.action !== "snapshot" || (f.snapshotId && snapIds.has(f.snapshotId)));
  fs = fs.sort((a, b) => a.index - b.index);
  const base = featuredBaseId(preset.id);
  const id = base.startsWith("featured-") ? `${base}-${model}` : preset.id;
  return { ...preset, id, stompModel: model, blocks, footswitches: fs, snapshots };
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
