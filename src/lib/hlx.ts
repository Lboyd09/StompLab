import { DEVICE_MAP } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import { helixIdFor, isHxStompModelId, UNEXPORTABLE_MODELS } from "@/data/helix-ids";
import { hxModel, hxModelOnUnit, type HxUnitFamily } from "@/data/hx-catalog";
import type { CategoryId, Preset, Snapshot, StompBlock, StompModelId } from "@/data/types";
import { blockNativeParams, legacyMicIndex, liftSnapshotSwitches, nativeFor, resolveParamKeys, type NativeParams } from "./hx-params";
import { buildPgp } from "./pgp";
import { unitSpec } from "@/components/stomp/hardware";
import { deviceFor, snapshotEnables, sortedBlocks, visualToHardwareFs } from "./preset-utils";
import { sanitizeSnapshots } from "./snapshot-sanitize";
import { applyRouting, removesAmp } from "./rig-routing";
import { routeFor } from "@/data/playback";
import { loadSettings } from "./storage";

/**
 * HX Edit .hlx is L6Preset JSON. Line 6 publishes no schema; this follows real exports from every
 * unit (HX Stomp, Stomp XL, Helix Floor, LT, HX Effects; ~1,900 files) and HX Edit's own model
 * catalog (hx-catalog.ts):
 *   version 6 / schema L6Preset, device id per unit (Stomp 2162694, XL 2162699, Floor 2162689,
 *   LT 2162692, HX Effects 2162693)
 *   inputA/inputB/outputA/outputB @model per unit (HelixStomp_*, HD2_AppDSPFlow1/2Input, HelixFx_*)
 *   blocks: @model, @position, @path, @type, @enabled (= the loaded snapshot), every catalog knob
 *   amp+cab: amp block @type 3 with @cab "cabN"; the cab entry is not a block
 *   snapshot knobs: declared once in tone.controller with the unit's snapshot controller
 *   (Stomp 9, XL 12, Floor/LT 19, HX Effects 10), plus an @value in every snapshot
 *   EXP 1 = controller 1 (wah), EXP 2 = controller 2 (volume)
 *   footswitch assignments are stored in every footswitch mode, @fs_index 1-based
 *   tempo sync is TempoSync1 + SyncSelect1 (8 = dotted eighth)
 */

const HLX_VERSION = 6;
const HLX_APP_VERSION = 58720256; // 0x03800000 = firmware 3.80
const HLX_BUILD_SHA = "v3.80";
const EXP1 = 1;
const EXP2 = 2;

