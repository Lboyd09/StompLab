import { DEVICE_MAP } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import { helixIdFor, isHxStompModelId, UNEXPORTABLE_MODELS } from "@/data/helix-ids";
import { factoryParamsFor } from "@/data/helix-params";
import type { CategoryId, Preset, Snapshot, StompBlock, StompModelId } from "@/data/types";
import { sortedBlocks, visualToHardwareFs } from "./preset-utils";
import { sanitizeSnapshots } from "./snapshot-sanitize";

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

const HLX_VERSION = 6;
const HLX_APP_VERSION = 58720256; // 0x03800000 = firmware 3.80
const HLX_BUILD_SHA = "v3.80";
const STOMP_SNAPSHOT_CONTROLLER = 9;

function exportProfile(model: StompModelId) {
  const d = DEVICE_MAP[model] ?? DEVICE_MAP["hx-stomp"];
  return d;
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

const SKIP_CATEGORIES = new Set<CategoryId>(["mic", "ir"]);
const SKIP_MODELS = new Set([
  "split-y",
  "split-a-b",
  "crossover-split",
  "merge",
  "impulse-response",
  ...UNEXPORTABLE_MODELS,
]);
const MAX_PATH_BLOCKS = 8;

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
 * VibratoRate / Mix / Mode; Stupor OD / Deez One: Drive/Tone/Level).
 */
const PARAM_RENAMES: Record<string, Record<string, string>> = {
  "scream-808": { Drive: "Gain", Treble: "Tone", Output: "Level" },
  "stupor-od": { Treble: "Tone", Output: "Level" },
  "deez-one-vintage": { Treble: "Tone", Output: "Level" },
  "deez-one-mod": { Treble: "Tone", Output: "Level" },
  "hedgehog-d9": { Drive: "Gain", Treble: "Tone", Output: "Level" },
  "top-secret-od": { Drive: "Gain", Output: "Level" },
  "vermin-dist": { Drive: "Gain", Treble: "Filter", Output: "Level" },
  minotaur: { Drive: "Gain", Treble: "Tone", Output: "Level" },
  "heir-apparent": { Drive: "Gain", Treble: "Tone", Output: "Level" },
  "kinky-boost": { Treble: "Bright", Output: "Boost" },
  "deluxe-comp": { Gain: "Level" },
  "kinky-comp": { Threshold: "Sensitivity", Gain: "Level" },
  "bighorn-fuzz": { Drive: "Sustain", Treble: "Tone", Output: "Level" },
  "triangle-fuzz": { Drive: "Sustain", Treble: "Tone", Output: "Level" },
  "arbitrator-fuzz": { Drive: "Fuzz", Output: "Level" },
  "pocket-fuzz": { Output: "Level" },
  "tycoctavia-fuzz": { Drive: "Fuzz", Output: "Level" },
  "compulsive-drive": { Drive: "Gain", Treble: "Tone", Output: "Level" },
  "valve-driver": { Drive: "Gain", Output: "Level" },
  "swedish-chainsaw": { Output: "Level" },
  "legendary-drive": { Output: "Volume", Mid: "Middle" },
  "horizon-drive": { Output: "Level" },
  "dhyana-drive": { Drive: "Gain", Treble: "Tone", Output: "Level" },
  teemah: { Drive: "Gain", Output: "Level" },
  "deranged-master": { Output: "Level" },
  "knuckle-dragon": { Drive: "Gain", Output: "Level" },
  "uk-wah-846": { Position: "Pedal", "Dc Bias": "DcBias" },
  "teardrop-310": { Position: "Pedal" },
  fassel: { Position: "Pedal" },
  weeper: { Position: "Pedal" },
  chrome: { Position: "Pedal" },
  "chrome-custom": { Position: "Pedal" },
  throaty: { Position: "Pedal" },
  "vetta-wah": { Position: "Pedal" },
  colorful: { Position: "Pedal" },
  conductor: { Position: "Pedal" },
  "70s-chorus": { Depth: "ChorusIntensity", Rate: "VibratoRate" },
  "hot-springs": { Decay: "Dwell" },
  "volume-pedal": { Position: "Pedal", Level: "Pedal" },
  "moon-nrm": { Drive: "NrmDrive" },
  "moon-brt": { Drive: "BrtDrive" },
  "moon-jump": { Drive: "NrmDrive" },
  "cali-iv-lead": { Drive: "LeadDrive" },
};

