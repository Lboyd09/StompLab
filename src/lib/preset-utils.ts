import { DEMO_IDS, FEATURED } from "@/data/featured";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { CategoryId, FootswitchAssign, Preset, Snapshot, StompBlock, StompModelId } from "@/data/types";
import { routeFor } from "@/data/playback";
import { STOMP_MODEL_IDS } from "@/data/types";
import { helixIdFor } from "@/data/helix-ids";
import { hxModel, SYNC_NOTES } from "@/data/hx-catalog";
import { nativeFor, resolveParamKeys, syncNoteFor } from "./hx-params";
import { formatNative, nativeToUi } from "./hx-units";
import { keepSnapshots, sanitizeSnapshots } from "./snapshot-sanitize";

export function blockModel(block: StompBlock) {
  return MODEL_MAP[block.modelId];
}

export function sortedBlocks(preset: Preset): StompBlock[] {
  return [...preset.blocks].sort((a, b) => a.position - b.position);
}

export type ParamEntry = {
  /** Name the preset stores the knob under (an older app name when the preset already uses one). */
  name: string;
  /** HX Edit's label for the control. */
  label: string;
  kind: "knob" | "switch" | "choice";
  /** Stored value: 0–10 for knobs and switches, the real setting for choices. */
  value: number;
  min: number;
  max: number;
  /** What HX Edit shows for this setting (dB, Hz, ms, note value…). */
  display: string;
  options?: string[];
};

const HIDDEN_KEYS = new Set(["TempoSync1", "SyncSelect1", "TempoSync2", "SyncSelect2"]);

/**
 * The block's controls as HX Edit has them, in HX Edit's units. Values come from the preset;
 * a knob the preset never set shows the factory default the exported file will carry.
 */