function exportProfile(model: StompModelId) {
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

function unitFamily(model: StompModelId): HxUnitFamily {
  if (model === "helix-floor") return "floor";
  if (model === "helix-lt") return "lt";
  if (model === "hx-effects") return "effects";
  return "stomp";
}

const SKIP_CATEGORIES = new Set<CategoryId>(["mic", "ir"]);
const SKIP_MODELS = new Set(["split-y", "split-a-b", "crossover-split", "merge", "impulse-response", ...UNEXPORTABLE_MODELS]);
const AMP_CAB = new Set<CategoryId>(["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"]);

/** HX Edit @type integers from real exports (HX Edit corrects a wrong one on import). */
function blockType(category: CategoryId, hasCab: boolean): number {
  if (category === "amp-guitar" || category === "amp-bass") return hasCab ? 3 : 1;
  if (category === "preamp") return 2;
  if (category === "cab") return 4;
  if (category === "ir") return 5;
  if (category === "looper") return 6;
  if (category === "delay" || category === "reverb") return 7;
  return 0;
}

function isAmpCategory(category: CategoryId | undefined): boolean {
  return category === "amp-guitar" || category === "amp-bass";
}

type Slot = { block: StompBlock; hid: string; cab?: { block: StompBlock; hid: string }; irIndex?: number };

/** HX Edit's IR block (catalog "IR 1024", knob "Index" = IR Select 1–128). */
export const HX_IR_MODEL = "HD2_ImpulseResponse1024";

export type ExportOpts = { fsMode?: HlxFsMode; irSlot?: number | null };

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

/** Stored setting, read only in the browser (export stays pure in tests and on the server). */
function storedIrSlot(): number | null {
  try {
    return loadSettings().irSlot;
  } catch {
    return null;
  }
}

function withStoredIr(opts?: ExportOpts): ExportOpts {
  return opts && "irSlot" in opts ? opts : { ...opts, irSlot: storedIrSlot() };
}

/**
 * Blocks that go into the file, in signal order. An amp and the cab right after it are one slot
 * (the cab entry is not a block and does not count toward the unit's block limit).
 */
export function exportSlots(preset: Preset, opts?: { irSlot?: number | null }): { slots: Slot[]; dropped: StompBlock[] } {
  const irIndex = userIrSlot(preset, opts?.irSlot);
  preset = applyRouting(preset);
  const device = exportProfile(preset.stompModel);
  const family = unitFamily(preset.stompModel);
  const dropped: StompBlock[] = [];
  const usable: Array<{ block: StompBlock; hid: string }> = [];
  for (const b of sortedBlocks(preset)) {
    const model = MODEL_MAP[b.modelId];
    const hid = helixIdFor(b.modelId);
    const ok =
      model &&
      !SKIP_CATEGORIES.has(model.category) &&
      !SKIP_MODELS.has(b.modelId) &&
      (device.hasAmpCab || !AMP_CAB.has(model.category)) &&
      hid &&
      isHxStompModelId(hid) &&
      hxModelOnUnit(hid, family);
    if (ok && hid) usable.push({ block: b, hid });
    else dropped.push(b);
  }
  const slots: Slot[] = [];
  for (const item of usable) {
    const category = MODEL_MAP[item.block.modelId]?.category;
    const prev = slots[slots.length - 1];
    if (category === "cab" && irIndex !== undefined && hxModelOnUnit(HX_IR_MODEL, family)) {
      // The player's IR replaces the stock cab. It is its own block (the amp loses @cab).
      slots.push({ block: item.block, hid: HX_IR_MODEL, irIndex });
      continue;
    }
    if (category === "cab" && prev && isAmpCategory(MODEL_MAP[prev.block.modelId]?.category) && !prev.cab) {
      prev.cab = item;
      continue;
    }
    slots.push({ block: item.block, hid: item.hid });
  }
  const max = device.maxBlocks;
  if (slots.length > max) {
    // Keep the amp+cab; drop from the end of the effects first.
    // Keep the amp and the player's IR; drop from the end of the effects first.
    const keep: Slot[] = [];
    const essential = (s: Slot) => isAmpCategory(MODEL_MAP[s.block.modelId]?.category) || s.irIndex !== undefined;
    for (let i = 0; i < slots.length; i++) {
      const remaining = max - keep.length;
      const essentialsAhead = slots.slice(i + 1).filter(essential).length;
      if (remaining <= 0 || (!essential(slots[i]) && remaining <= essentialsAhead)) {
        dropped.push(slots[i].block, ...(slots[i].cab ? [slots[i].cab!.block] : []));
        continue;
      }
      keep.push(slots[i]);
    }
    return { slots: keep, dropped };
  }
  return { slots, dropped };
}

/** Blocks the player will not get on this unit (unknown on the unit, or over the block limit). */
export function droppedOnExport(preset: Preset, opts?: { irSlot?: number | null }): StompBlock[] {
  return exportSlots(preset, opts).dropped.filter((b) => {
    const category = MODEL_MAP[b.modelId]?.category;
    return category !== "mic" && !SKIP_MODELS.has(b.modelId);
  });
}

function snapshotLed(color: string): number {
  const c = color.toLowerCase();
  if (c.includes("e24a") || c.includes("ff5a") || c.includes("red")) return 1;
  if (c.includes("ff7a") || c.includes("ffb0") || c.includes("orange")) return 2;
  if (c.includes("f5d0") || c.includes("c6e8") || c.includes("yellow")) return 3;
  if (c.includes("22e0") || c.includes("7d9a") || c.includes("9bbf") || c.includes("green")) return 4;
  if (c.includes("2ec8") || c.includes("turquoise") || c.includes("cyan")) return 5;
  if (c.includes("b48c") || c.includes("blue")) return 6;
  if (c.includes("e050") || c.includes("ff5a9a") || c.includes("purple")) return 7;
  return 8;
}

function fsLed(color: string): number {
  return snapshotLed(color) * 65536;
}

function usesSnapshotMode(preset: Preset): boolean {
  const snaps = preset.footswitches.filter((f) => f.action === "snapshot").length;
  const stomps = preset.footswitches.filter((f) => f.action === "bypass").length;
  return snaps > 0 && snaps >= stomps;
}

type HlxJson = Record<string, unknown>;

function ioBlocks(deviceId: StompModelId): HlxJson {
  const d = exportProfile(deviceId);
  const inputA = d.inputModel ?? "HelixStomp_AppDSPFlowInput";
  const inputB = d.inputModelB ?? inputA;
  const outputA = d.outputModel ?? "HelixStomp_AppDSPFlowOutputMain";
  const outputB = d.outputSend ?? outputA;
  // HX Effects inputs carry no gate (the unit has no guitar-in gate); Stomp/Helix inputs do.
  const gate = inputA.startsWith("HelixFx_") ? {} : { noiseGate: false, decay: 0.5, threshold: -48 };
  const out: HlxJson = {
    inputA: { "@input": 1, "@model": inputA, ...gate },
    inputB: { "@input": 0, "@model": inputB, ...gate },
    outputA: { "@model": outputA, "@output": 1, pan: 0.5, gain: 0 },
    outputB: { "@model": outputB, "@output": 0, pan: 0.5, gain: 0 },
  };
  if (outputB === "HelixStomp_AppDSPFlowOutputSend") (out.outputB as HlxJson).Type = true;
  return out;
}

/** State the unit loads first: block bypass and knob values come from snapshot 1. */
function loadedOverrides(preset: Preset, block: StompBlock): Record<string, number> | undefined {
  return preset.snapshots[0]?.paramOverrides?.[block.id];
}

function loadedEnabled(preset: Preset, block: StompBlock): boolean {
  return snapshotEnables(preset, preset.snapshots[0], block);
}

/**
 * IR block knobs, native: Index is the slot itself (never through the 0–10 mapping), Level and
 * Mix stay at HX Edit's defaults, Low/High Cut carry over from the cab they replace.
 */
function irParams(cab: StompBlock, index: number): NativeParams {
  const m = hxModel(HX_IR_MODEL)!;
  const fromCab = blockNativeParams(cab);
  const out: NativeParams = {};
  for (const p of m.params) {
    let v: number | boolean = p.def;
    if ((p.key === "LowCut" || p.key === "HighCut") && typeof fromCab[p.key] === "number") {
      v = Math.max(p.min, Math.min(p.max, fromCab[p.key] as number));
    }
    if (p.key === "Index") v = index;
    out[p.key] = v;
  }
  return out;
}

function buildDsp(preset: Preset, slots: Slot[]) {
  const device = exportProfile(preset.stompModel);
  const dsp: HlxJson = ioBlocks(preset.stompModel);
  let cabIndex = 0;
  slots.forEach((slot, i) => {
    const model = MODEL_MAP[slot.block.modelId]!;
    const native = slot.irIndex !== undefined ? irParams(slot.block, slot.irIndex) : blockNativeParams(slot.block, loadedOverrides(preset, slot.block));
    const isAmp = isAmpCategory(model.category);
    const hlx: HlxJson = {
      "@model": slot.hid,
      "@position": i,
      "@enabled": loadedEnabled(preset, slot.block),
      "@path": 0,
      "@type": slot.irIndex !== undefined ? blockType("ir", false) : blockType(model.category, Boolean(slot.cab)),
      "@no_snapshot_bypass": false,
    };
    if (!isAmp) hlx["@stereo"] = false;
    if (model.category === "delay" || model.category === "reverb") hlx["@trails"] = true;
    if (isAmp) hlx["@bypassvolume"] = 1;
    if (slot.cab) {
      const key = `cab${cabIndex++}`;
      hlx["@cab"] = key;
      const cabParams = blockNativeParams(slot.cab.block);
      const cab: HlxJson = { "@model": slot.cab.hid, "@enabled": true, ...cabParams };
      if (!hxModel(slot.cab.hid)?.byKey.Mic) cab["@mic"] = legacyMicIndex(slot.cab.block);
      dsp[key] = cab;
    }
    dsp[`block${i}`] = { ...hlx, ...native };
  });
  dsp.split = {
    "@model": "HD2_AppDSPFlowSplitY",
    "@enabled": true,
    "@no_snapshot_bypass": false,
    bypass: false,
    "@position": 0,
    BalanceA: 0.5,
    BalanceB: 0.5,
  };
  dsp.join = {
    "@model": "HD2_AppDSPFlowJoin",
    "@enabled": true,
    "@no_snapshot_bypass": false,
    "@position": device.joinPosition ?? 8,
    Level: 0,
    "A Level": 0,
    "B Level": 0,
    "A Pan": 0.5,
    "B Pan": 0.5,
    "B Polarity": false,
  };
  return dsp;
}

function snapshotBlockStates(preset: Preset, snap: Snapshot | undefined, slots: Slot[]): Record<string, boolean> {
  const states: Record<string, boolean> = {};
  slots.forEach((slot, i) => {
    states[`block${i}`] = snapshotEnables(preset, snap, slot.block);
  });
  return states;
}

type Assigned = { uiName: string; key: string; min: number; max: number };

/**
 * Knobs that change across snapshots. Each is declared once on the unit's snapshot controller
 * and given an @value in every snapshot (a snapshot without one recalls the wrong value).
 */
function collectAssigned(preset: Preset, slots: Slot[], snapCount: number): Map<number, Assigned[]> {
  const snaps = preset.snapshots.slice(0, snapCount);
  const out = new Map<number, Assigned[]>();
  slots.forEach((slot, i) => {
    if (slot.irIndex !== undefined) return;
    const uiNames = new Set<string>();
    for (const snap of snaps) for (const n of Object.keys(snap.paramOverrides?.[slot.block.id] ?? {})) uiNames.add(n);
    const list: Assigned[] = [];
    for (const uiName of uiNames) {
      for (const key of resolveParamKeys(slot.block.modelId, uiName)) {
        const p = hxModel(slot.hid)?.byKey[key];
        if (!p || p.type === "b") continue;
        const values = new Set<string>();
        for (const snap of snaps) {
          const raw = snap.paramOverrides?.[slot.block.id]?.[uiName] ?? slot.block.params[uiName];
          if (typeof raw !== "number") continue;
          values.add(JSON.stringify(nativeFor(slot.block.modelId, key, uiName, raw)));
        }
        if (values.size < 2) continue;
        list.push({ uiName, key, min: p.min, max: p.max });
      }
    }
    if (list.length) out.set(i, list);
  });
  return out;
}

function snapshotControllers(snap: Snapshot | undefined, slots: Slot[], assigned: Map<number, Assigned[]>) {
  const controllers: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number | boolean }>> = {};
  for (const [i, list] of assigned) {
    const slot = slots[i];
    const native: NativeParams = blockNativeParams(slot.block, snap?.paramOverrides?.[slot.block.id]);
    const params: Record<string, { "@fs_enabled": boolean; "@value": number | boolean }> = {};
    for (const item of list) {
      const v = native[item.key];
      if (v !== undefined) params[item.key] = { "@fs_enabled": false, "@value": v };
    }
    if (Object.keys(params).length) controllers[`block${i}`] = params;
  }
  return controllers;
}