const THREE_KNOB_DIST = new Set([
  "scream-808",
  "stupor-od",
  "deez-one-vintage",
  "deez-one-mod",
  "hedgehog-d9",
  "top-secret-od",
  "minotaur",
  "heir-apparent",
  "kinky-boost",
  "valve-driver",
  "compulsive-drive",
  "vermin-dist",
  "arbitrator-fuzz",
  "pocket-fuzz",
  "bighorn-fuzz",
  "triangle-fuzz",
  "classic-dist-legacy",
  "screamer-legacy",
  "overdrive-legacy",
]);

const DROP_BY_MODEL: Record<string, Set<string>> = {
  "stupor-od": new Set(["Bass", "Mid", "Mix"]),
  "deez-one-vintage": new Set(["Bass", "Mid", "Mix"]),
  "deez-one-mod": new Set(["Bass", "Mid", "Mix"]),
  "scream-808": new Set(["Bass", "Mid", "Mix"]),
  "hedgehog-d9": new Set(["Bass", "Mid", "Mix"]),
  "top-secret-od": new Set(["Bass", "Mid", "Mix"]),
  minotaur: new Set(["Bass", "Mid", "Mix"]),
  "heir-apparent": new Set(["Bass", "Mid", "Mix"]),
  "kinky-boost": new Set(["Bass", "Mid", "Mix"]),
  "vermin-dist": new Set(["Bass", "Mid", "Mix"]),
  "70s-chorus": new Set(["Tone"]),
};

const GENERIC_RENAME: Record<string, string> = {
  "Ch Vol": "ChVol",
  "Low Cut": "LowCut",
  "High Cut": "HighCut",
  "Early Refl": "EarlyReflections",
  "Thr Low": "ThrLow",
  "Thr Mid": "ThrMid",
  "Thr High": "ThrHigh",
  "Dc Bias": "DcBias",
  "Vol Min": "VolumeMin",
  "Vol Max": "VolumeMax",
  Position: "Pedal",
  "2.2k": "2200Hz",
  "6.6k": "6600Hz",
  "31Hz": "31p25Hz",
  "62Hz": "62p5Hz",
  "1k": "1kHz",
  "2k": "2kHz",
  "4k": "4kHz",
  "8k": "8kHz",
  "16k": "16kHz",
};

/** Params that are cab metadata or never factory knobs. Mix is allowlisted per model. */
const DROP_PARAMS = new Set(["Mic"]);

const KEEP_MIX = new Set<CategoryId>(["modulation", "delay", "reverb", "filter", "wah", "volume", "dynamics"]);

const BOOLEAN_PARAMS = new Set(["Mode", "Bright"]);

type HlxJson = Record<string, unknown>;

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function exportableBlocks(preset: Preset): StompBlock[] {
  const device = exportProfile(preset.stompModel);
  const ampCab = new Set<CategoryId>(["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"]);
  const kept = sortedBlocks(preset).filter((b) => {
    const model = MODEL_MAP[b.modelId];
    if (!model) return false;
    if (SKIP_CATEGORIES.has(model.category)) return false;
    if (SKIP_MODELS.has(b.modelId)) return false;
    if (!device.hasAmpCab && ampCab.has(model.category)) return false;
    const hid = helixIdFor(b.modelId);
    if (!hid || !isHxStompModelId(hid)) return false;
    if (!factoryParamsFor(hid)) return false;
    if (preset.stompModel === "pod-go" && hid.startsWith("L6SPB_")) return false;
    return true;
  });
  const max = device.hasAmpCab ? Math.min(MAX_PATH_BLOCKS, device.maxBlocks) : device.maxBlocks;
  const limited: StompBlock[] = [];
  for (const block of kept) {
    if (limited.length >= max) break;
    limited.push(block);
  }
  if (device.hasAmpCab) {
    const cab = kept.find((b) => MODEL_MAP[b.modelId]?.category === "cab");
    if (cab && !limited.some((b) => b.id === cab.id)) {
      if (limited.length >= max) limited.pop();
      limited.push(cab);
    }
  }
  return limited.sort((a, b) => a.position - b.position);
}

