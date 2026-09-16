import { MODEL_MAP } from "@/data/catalog";
import type { CategoryId, Preset, Snapshot, StompBlock } from "@/data/types";

const AMP_CAB: ReadonlySet<CategoryId> = new Set([
  "amp-guitar",
  "amp-bass",
  "preamp",
  "cab",
]);

/** Volume knobs that mute the path if a snapshot controller drops them to 0. */
const LEVEL_PARAMS = new Set([
  "Ch Vol",
  "ChVol",
  "Output",
  "Level",
  "Master",
  "Volume",
  "Boost",
]);

/** UI 0–10. Below this the block is effectively off. */
const MIN_LEVEL = 1.5;

export function isAmpOrCab(modelId: string): boolean {
  const cat = MODEL_MAP[modelId]?.category;
  return Boolean(cat && AMP_CAB.has(cat));
}

/** Amp + cab must stay on in every snapshot or HX Edit goes silent. */
export function essentialBlockIds(blocks: StompBlock[]): string[] {
  return blocks.filter((b) => isAmpOrCab(b.modelId)).map((b) => b.id);
}

function clampLevelParams(params: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!params) return params;
  const next = { ...params };
  for (const [name, value] of Object.entries(next)) {
    if (!LEVEL_PARAMS.has(name) && !LEVEL_PARAMS.has(name.replace(/\s+/g, ""))) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < MIN_LEVEL) next[name] = MIN_LEVEL;
  }
  return next;
}

/**
 * Snapshot 2+ going silent is almost always: amp/cab bypassed, or a snapshot
 * controller with no @value (HX treats that as 0). Keep the amp path on and
 * never store a mute-level override.
 */
export function sanitizeSnapshots(preset: Preset): Preset {
  const known = new Set(preset.blocks.map((b) => b.id));
  const essentials = essentialBlockIds(preset.blocks);
  const fallback = preset.blocks.filter((b) => b.enabled).map((b) => b.id);

  const snapshots: Snapshot[] = preset.snapshots.map((snap) => {
    const kept = snap.enabledBlocks.filter((id) => known.has(id));
    const enabled = [...kept];
    for (const id of essentials) {
      if (!enabled.includes(id)) enabled.push(id);
    }
    if (!enabled.length) enabled.push(...fallback);
    const paramOverrides = snap.paramOverrides
      ? Object.fromEntries(
          Object.entries(snap.paramOverrides).map(([id, params]) => [id, clampLevelParams(params) ?? {}]),
        )
      : undefined;
    return { ...snap, enabledBlocks: enabled, paramOverrides };
  });

  return { ...preset, snapshots };
}