/** EXP 1 sweeps a wah or whammy; EXP 2 runs the volume pedal (EXP 1 on a one-pedal Stomp rig with no wah). */
function buildControllerSection(preset: Preset, slots: Slot[], assigned: Map<number, Assigned[]>) {
  const device = exportProfile(preset.stompModel);
  const controller: { dsp0: HlxJson; dsp1: HlxJson } = { dsp0: {}, dsp1: {} };
  const snapCtl = device.snapshotController ?? 9;
  for (const [i, list] of assigned) {
    const slot = (controller.dsp0[`block${i}`] as HlxJson) ?? {};
    for (const item of list) {
      slot[item.key] = { "@min": item.min, "@max": item.max, "@controller": snapCtl, "@snapshot_disable": false };
    }
    controller.dsp0[`block${i}`] = slot;
  }
  const pedalIdx = (pred: (s: Slot) => boolean) => slots.findIndex(pred);
  const wahIdx = pedalIdx((s) => MODEL_MAP[s.block.modelId]?.category === "wah");
  const whamIdx = pedalIdx((s) => /Wham|Whammy/.test(s.hid) && Boolean(hxModel(s.hid)?.byKey.Position || hxModel(s.hid)?.byKey.Pedal));
  const volIdx = pedalIdx((s) => s.block.modelId === "volume-pedal");
  const assign = (idx: number, ctl: number) => {
    if (idx < 0) return;
    const m = hxModel(slots[idx].hid);
    const key = m?.byKey.Pedal ? "Pedal" : m?.byKey.Position ? "Position" : undefined;
    if (!key) return;
    const slot = (controller.dsp0[`block${idx}`] as HlxJson) ?? {};
    slot[key] = { "@min": m!.byKey[key].min, "@max": m!.byKey[key].max, "@controller": ctl, "@snapshot_disable": false };
    controller.dsp0[`block${idx}`] = slot;
  };
  const exp1 = wahIdx >= 0 ? wahIdx : whamIdx;
  assign(exp1, EXP1);
  const builtInPedal = Boolean(device.toeSwitchFs) || preset.stompModel === "pod-go";
  assign(volIdx, exp1 >= 0 || builtInPedal ? EXP2 : EXP1);
  return controller;
}