function helixParamName(modelId: string, uiName: string): string {
  const explicit = PARAM_RENAMES[modelId]?.[uiName];
  if (explicit) return explicit;
  const generic = GENERIC_RENAME[uiName];
  const collapsed = uiName.replace(/\s+/g, "");
  const hid = helixIdFor(modelId);
  const factory = hid ? factoryParamsFor(hid) : undefined;
  if (factory) {
    if (factory.has(uiName)) return uiName;
    if (generic && factory.has(generic)) return generic;
    if (factory.has(collapsed)) return collapsed;
    const lower = uiName.toLowerCase();
    const collapsedLower = collapsed.toLowerCase();
    for (const f of factory) {
      const fl = f.toLowerCase();
      if (fl === lower || fl === collapsedLower || f.replace(/\s+/g, "").toLowerCase() === collapsedLower) return f;
    }
    const aliases: Record<string, string[]> = {
      Drive: ["Gain", "Fuzz", "Sustain", "NrmDrive", "BrtDrive", "LeadDrive", "Drive", "ODGain"],
      Treble: ["Tone", "Filter", "Bright", "Boost", "Treble"],
      Output: ["Level", "Volume", "Boost", "Output"],
      Position: ["Pedal", "Position"],
      Decay: ["Dwell", "Decay"],
      Depth: ["ChorusIntensity", "Depth"],
      Rate: ["VibratoRate", "Speed", "Rate"],
      Mod: ["Depth", "Rate", "Mod"],
      Gain: ["Level", "Gain"],
      Predelay: ["Predelay", "PreDelay"],
      Volume: ["Level", "Volume"],
      Distortion: ["Gain", "Drive", "Distortion"],
      Mid: ["Middle", "Mid"],
      Bass: ["Bass", "Low"],
      Mix: ["Mix", "Blend"],
      Threshold: ["Sensitivity", "Threshold", "PeakReduction"],
    };
    for (const cand of aliases[uiName] ?? []) {
      if (factory.has(cand)) return cand;
    }
  }
  return generic ?? collapsed;
}

function toHlxValue(
  modelId: string,
  uiName: string,
  value: number,
  category: CategoryId,
): number | boolean | undefined {
  if (uiName === "Mic") return undefined;
  const n = Number.isFinite(value) ? value : 5;
  const helixName = helixParamName(modelId, uiName);
  if (BOOLEAN_PARAMS.has(uiName) || BOOLEAN_PARAMS.has(helixName)) {
    return n >= 5;
  }
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

function allowedHlxNames(modelId: string, _category: CategoryId): Set<string> {
  const hid = helixIdFor(modelId);
  const factory = hid ? factoryParamsFor(hid) : undefined;
  if (factory && factory.size) return new Set(factory);
  // Never guess knobs. Unknown @model params make HX Edit say "unrecognized".
  return new Set();
}

function finiteHlx(value: number | boolean | undefined): value is number | boolean {
  if (typeof value === "boolean") return true;
  return typeof value === "number" && Number.isFinite(value);
}

function factoryDefault(name: string): number | boolean {
  if (BOOLEAN_PARAMS.has(name)) return false;
  if (name === "Hum" || name === "Ripple") return 0.05;
  if (name === "Bias" || name === "BiasX") return 0.5;
  if (name === "LowCut") return 20;
  if (name === "HighCut") return 20100;
  if (name === "Distance") return 1;
  if (name === "EarlyReflections") return 0;
  // Hard Gate stores these in dB. 0.5 would be +0.5 dB — the gate never opens.
  if (name === "OpenThreshold") return -48;
  if (name === "CloseThreshold") return -58;
  if (name === "HoldTime") return 0.06;
  if (name === "Level" || name === "Volume" || name === "Output" || name === "Master" || name === "ChVol" || name === "Boost") {
    return 0.5;
  }
  if (name === "Mix" || name === "Blend") return 0.5;
  if (/Hz$/i.test(name) || name.endsWith("Hz")) return 0;
  if (/SW$|Switch$/.test(name)) return false;
  return 0.5;
}

function fillFactoryParams(
  modelId: string,
  mapped: Record<string, number | boolean>,
): Record<string, number | boolean> {
  const hid = helixIdFor(modelId);
  const factory = hid ? factoryParamsFor(hid) : undefined;
  if (!factory?.size) return mapped;
  const out = { ...mapped };
  for (const name of factory) {
    if (out[name] !== undefined) continue;
    out[name] = factoryDefault(name);
  }
  return out;
}

function ui10(raw: unknown, fallback = 5): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
  return Math.max(0, Math.min(10, n));
}

