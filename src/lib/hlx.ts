import { MODEL_MAP } from "@/data/catalog";
import { helixIdFor } from "@/data/helix-ids";
import type { CategoryId, Preset, Snapshot, StompBlock } from "@/data/types";
import { sortedBlocks, visualToHardwareFs } from "./preset-utils";

/**
 * HX Edit .hlx is L6Preset JSON. Layout taken from real HX Stomp dumps
 * (mattbreit/hxstomp Metallica.hlx + MetalMilitia.hlx, vesco factory
 * Cali IV Rhythm 2.hlx, sensorium/phelix block JSON, helix-stadium-tools
 * model-index 2026-05-07):
 *   version 6 / schema L6Preset
 *   device 2162694 (Stomp) / 2162699 (XL)
 *   dsp0.inputA/B HelixStomp_AppDSPFlowInput
 *   dsp0.outputA HelixStomp_AppDSPFlowOutputMain
 *   amp @type 3 + @cab cab0 using classic HD2_Cab* (NOT CabMicIr_*)
 *   snapshots include dsp0.blockN + split:true
 *   global @pedalstate 2 = Snapshot mode (FS1–FS3 recall snaps)
 *   snapshot @pedalstate 0 even when global is 2 (factory files)
 *   @fs_index is 1-based
 *   @type is an integer, never a string
 */

const DEVICE_IDS = {
  "hx-stomp": 2162694,
  "hx-stomp-xl": 2162699,
} as const;

const HLX_VERSION = 6;
const HLX_APP_VERSION = 58720256; // 0x03800000 = firmware 3.80
const HLX_BUILD_SHA = "v3.80";
const STOMP_SNAPSHOT_CONTROLLER = 9;
const STOMP_MAX_SNAPSHOTS = { "hx-stomp": 3, "hx-stomp-xl": 4 } as const;

const INPUT_MODEL = "HelixStomp_AppDSPFlowInput";
const OUTPUT_MAIN = "HelixStomp_AppDSPFlowOutputMain";
const OUTPUT_SEND = "HelixStomp_AppDSPFlowOutputSend";

const SKIP_CATEGORIES = new Set<CategoryId>(["mic"]);
const SKIP_MODELS = new Set(["split-y", "split-a-b", "crossover-split", "merge"]);

/** HX Edit @type integers from factory .hlx. Strings like "amp" are rejected. */
function blockType(category: CategoryId, isAmp: boolean, hasCab: boolean): number {
  if (isAmp) return hasCab ? 3 : 1;
  if (category === "cab") return 4;
  if (category === "ir") return 5;
  if (category === "looper") return 6;
  if (category === "delay" || category === "reverb") return 7;
  if (category === "send-return") return 9;
  return 0;
}

/**
 * UI knob names → real HX Edit parameter names from phelix Defaults /
 * factory .hlx (Scream 808: Gain/Tone/Level; 70s Chorus: ChorusIntensity /
 * VibratoRate / Mix / Mode; Stupor OD: Drive/Tone/Level).
 */
const PARAM_RENAMES: Record<string, Record<string, string>> = {
  "scream-808": { Drive: "Gain", Treble: "Tone", Output: "Level" },
  "stupor-od": { Treble: "Tone", Output: "Level" },
  "vermin-dist": { Drive: "Distortion", Treble: "Filter", Output: "Volume" },
  minotaur: { Drive: "Gain", Output: "Level" },
  "heir-apparent": { Drive: "Gain", Output: "Level" },
  "deluxe-comp": { Gain: "Level" },
  "kinky-comp": { Threshold: "Sensitivity", Gain: "Level" },
  "bighorn-fuzz": { Drive: "Sustain", Treble: "Tone", Output: "Volume" },
  "triangle-fuzz": { Drive: "Sustain", Treble: "Tone", Output: "Volume" },
  "knuckle-dragon": { Drive: "Gain", Output: "Level" },
  "uk-wah-846": { "Dc Bias": "DcBias" },
  "70s-chorus": { Depth: "ChorusIntensity", Rate: "VibratoRate" },
};