export function paramEntries(block: StompBlock): ParamEntry[] {
  const m = hxModel(helixIdFor(block.modelId));
  if (!m) {
    return Object.entries(block.params).map(([name, value]) => ({
      name,
      label: name,
      kind: "knob" as const,
      value,
      min: 0,
      max: 10,
      display: value.toFixed(1),
    }));
  }
  const byKey = new Map<string, string>();
  for (const name of Object.keys(block.params)) {
    for (const key of resolveParamKeys(block.modelId, name)) if (!byKey.has(key)) byKey.set(key, name);
  }
  const out: ParamEntry[] = [];
  for (const p of m.params) {
    if (HIDDEN_KEYS.has(p.key)) continue;
    const name = byKey.get(p.key) ?? p.key;
    const set = block.params[name];
    if (p.type === "i") {
      const value = typeof set === "number" ? Math.round(set) : Number(p.def);
      out.push({ name, label: p.label, kind: "choice", value, min: p.min, max: p.max, display: formatNative(p, value) });
      continue;
    }
    const value = typeof set === "number" ? set : nativeToUi(p, p.def);
    const native = nativeFor(block.modelId, p.key, name, value) ?? p.def;
    out.push({
      name,
      label: p.label,
      kind: p.type === "b" ? "switch" : "knob",
      value,
      min: 0,
      max: 10,
      display: formatNative(p, native),
    });
  }
  if (m.byKey.SyncSelect1) {
    const note = syncNoteFor(block);
    out.push({
      name: "Note",
      label: "Note Sync",
      kind: "choice",
      value: note ?? 0,
      min: 0,
      max: 19,
      display: note ? SYNC_NOTES[note - 1] : "Off (ms)",
      options: ["Off (ms)", ...SYNC_NOTES],
    });
  }
  return out;
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
 * Replica index IS the silkscreen / HX Edit number.
 * Looking down with the LCD at the top: FS1 is always TOP LEFT.
 * HX Stomp XL: top 1–3 + MODE, bottom 4–6 + TAP.
 * Helix: top 1–6, bottom 7–12. POD Go / HX Effects: top 1–4, bottom 5–8.
 * Stomp: single row 1–3 left to right.
 */
export function visualToHardwareFs(index: number, _xl = false): number {
  return index;
}

/** Number HX Edit and the physical silkscreen use for this replica switch. */
export function hxEditFsNumber(index: number, xl = false): number {
  return visualToHardwareFs(index, xl);
}

/**
 * LCD scribble order looking down at the unit (top row first, then bottom).
 * XL LCD sits above FS1–3, so the upper scribble row is 1–3, lower is 4–6.
 */
export function lcdScribbleIndices(layout: "stomp" | "xl"): number[] {
  if (layout === "xl") return [1, 2, 3, 4, 5, 6];
  return [1, 2, 3];
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

export const GATE_TOGGLE_IDS = new Set(["noise-gate", "hard-gate", "horizon-gate"]);
export const EQ_TOGGLE_IDS = new Set([
  "simple-eq",
  "low-and-high-cut",
  "low-high-shelf",
  "parametric",
  "tilt",
  "10-band-graphic",
  "cali-q-graphic",
]);

export function isGateBlock(modelId: string) {
  return GATE_TOGGLE_IDS.has(modelId);
}

export function isEqToggleBlock(modelId: string) {
  return EQ_TOGGLE_IDS.has(modelId);
}

function assignUtilityBypassFs(
  blocks: StompBlock[],
  fs: FootswitchAssign[],
  device: { footswitches: number; layout: string },
): FootswitchAssign[] {
  if (device.footswitches <= 3) return fs;
  const reserved = device.layout === "xl" ? new Set([7, 8]) : new Set<number>();
  const used = new Set(fs.map((f) => f.index));
  const free: number[] = [];
  for (let i = 1; i <= device.footswitches; i++) {
    if (reserved.has(i) || used.has(i)) continue;
    free.push(i);
  }
  const next = [...fs];
  const take = (label: string, color: string, block: StompBlock, notes: string) => {
    if (!free.length) return;
    if (next.some((f) => f.action === "bypass" && f.targetBlockId === block.id)) return;
    const index = free.shift()!;
    next.push({
      index,
      label,
      color,
      action: "bypass",
      targetBlockId: block.id,
      notes,
    });
  };
  const gate = blocks.find((b) => isGateBlock(b.modelId));
  const eq = blocks.find((b) => isEqToggleBlock(b.modelId));
  if (gate) take("GATE", "#f5d000", gate, "On/off the noise gate.");
  if (eq) take("EQ", "#c6e800", eq, "On/off the EQ.");
  return next;
}

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
  preset = sanitizeSnapshots(preset);
  const device = DEVICE_MAP[model] ?? DEVICE_MAP["hx-stomp"];
  const maxSnaps = device.snapshots;
  let blocks: StompBlock[] = preset.blocks;
  // A cached Floor/XL donor trimmed to a Stomp keeps its solo; a middle section goes instead.
  let snapshots = keepSnapshots(preset.snapshots, maxSnaps);

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
    snapshots = snapshots.map((s) => {
      // In front of a real amp, a snapshot that only had the amp and cab on is every pedal off.
      return {
        ...s,
        enabledBlocks: s.enabledBlocks.filter((id) => kept.has(id)),
        paramOverrides: s.paramOverrides
          ? Object.fromEntries(Object.entries(s.paramOverrides).filter(([id]) => kept.has(id)))
          : undefined,
      };
    });
  } else if (blocks.length > device.maxBlocks) {
    blocks = blocks.slice(0, device.maxBlocks);
  }

  const snapIds = new Set(snapshots.map((s) => s.id));
  // A switch for a snapshot that was trimmed goes first, so its index is free for the kept ones.
  let fs = preset.footswitches.filter(
    (f) =>
      f.index >= 1 &&
      f.index <= device.footswitches &&
      f.action !== "mode" &&
      f.action !== "tap" &&
      (f.action !== "snapshot" || (f.snapshotId && snapIds.has(f.snapshotId))),
  );
  // Snapshot N on switch N when that switch is free and the snapshot has none (a kept solo).
  const fillSnapshotSwitches = () => {
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
  };

  if (device.footswitches <= 3) {
    const low = fs.filter((f) => f.index <= 3);
    const high = fs.filter((f) => f.index >= 4 && f.index <= 6);
    fs = low.length ? low : high.map((f) => ({ ...f, index: f.index - 3 }));
    fillSnapshotSwitches();
  } else {
    const low = fs.filter((f) => f.index <= 3);
    const high = fs.filter((f) => f.index >= 4 && f.index <= 6);
    if (!low.length && high.length) {
      fs = high.map((f) => ({ ...f, index: f.index - 3 }));
    } else {
      fs = [...low, ...high.filter((h) => h.action !== "snapshot" || !low.some((l) => l.index === h.index - 3))];
    }
    fillSnapshotSwitches();
    fs = assignUtilityBypassFs(blocks, fs, device);
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

/**
 * The stored copy wins over the featured catalog: the exact id, else this rig saved for `model`.
 * `anyUnitEdits` (setlist export) also takes the player's edited copy from another unit; a shared
 * link leaves it off so a friend's link never shows your own edits.
 */
export function resolveNamedPreset(
  id: string,
  model: StompModelId,
  stored: Preset[],
  opts: { anyUnitEdits?: boolean } = {},
): Preset | null {
  const featured = featuredOriginal(id);
  const fromStore =
    stored.find((p) => p.id === id) ??
    (featured
      ? (stored.find((p) => featuredBaseId(p.id) === featured.id && p.stompModel === model) ??
        (opts.anyUnitEdits ? stored.find((p) => featuredBaseId(p.id) === featured.id && p.userEdited) : undefined))
      : undefined);
  const source = fromStore ?? featured;
  if (!source) return null;
  return withStompModel({ ...source, createdAt: fromStore?.createdAt ?? Date.now() }, model);
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Pedals into a real amp: HX Effects, or any unit set to play in front of an amp. */
export function pedalsOnlyRig(preset: Preset): boolean {
  return DEVICE_MAP[preset.stompModel]?.hasAmpCab === false || routeFor(preset.playbackTarget) === "pedals";
}

/**
 * Whether a snapshot turns a block on. An empty list means "every pedal off" on a pedals-only
 * rig (the real amp still sounds); elsewhere it means the blocks' own on/off.
 */
export function snapshotEnables(preset: Preset, snap: Snapshot | undefined, block: StompBlock): boolean {
  if (snap?.enabledBlocks?.length) return snap.enabledBlocks.includes(block.id);
  if (snap && pedalsOnlyRig(preset)) return false;
  return block.enabled;
}

export function withSnapshot(preset: Preset, snapshotIndex: number): Preset {
  const snap = preset.snapshots[snapshotIndex];
  if (!snap) return preset;
  const blocks = preset.blocks.map((b) => {
    const enabled = snapshotEnables(preset, snap, b);
    const over = snap.paramOverrides?.[b.id];
    return {
      ...b,
      enabled,
      params: over ? { ...b.params, ...over } : b.params,
    };
  });
  return { ...preset, blocks };
}

/**
 * Demo notes are written for the HX Stomp, where snapshots 1–3 sit on FS1–FS3. On other units the
 * same snapshots sit on other switches (XL: FS5, FS6, FS2), so rewrite FS1–FS3 to the real ones.
 */
export function unitSwitchText(text: string, snapshotFs: number[]): string {
  if (snapshotFs[0] === 1 && snapshotFs[1] === 2 && snapshotFs[2] === 3) return text;
  const fs = (n: number) => `FS${snapshotFs[n - 1] ?? n}`;
  // One pass, so a rewritten number is never rewritten again.
  return text.replace(/FS1\s*[–-]\s*FS3|\bFS([1-3])\b/g, (m, n?: string) =>
    n ? fs(Number(n)) : `${fs(1)}, ${fs(2)}, ${fs(3)}`,
  );
}