/** UI 5 is noon / 0 dB. Span is the factory max in one direction. */
function bipolarDb(ui: number, span: number): number {
  return Math.round((((ui - 5) / 5) * span) * 10) / 10;
}

/**
 * UI 0–10 → dB, same curve the noise gate already uses.
 * Clamped so a hot knob still opens on a picked note (−28), never 0 dB.
 */
function gateOpenDb(ui: number): number {
  const db = -80 + (ui / 10) * 72;
  return Math.round(Math.max(-90, Math.min(-28, db)) * 10) / 10;
}

/**
 * Factory scales that are NOT 0–1. Writing the 0–1 guess mutes a Hard Gate
 * (OpenThreshold 0.5 dB never opens) and flattens a Mesa graphic (0.65 ≠ +4 dB).
 */
function applyFactoryScales(block: StompBlock, out: Record<string, number | boolean>) {
  if (block.modelId === "hard-gate") {
    const open = gateOpenDb(ui10(block.params.Threshold, 3.2));
    out.OpenThreshold = open;
    out.CloseThreshold = Math.round(Math.max(-96, open - 8) * 10) / 10;
    const decayUi = ui10(block.params.Decay, 2.7);
    out.Decay = Math.round((0.05 + (decayUi / 10) * 3.5) * 1000) / 1000;
    out.HoldTime = 0.06;
    out.Level = 0;
  }
  if (block.modelId === "noise-gate") {
    out.Level = 0;
    if (typeof out.Threshold !== "number" || out.Threshold > -12) {
      out.Threshold = gateOpenDb(ui10(block.params.Threshold, 4));
    }
  }
  if (block.modelId === "horizon-gate") {
    const sens = block.params.Sensitivity ?? block.params.Threshold;
    out.Sensitivity = ui10(sens, 8) / 10;
    out.Level = 0;
    out.Mode = 1;
    out["Gate Range"] = false;
  }
  if (block.modelId === "cali-q-graphic") {
    const spans: Record<string, number> = {
      "80Hz": 13,
      "240Hz": 13,
      "750Hz": 13,
      "2200Hz": 9.5,
      "6600Hz": 9.5,
    };
    for (const [name, span] of Object.entries(spans)) {
      if (block.params[name] === undefined) continue;
      out[name] = bipolarDb(ui10(block.params[name], 5), span);
    }
    out.Level = 0;
  }
  if (block.modelId === "10-band-graphic") {
    const pairs: Array<[string, string]> = [
      ["31Hz", "31p25Hz"],
      ["62Hz", "62p5Hz"],
      ["125Hz", "125Hz"],
      ["250Hz", "250Hz"],
      ["500Hz", "500Hz"],
      ["1kHz", "1kHz"],
      ["2kHz", "2kHz"],
      ["4kHz", "4kHz"],
      ["8kHz", "8kHz"],
      ["16kHz", "16kHz"],
    ];
    for (const [ui, helix] of pairs) {
      if (block.params[ui] === undefined) continue;
      out[helix] = bipolarDb(ui10(block.params[ui], 5), 12);
    }
    out.Level = 0;
  }
  if (block.modelId === "simple-eq") {
    if (block.params.Bass !== undefined) out.LowGain = bipolarDb(ui10(block.params.Bass, 5), 12);
    if (block.params.Mid !== undefined) out.MidGain = bipolarDb(ui10(block.params.Mid, 5), 12);
    if (block.params.Treble !== undefined) out.HighGain = bipolarDb(ui10(block.params.Treble, 5), 12);
    out.Level = block.params.Level === undefined ? 0 : bipolarDb(ui10(block.params.Level, 5), 6);
    out.MidFreq = typeof out.MidFreq === "number" ? out.MidFreq : 600;
  }
}