const DROP_BY_MODEL: Record<string, Set<string>> = {
  "stupor-od": new Set(["Bass", "Mid", "Mix"]),
  "scream-808": new Set(["Bass", "Mid", "Mix"]),
  "70s-chorus": new Set(["Tone"]),
  "kinky-comp": new Set(["Attack", "Release", "Mix"]),
};

const GENERIC_RENAME: Record<string, string> = {
  "Ch Vol": "ChVol",
  "Low Cut": "LowCut",
  "High Cut": "HighCut",
  Predelay: "PreDelay",
  "Early Refl": "EarlyReflections",
  "Thr Low": "ThrLow",
  "Thr Mid": "ThrMid",
  "Thr High": "ThrHigh",
  "Dc Bias": "DcBias",
  "Vol Min": "VolumeMin",
  "Vol Max": "VolumeMax",
};

/** Params HX Edit will reject or ignore as unknown on most blocks. */
const DROP_PARAMS = new Set(["Mix", "Mic"]);

const KEEP_MIX = new Set<CategoryId>(["modulation", "delay", "reverb", "filter", "wah"]);

type HlxJson = Record<string, unknown>;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function exportableBlocks(preset: Preset): StompBlock[] {
  return sortedBlocks(preset).filter((b) => {
    const model = MODEL_MAP[b.modelId];
    if (!model) return false;
    if (SKIP_CATEGORIES.has(model.category)) return false;
    if (SKIP_MODELS.has(b.modelId)) return false;
    return Boolean(helixIdFor(b.modelId));
  });
}

function helixParamName(modelId: string, uiName: string): string {
  return PARAM_RENAMES[modelId]?.[uiName] ?? GENERIC_RENAME[uiName] ?? uiName.replace(/\s+/g, "");
}

function toHlxValue(
  modelId: string,
  uiName: string,
  value: number,
  category: CategoryId,
): number | boolean | undefined {
  if (uiName === "Mic") return undefined;
  const n = Number.isFinite(value) ? value : 5;
  if (uiName === "Low Cut" || uiName === "LowCut") {
    return Math.round(20 + clamp01(n / 10) * 480);
  }
  if (uiName === "High Cut" || uiName === "HighCut") {
    return Math.round(1500 + clamp01(n / 10) * 18600);
  }
  if (category === "cab" && uiName === "Distance") {
    return 1 + clamp01(n / 10) * 11;
  }
  if (uiName === "Scale") {
    return Math.max(0, Math.min(10, Math.round(n)));
  }
  if (
    (modelId === "noise-gate" || modelId === "hard-gate" || modelId === "horizon-gate") &&
    uiName === "Threshold"
  ) {
    return -80 + clamp01(n / 10) * 72;
  }
  if (modelId === "deluxe-comp" && uiName === "Threshold") {
    return -60 + clamp01(n / 10) * 48;
  }
  return clamp01(n / 10);
}

function knownParamNames(modelId: string): Set<string> | null {
  const model = MODEL_MAP[modelId];
  if (!model?.params?.length) return null;
  return new Set(model.params);
}

