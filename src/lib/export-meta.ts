import { DEVICE_MAP } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import type { Preset, StompModelId } from "@/data/types";
import { applyRouting } from "./rig-routing";

// The small export facts the page needs before a download. The file builder itself (hlx.ts, and
// POD Go's catalog behind it) loads only when a download is near; see export-loader.ts.

export function exportProfile(model: StompModelId) {
  return DEVICE_MAP[model] ?? DEVICE_MAP["hx-stomp"];
}

export function canExportHlx(model: StompModelId): boolean {
  const format = exportProfile(model).exportFormat;
  return format === "hlx" || format === "pgp";
}

export function exportExtension(model: StompModelId): "hlx" | "pgp" | null {
  const format = exportProfile(model).exportFormat;
  if (format === "hlx" || format === "pgp") return format;
  return null;
}

/**
 * SL-68: the player's IR slot, when this unit has IR slots and the file still has a cab to
 * replace (a rig into a real speaker has none).
 */
export function userIrSlot(preset: Preset, irSlot: number | null | undefined): number | undefined {
  if (typeof irSlot !== "number" || !Number.isInteger(irSlot)) return undefined;
  const device = exportProfile(preset.stompModel);
  if (!device.irSlots || !device.hasAmpCab || irSlot < 1 || irSlot > device.irSlots) return undefined;
  // A guitar IR on a bass rig loses the low end: bass presets keep their bass cab.
  if (preset.instrument === "bass") return undefined;
  const routed = applyRouting(preset);
  const cab = routed.blocks.find((b) => MODEL_MAP[b.modelId]?.category === "cab");
  return cab && MODEL_MAP[cab.modelId]?.instrument !== "bass" ? irSlot : undefined;
}

export function hlxFilename(preset: Preset): string {
  const ext = exportExtension(preset.stompModel) ?? "hlx";
  const base =
    (preset.name || preset.song || "preset")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 24) || "preset";
  return `${base}.${ext}`;
}