function blockParams(block: StompBlock): Record<string, number | boolean> {
  const model = MODEL_MAP[block.modelId];
  const category = model?.category ?? "distortion";
  const allowedUi = knownParamNames(block.modelId);
  const dropModel = DROP_BY_MODEL[block.modelId] ?? (THREE_KNOB_DIST.has(block.modelId) ? new Set(["Bass", "Mid", "Mix"]) : undefined);
  const allowedHlx = allowedHlxNames(block.modelId, category);
  const out: Record<string, number | boolean> = {};
  const names = [...(model?.params ?? []), ...Object.keys(block.params)];
  const seen = new Set<string>();
  for (const uiName of names) {
    if (seen.has(uiName)) continue;
    seen.add(uiName);
    if (dropModel?.has(uiName)) continue;
    if (DROP_PARAMS.has(uiName) && !KEEP_MIX.has(category)) continue;
    if (allowedUi && !allowedUi.has(uiName) && !(uiName in (block.params ?? {}))) continue;
    const raw = block.params[uiName] ?? 5;
    const value = toHlxValue(block.modelId, uiName, raw, category);
    if (!finiteHlx(value)) continue;
    const pname = helixParamName(block.modelId, uiName);
    if (!allowedHlx.has(pname) && !allowedHlx.has(uiName)) continue;
    if (out[pname] !== undefined && uiName !== pname) continue;
    out[pname] = value;
  }
  if (Object.keys(out).length && (category === "amp-guitar" || category === "amp-bass")) {
    if (allowedHlx.has("Hum")) out.Hum = typeof out.Hum === "number" ? out.Hum : 0.05;
    if (allowedHlx.has("Ripple")) out.Ripple = typeof out.Ripple === "number" ? out.Ripple : 0.05;
    if (allowedHlx.has("Bias")) out.Bias = typeof out.Bias === "number" ? out.Bias : 0.5;
    if (allowedHlx.has("BiasX")) out.BiasX = typeof out.BiasX === "number" ? out.BiasX : 0.5;
  }
  if (block.modelId.startsWith("cali-iv")) {
    // Factory Cali IV Rhythm 2.hlx graphic bands, 0 dB default.
    if (allowedHlx.has("80Hz")) out["80Hz"] = out["80Hz"] ?? 0;
    if (allowedHlx.has("240Hz")) out["240Hz"] = out["240Hz"] ?? 0;
    if (allowedHlx.has("750Hz")) out["750Hz"] = out["750Hz"] ?? 0;
    if (allowedHlx.has("2200Hz")) out["2200Hz"] = out["2200Hz"] ?? 0;
    if (allowedHlx.has("6600Hz")) out["6600Hz"] = out["6600Hz"] ?? 0;
  }
  if (block.modelId === "70s-chorus") {
    if (allowedHlx.has("ChorusIntensity")) out.ChorusIntensity = out.ChorusIntensity ?? 0.57;
    if (allowedHlx.has("VibratoRate")) out.VibratoRate = out.VibratoRate ?? 0.34;
    if (allowedHlx.has("VibratoDepth")) out.VibratoDepth = out.VibratoDepth ?? 0.5;
    if (allowedHlx.has("Mix")) out.Mix = out.Mix ?? 0.5;
    if (allowedHlx.has("Mode")) out.Mode = false;
    if (allowedHlx.has("Headroom")) out.Headroom = 0;
  }
  applyFactoryScales(block, out);
  return fillFactoryParams(block.modelId, out);
}

/** Drop anything HX Edit would flag as an unrecognized knob. Keep @-keys. */
function keepFactoryBlock(hid: string, obj: HlxJson): HlxJson {
  const factory = factoryParamsFor(hid);
  const out: HlxJson = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("@")) {
      out[k] = v;
      continue;
    }
    if (factory?.has(k)) out[k] = v;
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

function isAmpCategory(category: CategoryId | undefined): boolean {
  return category === "amp-guitar" || category === "amp-bass";
}