function blockParams(block: StompBlock): Record<string, number | boolean> {
  const model = MODEL_MAP[block.modelId];
  const category = model?.category ?? "distortion";
  const allowed = knownParamNames(block.modelId);
  const dropModel = DROP_BY_MODEL[block.modelId];
  const out: Record<string, number | boolean> = {};
  for (const [uiName, raw] of Object.entries(block.params)) {
    if (dropModel?.has(uiName)) continue;
    if (DROP_PARAMS.has(uiName) && !KEEP_MIX.has(category)) continue;
    if (allowed && !allowed.has(uiName)) continue;
    const value = toHlxValue(block.modelId, uiName, raw, category);
    if (value === undefined) continue;
    out[helixParamName(block.modelId, uiName)] = value;
  }
  if (category === "delay" || category === "reverb") {
    out.Level = out.Level ?? 0;
  }
  if (category === "amp-guitar" || category === "amp-bass") {
    out.Hum = out.Hum ?? 0.05;
    out.Ripple = out.Ripple ?? 0.05;
    out.Bias = out.Bias ?? 0.5;
    out.BiasX = out.BiasX ?? 0.5;
  }
  if (block.modelId.startsWith("cali-iv")) {
    // Factory Cali IV Rhythm 2.hlx graphic bands, 0 dB default.
    out["80Hz"] = out["80Hz"] ?? 0;
    out["240Hz"] = out["240Hz"] ?? 0;
    out["750Hz"] = out["750Hz"] ?? 0;
    out["2200Hz"] = out["2200Hz"] ?? 0;
    out["6600Hz"] = out["6600Hz"] ?? 0;
  }
  if (block.modelId === "70s-chorus") {
    out.ChorusIntensity = out.ChorusIntensity ?? 0.57;
    out.VibratoRate = out.VibratoRate ?? 0.34;
    out.VibratoDepth = 0.5;
    out.Mix = out.Mix ?? 0.5;
    out.Mode = false;
    out.Headroom = 0;
  }
  return out;
}