type HlxFsMode = "stomp" | "snapshot" | "preset";

function resolveFsMode(preset: Preset, requested?: HlxFsMode): HlxFsMode {
  if (requested === "stomp" || requested === "snapshot" || requested === "preset") return requested;
  if (preset.exportFsMode === "stomp" || preset.exportFsMode === "snapshot") return preset.exportFsMode;
  return usesSnapshotMode(preset) ? "snapshot" : "stomp";
}

function pedalstateFor(mode: HlxFsMode): number {
  if (mode === "snapshot") return 2;
  if (mode === "preset") return 1;
  return 0;
}

function sanitizeLabel(s: string, max: number) {
  const clean = s.replace(/[^\w\s+\-.'&]/g, " ").replace(/\s+/g, " ").trim();
  return (clean || "Stomp Lab").slice(0, max);
}

/** Stomp switch assignments. HX stores them in every footswitch mode; they act whenever stomps are showing. */
function buildFootswitch(preset: Preset, slots: Slot[]) {
  const device = exportProfile(preset.stompModel);
  const footswitch: { dsp0: HlxJson; dsp1: HlxJson } = { dsp0: {}, dsp1: {} };
  const spec = unitSpec(deviceFor(preset).layout);
  // TAP, MODE and the bank switches, unless the unit also uses that switch for stomps (XL FS1/FS4).
  const reserved = new Set(
    [spec.mode, spec.tap, spec.up, spec.down].filter((n): n is number => typeof n === "number" && !spec.stompFs.includes(n)),
  );
  for (const fs of preset.footswitches) {
    if (fs.action !== "bypass" || !fs.targetBlockId) continue;
    // Never put an effect on a switch the unit keeps for TAP, MODE or BANK.
    if (reserved.has(fs.index)) continue;
    const idx = slots.findIndex((s) => s.block.id === fs.targetBlockId);
    if (idx < 0) continue;
    const model = MODEL_MAP[slots[idx].block.modelId];
    footswitch.dsp0[`block${idx}`] = {
      "@fs_enabled": true,
      "@fs_index": visualToHardwareFs(fs.index, preset.stompModel === "hx-stomp-xl"),
      "@fs_label": sanitizeLabel(fs.label || model?.name || "FX", 16),
      "@fs_ledcolor": fsLed(fs.color),
      "@fs_momentary": false,
      "@fs_primary": true,
    };
  }
  // Built-in pedal toe switch turns the wah on and off, as on the factory presets.
  if (device.toeSwitchFs) {
    const wahIdx = slots.findIndex((s) => MODEL_MAP[s.block.modelId]?.category === "wah");
    if (wahIdx >= 0 && !footswitch.dsp0[`block${wahIdx}`]) {
      footswitch.dsp0[`block${wahIdx}`] = {
        "@fs_enabled": true,
        "@fs_index": device.toeSwitchFs,
        "@fs_label": "WAH",
        "@fs_ledcolor": fsLed("orange"),
        "@fs_momentary": false,
        "@fs_primary": true,
      };
    }
  }
  return footswitch;
}

function snapshotJson(
  name: string,
  custom: boolean,
  led: number,
  tempo: number,
  states: Record<string, boolean>,
  controllers: Record<string, unknown>,
) {
  return {
    "@name": name,
    "@tempo": tempo,
    "@valid": true,
    "@pedalstate": 0,
    "@ledcolor": led,
    "@custom_name": custom,
    blocks: { dsp0: states },
    controllers: { dsp0: controllers },
  };
}

export function buildHlx(preset: Preset, opts?: ExportOpts): HlxJson {
  const irSlot = userIrSlot(preset, opts?.irSlot);
  // The player's rig (SL-62): no amp/cab in front of a real amp, an FX Loop for 4-cable, no cab into a power amp.
  // A boost switch a solo turns on is written on the block (switches are not snapshot knobs).
  preset = liftSnapshotSwitches(sanitizeSnapshots(applyRouting(preset)));
  const device = exportProfile(preset.stompModel);
  const ext = exportExtension(preset.stompModel);
  if (!ext || !device.hlxDeviceId) {
    throw new Error(`${device.name} does not use .hlx or .pgp. We will not write a fake Helix file.`);
  }
  if (ext === "pgp") return buildPgp(preset, opts);
  const { slots } = exportSlots(preset, { irSlot });
  const dsp = buildDsp(preset, slots);
  const snapCount = device.snapshots;
  const tempo = Math.max(40, Math.min(240, Math.round(preset.tempo || 120)));
  const mode = resolveFsMode(preset, opts?.fsMode);
  const assigned = collectAssigned(preset, slots, snapCount);

  const tone: HlxJson = {
    dsp0: dsp,
    dsp1: {},
    controller: buildControllerSection(preset, slots, assigned),
    footswitch: buildFootswitch(preset, slots),
    global: {
      "@model": "@global_params",
      "@topology0": "A",
      "@topology1": device.topology1 ?? 0,
      "@cursor_dsp": 0,
      "@cursor_path": 0,
      "@cursor_position": 0,
      "@cursor_group": slots.length ? "block0" : "inputA",
      "@tempo": tempo,
      "@current_snapshot": 0,
      "@pedalstate": pedalstateFor(mode),
      "@guitarpad": 0,
      "@guitarinputZ": 0,
    },
  };

  const real = preset.snapshots.slice(0, snapCount);
  for (let i = 0; i < snapCount; i++) {
    const snap = real[i];
    if (snap) {
      const name = sanitizeLabel(snap.name, 12).toUpperCase();
      tone[`snapshot${i}`] = snapshotJson(
        name,
        true,
        snapshotLed(snap.color),
        tempo,
        snapshotBlockStates(preset, snap, slots),
        snapshotControllers(snap, slots, assigned),
      );
    } else {
      // Unused switch: same sound as snapshot 1, shown with the unit's default "SNAPSHOT n" name.
      tone[`snapshot${i}`] = snapshotJson(
        `SNAPSHOT ${i + 1}`,
        false,
        0,
        tempo,
        snapshotBlockStates(preset, real[0], slots),
        snapshotControllers(real[0], slots, assigned),
      );
    }
  }

  return {
    version: HLX_VERSION,
    data: {
      device: device.hlxDeviceId,
      device_version: HLX_APP_VERSION,
      meta: {
        name: sanitizeLabel(preset.name || "Stomp Lab", 16),
        application: "HX Edit",
        build_sha: HLX_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: HLX_APP_VERSION,
      },
      tone,
    },
    meta: { original: 0, pbn: 0, premium: 0 },
    schema: "L6Preset",
  };
}

/** What a player hears as a blank preset once the file is on the unit. */
export function inaudibleExport(preset: Preset): string[] {
  if (!canExportHlx(preset.stompModel)) return [];
  let hlx: HlxJson;
  try {
    hlx = buildHlx(preset);
  } catch (err) {
    return [`export failed: ${err instanceof Error ? err.message : "unknown"}`];
  }
  const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
  const dsp0 = (tone.dsp0 ?? {}) as Record<string, Record<string, unknown>>;
  const reasons: string[] = [];
  const blocks = Object.entries(dsp0).filter(([k]) => /^block\d+$/.test(k));
  if (!blocks.length) reasons.push("path has no blocks");

  for (const [key, block] of blocks) {
    const model = String(block["@model"] ?? "");
    if (model === "HD2_GateHardGate") {
      const open = Number(block.OpenThreshold);
      const close = Number(block.CloseThreshold);
      const level = Number(block.Level);
      if (!(open <= -24 && open >= -96)) reasons.push(`${key} hard gate OpenThreshold ${open} stays shut`);
      if (!(close < open)) reasons.push(`${key} hard gate CloseThreshold ${close} is not below open`);
      if (!(level >= -6)) reasons.push(`${key} hard gate Level ${level} is muted`);
    }
    if (model === "HD2_GateNoiseGate") {
      const threshold = Number(block.Threshold);
      const level = Number(block.Level);
      if (!(threshold <= -18 && threshold >= -96)) reasons.push(`${key} noise gate Threshold ${threshold}`);
      if (!(level >= -6)) reasons.push(`${key} noise gate Level ${level} is muted`);
    }
  }

  // In front of a real amp the amp is bypassed on purpose (POD Go keeps its fixed amp slot, off).
  const ampKey = removesAmp(routeFor(preset.playbackTarget))
    ? undefined
    : blocks.find(([, b]) => /^HD2_Amp/.test(String(b["@model"] ?? "")))?.[0];
  const cabKeys = blocks.filter(([, b]) => Number(b["@type"]) === 4).map(([k]) => k);
  for (const snapKey of Object.keys(tone).filter((k) => /^snapshot\d+$/.test(k))) {
    const snap = tone[snapKey] as { "@valid"?: boolean; "@name"?: string; blocks?: { dsp0?: Record<string, boolean> } };
    if (snap["@valid"] !== true) reasons.push(`${snapKey} is a blank slot`);
    if (!String(snap["@name"] ?? "").trim()) reasons.push(`${snapKey} has no name`);
    const states = snap.blocks?.dsp0 ?? {};
    if (ampKey && states[ampKey] === false) reasons.push(`${snapKey} amp is bypassed`);
    for (const cab of cabKeys) if (states[cab] === false) reasons.push(`${snapKey} cab is bypassed`);
  }
  return reasons;
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

export function hlxJson(preset: Preset, opts?: ExportOpts): string {
  return JSON.stringify(buildHlx(preset, withStoredIr(opts)), null, 2);
}

export function downloadHlx(preset: Preset, opts?: ExportOpts): boolean {
  if (!canExportHlx(preset.stompModel)) return false;
  let json: string;
  try {
    json = hlxJson(preset, opts);
  } catch {
    return false;
  }
  const blob = new Blob([json], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = hlxFilename(preset);
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export async function copyHlx(preset: Preset, opts?: ExportOpts): Promise<void> {
  if (!canExportHlx(preset.stompModel)) {
    throw new Error("This unit does not export a preset file.");
  }
  const json = hlxJson(preset, opts);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(json);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = json;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}