function buildDsp(blocks: StompBlock[], deviceId: StompModelId) {
  const device = exportProfile(deviceId);
  const inputModel = device.inputModel ?? "HelixStomp_AppDSPFlowInput";
  const outputMain = device.outputModel ?? "HelixStomp_AppDSPFlowOutputMain";
  const outputSend = device.outputSend ?? outputMain;

  type PathSlot = { block: StompBlock; fusedCab?: StompBlock };
  const path: PathSlot[] = [];
  for (const block of blocks) {
    const category = MODEL_MAP[block.modelId]?.category;
    if (category === "cab") {
      const prev = path[path.length - 1];
      const prevCat = prev ? MODEL_MAP[prev.block.modelId]?.category : undefined;
      if (prev && isAmpCategory(prevCat) && !prev.fusedCab) {
        prev.fusedCab = block;
        continue;
      }
    }
    path.push({ block });
  }

  const dsp: HlxJson = {
    inputA: {
      "@input": 1,
      "@model": inputModel,
      noiseGate: false,
      decay: 0.5,
      threshold: -48.0,
    },
    inputB: {
      "@input": 0,
      "@model": inputModel,
      noiseGate: false,
      decay: 0.5,
      threshold: -48.0,
    },
    outputA: {
      "@model": outputMain,
      "@output": 1,
      pan: 0.5,
      gain: 0.0,
    },
    outputB: {
      "@model": outputSend,
      "@output": 0,
      pan: 0.5,
      gain: 0.0,
    },
  };

  const fused = path.map((slot) => slot.fusedCab).filter((cab): cab is StompBlock => Boolean(cab));
  fused.forEach((cab, i) => {
    const hid = helixIdFor(cab.modelId);
    if (!hid || !factoryParamsFor(hid)) return;
    dsp[`cab${i}`] = keepFactoryBlock(hid, {
      "@model": hid,
      "@enabled": cab.enabled,
      "@mic": micIndex(cab),
      ...blockParams(cab),
    });
  });

  const others: StompBlock[] = [];
  path.forEach((slot) => {
    const block = slot.block;
    const model = MODEL_MAP[block.modelId];
    const hid = helixIdFor(block.modelId);
    if (!model || !hid || !factoryParamsFor(hid)) return;
    const i = others.length;
    const isAmp = isAmpCategory(model.category);
    const fusedCab = Boolean(slot.fusedCab);
    const hlx: HlxJson = {
      "@model": hid,
      "@position": i,
      "@enabled": block.enabled,
      "@path": 0,
      "@type": blockType(model.category, isAmp, fusedCab),
      "@stereo": false,
      "@no_snapshot_bypass": false,
      ...blockParams(block),
    };
    if (model.category === "delay" || model.category === "reverb") {
      hlx["@trails"] = true;
    }
    if (isAmp) {
      hlx["@bypassvolume"] = 1;
      if (fusedCab) hlx["@cab"] = "cab0";
    }
    dsp[`block${i}`] = keepFactoryBlock(hid, hlx);
    others.push(block);
  });

  dsp.split = {
    "@model": "HD2_AppDSPFlowSplitY",
    "@enabled": true,
    "@position": 0,
    BalanceA: 0.5,
    BalanceB: 0.5,
  };
  const pathLen = path.filter((slot) => {
    const hid = helixIdFor(slot.block.modelId);
    return Boolean(hid && factoryParamsFor(hid));
  }).length;
  dsp.join = {
    "@model": "HD2_AppDSPFlowJoin",
    "@enabled": true,
    "@position": pathLen,
    Level: 0,
    "A Level": 0,
    "B Level": 0,
    "A Pan": 0.5,
    "B Pan": 0.5,
    "B Polarity": false,
  };

  return { dsp, others, cabs: fused };
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

const LEVEL_UI = new Set(["Ch Vol", "ChVol", "Output", "Level", "Master", "Volume", "Boost"]);

type AssignedSnapParam = {
  uiName: string;
  helixName: string;
  min: number;
  max: number;
};

function dropUiParam(modelId: string, uiName: string, category: CategoryId): boolean {
  const dropModel = DROP_BY_MODEL[modelId] ?? (THREE_KNOB_DIST.has(modelId) ? new Set(["Bass", "Mid", "Mix"]) : undefined);
  if (dropModel?.has(uiName)) return true;
  if (DROP_PARAMS.has(uiName) && !KEEP_MIX.has(category)) return true;
  return false;
}

function clampUiLevel(uiName: string, raw: number): number {
  if (!LEVEL_UI.has(uiName) && !LEVEL_UI.has(uiName.replace(/\s+/g, ""))) return raw;
  return raw < 1.5 ? 1.5 : raw;
}

/**
 * Params that actually change across snapshots (including vs the base block).
 * HX assigns these @controller 9. Any snapshot that omits @value recalls 0 — mute.
 */
function collectAssignedSnapshotParams(
  preset: Preset,
  others: StompBlock[],
  maxSnapshots: number,
): Map<string, AssignedSnapParam[]> {
  const snaps = preset.snapshots.slice(0, maxSnapshots);
  const out = new Map<string, AssignedSnapParam[]>();
  others.forEach((block, i) => {
    const key = `block${i}`;
    const model = MODEL_MAP[block.modelId];
    const category = model?.category ?? "distortion";
    const allowedHlx = allowedHlxNames(block.modelId, category);
    const uiNames = new Set<string>();
    for (const snap of snaps) {
      const over = snap.paramOverrides?.[block.id];
      if (!over) continue;
      for (const n of Object.keys(over)) uiNames.add(n);
    }
    const assigned: AssignedSnapParam[] = [];
    for (const uiName of uiNames) {
      if (dropUiParam(block.modelId, uiName, category)) continue;
      const pname = helixParamName(block.modelId, uiName);
      if (!allowedHlx.has(pname) && !allowedHlx.has(uiName)) continue;
      const values: number[] = [];
      const push = (raw: number | undefined) => {
        const ui = clampUiLevel(uiName, typeof raw === "number" && Number.isFinite(raw) ? raw : 5);
        const v = toHlxValue(block.modelId, uiName, ui, category);
        if (typeof v === "number" && Number.isFinite(v)) values.push(v);
      };
      const base = block.params[uiName];
      push(typeof base === "number" ? base : undefined);
      for (const snap of snaps) {
        const over = snap.paramOverrides?.[block.id]?.[uiName];
        if (typeof over === "number") push(over);
        else push(typeof base === "number" ? base : undefined);
      }
      const uniq = [...new Set(values)];
      if (uniq.length < 2) continue;
      assigned.push({
        uiName,
        helixName: pname,
        min: Math.min(...uniq),
        max: Math.max(...uniq),
      });
    }
    if (assigned.length) out.set(key, assigned);
  });
  return out;
}

function snapshotControllers(
  snap: Snapshot | undefined,
  others: StompBlock[],
  assigned: Map<string, AssignedSnapParam[]>,
): Record<string, Record<string, { "@fs_enabled": boolean; "@value": number | boolean }>> {
  const controllers: Record<
    string,
    Record<string, { "@fs_enabled": boolean; "@value": number | boolean }>
  > = {};
  others.forEach((block, i) => {
    const key = `block${i}`;
    const list = assigned.get(key);
    if (!list?.length) return;
    const model = MODEL_MAP[block.modelId];
    const category = model?.category ?? "distortion";
    const over = snap?.paramOverrides?.[block.id];
    const params: Record<string, { "@fs_enabled": boolean; "@value": number | boolean }> = {};
    for (const item of list) {
      const raw = over?.[item.uiName] ?? block.params[item.uiName];
      const ui = clampUiLevel(item.uiName, typeof raw === "number" && Number.isFinite(raw) ? raw : 5);
      const value = toHlxValue(block.modelId, item.uiName, ui, category);
      if (!finiteHlx(value)) continue;
      params[item.helixName] = { "@fs_enabled": false, "@value": value };
    }
    if (Object.keys(params).length) controllers[key] = params;
  });
  return controllers;
}

function buildControllerSection(
  preset: Preset,
  others: StompBlock[],
  assigned: Map<string, AssignedSnapParam[]>,
) {
  const controller: { dsp0: HlxJson; dsp1: HlxJson } = { dsp0: {}, dsp1: {} };

  for (const [blockKey, params] of assigned) {
    for (const item of params) {
      const slot = (controller.dsp0[blockKey] as HlxJson) ?? {};
      slot[item.helixName] = {
        "@min": item.min,
        "@max": item.max,
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
    const existing = (slot.Pedal ?? slot.Position) as HlxJson | undefined;
    slot.Pedal = existing ?? { "@min": 0, "@max": 1, "@controller": 1 };
    delete slot.Position;
    controller.dsp0[key] = slot;
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

function fillSnapshotSlots(preset: Preset, max: number): Preset {
  const donor = preset.snapshots[Math.min(1, preset.snapshots.length - 1)] ?? preset.snapshots[0];
  if (!donor || preset.snapshots.length >= max) return preset;
  const snapshots = [...preset.snapshots];
  while (snapshots.length < max) {
    const n = snapshots.length;
    snapshots.push({
      ...donor,
      id: `${donor.id}-slot${n}`,
      name: donor.name,
      notes: donor.notes,
      enabledBlocks: [...donor.enabledBlocks],
      paramOverrides: donor.paramOverrides
        ? Object.fromEntries(Object.entries(donor.paramOverrides).map(([id, params]) => [id, { ...params }]))
        : undefined,
    });
  }
  return { ...preset, snapshots };
}

function emptySnapshot(index: number, others: StompBlock[], tempo: number, hwIndex: number) {
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
    "@fs_index": hwIndex,
    "@fs_label": `SNAP ${index + 1}`,
    blocks: { dsp0: blocks },
    controllers: { dsp0: {} },
  };
}

function sanitizeLabel(s: string, max: number) {
  const clean = s.replace(/[^\w\s+\-.'&]/g, " ").replace(/\s+/g, " ").trim();
  return (clean || "Stomp Lab").slice(0, max);
}

export function buildHlx(preset: Preset, opts?: { fsMode?: HlxFsMode }): HlxJson {
  preset = sanitizeSnapshots(preset);
  const device = exportProfile(preset.stompModel);
  preset = fillSnapshotSlots(preset, device.snapshots);
  const ext = exportExtension(preset.stompModel);
  if (!ext || !device.hlxDeviceId) {
    throw new Error(
      `${device.name} does not use .hlx or .pgp. We will not write a fake Helix file.`,
    );
  }
  const blocks = exportableBlocks(preset);
  const { dsp, others } = buildDsp(blocks, preset.stompModel);
  const maxSnapshots = device.snapshots;
  const tempo = Math.max(40, Math.min(240, Math.round(preset.tempo || 120)));
  const mode = resolveFsMode(preset, opts?.fsMode);
  const assigned = collectAssignedSnapshotParams(preset, others, maxSnapshots);

  const tone: HlxJson = {
    dsp0: dsp,
    dsp1: {},
    controller: buildControllerSection(preset, others, assigned),
    footswitch: mode === "stomp" ? buildFootswitch(preset, others) : { dsp0: {}, dsp1: {} },
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
          "@name": sanitizeLabel(snap.name, 12).toUpperCase(),
          "@tempo": tempo,
          "@valid": true,
          "@pedalstate": 0,
          "@ledcolor": snapshotLed(snap.color),
          "@custom_name": true,
          "@fs_index": hwIndex,
          "@fs_label": sanitizeLabel(snap.name, 12).toUpperCase(),
          blocks: { dsp0: snapshotBlockStates(snap, others) },
          controllers: { dsp0: snapshotControllers(snap, others, assigned) },
        }
      : emptySnapshot(i, others, tempo, hwIndex);
  }

  return {
    version: HLX_VERSION,
    data: {
      device: device.hlxDeviceId,
      device_version: HLX_APP_VERSION,
      meta: {
        name: sanitizeLabel(preset.name || "Stomp Lab", 32),
        application: ext === "pgp" ? "POD Go Edit" : "HX Edit",
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

  const ampKey = blocks.find(([, b]) => String(b["@model"] ?? "").startsWith("HD2_Amp"))?.[0];
  const cabKeys = blocks.filter(([, b]) => Number(b["@type"]) === 4).map(([k]) => k);
  for (const snapKey of Object.keys(tone).filter((k) => /^snapshot\d+$/.test(k))) {
    const snap = tone[snapKey] as {
      "@valid"?: boolean;
      "@name"?: string;
      blocks?: { dsp0?: Record<string, boolean> };
    };
    if (snap["@valid"] !== true) reasons.push(`${snapKey} is a blank slot`);
    if (!String(snap["@name"] ?? "").trim()) reasons.push(`${snapKey} has no name`);
    const states = snap.blocks?.dsp0 ?? {};
    if (ampKey && states[ampKey] === false) reasons.push(`${snapKey} amp is bypassed`);
    for (const cab of cabKeys) {
      if (states[cab] === false) reasons.push(`${snapKey} cab is bypassed`);
    }
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

export function hlxJson(preset: Preset, opts?: { fsMode?: HlxFsMode }): string {
  return JSON.stringify(buildHlx(preset, opts), null, 2);
}

export function downloadHlx(preset: Preset, opts?: { fsMode?: HlxFsMode }): boolean {
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

export async function copyHlx(preset: Preset, opts?: { fsMode?: HlxFsMode }): Promise<void> {
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