function micIndex(block: StompBlock): number {
  const raw = block.params.Mic;
  if (typeof raw !== "number") return 0;
  return Math.max(0, Math.min(12, Math.round(raw)));
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

function buildDsp(blocks: StompBlock[]) {
  const cabs = blocks.filter((b) => MODEL_MAP[b.modelId]?.category === "cab");
  const others = blocks.filter((b) => MODEL_MAP[b.modelId]?.category !== "cab");
  const hasCab = cabs.length > 0;

  const dsp: HlxJson = {
    inputA: {
      "@input": 1,
      "@model": INPUT_MODEL,
      noiseGate: false,
      decay: 0.5,
      threshold: -48.0,
    },
    inputB: {
      "@input": 0,
      "@model": INPUT_MODEL,
      noiseGate: false,
      decay: 0.5,
      threshold: -48.0,
    },
    outputA: {
      "@model": OUTPUT_MAIN,
      "@output": 1,
      pan: 0.5,
      gain: 0.0,
    },
    outputB: {
      "@model": OUTPUT_SEND,
      "@output": 0,
      pan: 0.5,
      gain: 0.0,
    },
  };

  cabs.forEach((cab, i) => {
    const params = blockParams(cab);
    dsp[`cab${i}`] = {
      "@model": helixIdFor(cab.modelId),
      "@enabled": cab.enabled,
      "@mic": micIndex(cab),
      LowCut: params.LowCut ?? 20,
      HighCut: params.HighCut ?? 20100,
      Distance: params.Distance ?? 1,
      EarlyReflections: params.EarlyReflections ?? 0,
      Level: 0.0,
    };
  });

  others.forEach((block, i) => {
    const model = MODEL_MAP[block.modelId]!;
    const isAmp = model.category === "amp-guitar" || model.category === "amp-bass";
    const hlx: HlxJson = {
      "@model": helixIdFor(block.modelId),
      "@position": i,
      "@enabled": block.enabled,
      "@path": 0,
      "@type": blockType(model.category, isAmp, hasCab),
      "@stereo": false,
      "@no_snapshot_bypass": false,
      ...blockParams(block),
    };
    if (model.category === "delay" || model.category === "reverb") {
      hlx["@trails"] = true;
    }
    if (isAmp) {
      hlx["@bypassvolume"] = 1;
      if (hasCab) hlx["@cab"] = "cab0";
    }
    dsp[`block${i}`] = hlx;
  });

  dsp.split = {
    "@model": "HD2_AppDSPFlowSplitY",
    "@enabled": true,
    "@position": 0,
    BalanceA: 0.5,
    BalanceB: 0.5,
  };
  dsp.join = {
    "@model": "HD2_AppDSPFlowJoin",
    "@enabled": true,
    "@position": others.length,
    Level: 0,
    "A Level": 0,
    "B Level": 0,
    "A Pan": 0.5,
    "B Pan": 0.5,
    "B Polarity": false,
  };

  return { dsp, others, cabs };
}

function snapshotBlockStates(
  snap: Snapshot | undefined,
  others: StompBlock[],
): Record<string, boolean> {
  const states: Record<string, boolean> = { split: true };
  others.forEach((block, i) => {
    const enabled = snap?.enabledBlocks?.length
      ? snap.enabledBlocks.includes(block.id)
      : block.enabled;
    states[`block${i}`] = enabled;
  });
  return states;
}

function snapshotControllers(
  snap: Snapshot | undefined,
  others: StompBlock[],
): Record<string, Record<string, { "@fs_enabled": boolean; "@value": number | boolean }>> {
  const controllers: Record<
    string,
    Record<string, { "@fs_enabled": boolean; "@value": number | boolean }>
  > = {};
  if (!snap?.paramOverrides) return controllers;
  others.forEach((block, i) => {
    const over = snap.paramOverrides?.[block.id];
    if (!over) return;
    const model = MODEL_MAP[block.modelId];
    const category = model?.category ?? "distortion";
    const dropModel = DROP_BY_MODEL[block.modelId];
    const params: Record<string, { "@fs_enabled": boolean; "@value": number | boolean }> = {};
    for (const [uiName, raw] of Object.entries(over)) {
      if (dropModel?.has(uiName)) continue;
      const value = toHlxValue(block.modelId, uiName, raw, category);
      if (value === undefined) continue;
      params[helixParamName(block.modelId, uiName)] = { "@fs_enabled": false, "@value": value };
    }
    if (Object.keys(params).length) controllers[`block${i}`] = params;
  });
  return controllers;
}

function buildControllerSection(preset: Preset, others: StompBlock[], maxSnapshots: number) {
  const controller: { dsp0: HlxJson; dsp1: HlxJson } = { dsp0: {}, dsp1: {} };
  const variations = new Map<string, Map<string, Set<number>>>();

  for (const snap of preset.snapshots.slice(0, maxSnapshots)) {
    if (!snap.paramOverrides) continue;
    others.forEach((block, i) => {
      const over = snap.paramOverrides?.[block.id];
      if (!over) return;
      const model = MODEL_MAP[block.modelId];
      const category = model?.category ?? "distortion";
      const dropModel = DROP_BY_MODEL[block.modelId];
      const key = `block${i}`;
      if (!variations.has(key)) variations.set(key, new Map());
      for (const [uiName, raw] of Object.entries(over)) {
        if (dropModel?.has(uiName)) continue;
        const value = toHlxValue(block.modelId, uiName, raw, category);
        if (typeof value !== "number") continue;
        const pname = helixParamName(block.modelId, uiName);
        if (!variations.get(key)!.has(pname)) variations.get(key)!.set(pname, new Set());
        variations.get(key)!.get(pname)!.add(value);
      }
    });
  }

  for (const [blockKey, params] of variations) {
    for (const [paramName, values] of params) {
      if (values.size < 2) continue;
      const all = [...values];
      const slot = (controller.dsp0[blockKey] as HlxJson) ?? {};
      slot[paramName] = {
        "@min": Math.min(...all),
        "@max": Math.max(...all),
        "@controller": STOMP_SNAPSHOT_CONTROLLER,
        "@snapshot_disable": false,
      };
      controller.dsp0[blockKey] = slot;
    }
  }

  const wah = others.find((b) => MODEL_MAP[b.modelId]?.category === "wah");
  if (wah) {
    const idx = others.indexOf(wah);
    const key = `block${idx}`;
    const slot = (controller.dsp0[key] as HlxJson) ?? {};
    if (!slot.Position) {
      slot.Position = { "@min": 0, "@max": 1, "@controller": 1 };
      controller.dsp0[key] = slot;
    }
  }

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

function buildFootswitch(preset: Preset, others: StompBlock[]) {
  const footswitch: { dsp0: HlxJson; dsp1: HlxJson } = { dsp0: {}, dsp1: {} };
  for (const fs of preset.footswitches) {
    if (fs.action !== "bypass" || !fs.targetBlockId) continue;
    const idx = others.findIndex((b) => b.id === fs.targetBlockId);
    if (idx < 0) continue;
    const block = others[idx];
    const model = MODEL_MAP[block.modelId];
    footswitch.dsp0[`block${idx}`] = {
      "@fs_enabled": true,
      "@fs_index": visualToHardwareFs(fs.index, preset.stompModel === "hx-stomp-xl"),
      "@fs_label": (fs.label || model?.name || "FX").slice(0, 16),
      "@fs_ledcolor": fsLed(fs.color),
      "@fs_momentary": false,
      "@fs_primary": true,
    };
  }
  return footswitch;
}

function emptySnapshot(index: number, others: StompBlock[], tempo: number) {
  const blocks: Record<string, boolean> = { split: true };
  others.forEach((_, i) => {
    blocks[`block${i}`] = true;
  });
  return {
    "@name": `SNAPSHOT ${index + 1}`,
    "@tempo": tempo,
    "@valid": false,
    "@pedalstate": 0,
    "@ledcolor": 0,
    "@custom_name": false,
    blocks: { dsp0: blocks },
    controllers: { dsp0: {} },
  };
}

export function buildHlx(preset: Preset, opts?: { fsMode?: HlxFsMode }): HlxJson {
  const blocks = exportableBlocks(preset);
  const { dsp, others } = buildDsp(blocks);
  const maxSnapshots = STOMP_MAX_SNAPSHOTS[preset.stompModel];
  const tempo = Math.max(40, Math.min(240, Math.round(preset.tempo || 120)));
  const mode = resolveFsMode(preset, opts?.fsMode);

  const tone: HlxJson = {
    dsp0: dsp,
    dsp1: {},
    controller: buildControllerSection(preset, others, maxSnapshots),
    footswitch: buildFootswitch(preset, others),
    global: {
      "@model": "@global_params",
      "@topology0": "A",
      "@topology1": 0,
      "@cursor_dsp": 0,
      "@cursor_path": 0,
      "@cursor_position": 0,
      "@cursor_group": others.length ? "block0" : "inputA",
      "@tempo": tempo,
      "@current_snapshot": 0,
      "@pedalstate": pedalstateFor(mode),
      "@guitarpad": 0,
      "@guitarinputZ": 0,
    },
  };

  for (let i = 0; i < maxSnapshots; i++) {
    const snap = preset.snapshots[i];
    const hwIndex = visualToHardwareFs(i + 1, preset.stompModel === "hx-stomp-xl");
    tone[`snapshot${i}`] = snap
      ? {
          "@name": snap.name.slice(0, 10).toUpperCase(),
          "@tempo": tempo,
          "@valid": true,
          "@pedalstate": 0,
          "@ledcolor": snapshotLed(snap.color),
          "@custom_name": true,
          "@fs_index": hwIndex,
          blocks: { dsp0: snapshotBlockStates(snap, others) },
          controllers: { dsp0: snapshotControllers(snap, others) },
        }
      : emptySnapshot(i, others, tempo);
  }

  return {
    version: HLX_VERSION,
    data: {
      device: DEVICE_IDS[preset.stompModel],
      device_version: HLX_APP_VERSION,
      meta: {
        name: (preset.name || "Stomp Lab").slice(0, 32),
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

export function hlxFilename(preset: Preset): string {
  const base =
    (preset.name || preset.song || "preset")
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 24) || "preset";
  return `${base}.hlx`;
}

export function hlxJson(preset: Preset, opts?: { fsMode?: HlxFsMode }): string {
  return JSON.stringify(buildHlx(preset, opts), null, 2);
}

export function downloadHlx(preset: Preset, opts?: { fsMode?: HlxFsMode }): boolean {
  const json = hlxJson(preset, opts);
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

export async function copyHlx(preset: Preset, opts?: { fsMode?: HlxFsMode }): Promise<void> {
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
