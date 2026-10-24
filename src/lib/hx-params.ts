import { MODEL_MAP } from "@/data/catalog";
import { helixIdFor } from "@/data/helix-ids";
import { hxModel, SYNC_DOTTED_EIGHTH, type HxCatModel, type HxParam } from "@/data/hx-catalog";
import type { Snapshot, StompBlock } from "@/data/types";
import { coerceNative, uiToNative } from "./hx-units";

/**
 * Preset knobs (0–10, named the way the app and older presets name them) → HX Edit keys and
 * native values, using HX Edit's catalog. Unset knobs keep the factory default from the catalog.
 */

/** Per-model names that do not match by key, label or the shared aliases below. */
const PARAM_RENAMES: Record<string, Record<string, string>> = {
  "kinky-boost": { Treble: "Bright", Output: "Boost" },
  "deluxe-comp": { Gain: "Level" },
  "kinky-comp": { Threshold: "Sensitivity", Gain: "Level" },
  "70s-chorus": { Rate: "ChorusIntensity", Depth: "ChorusIntensity" },
  "hot-springs": { Decay: "Dwell" },
  "volume-pedal": { Position: "Pedal", Level: "Pedal" },
  "legendary-drive": { Output: "Volume", Mid: "Middle" },
  "cali-iv-lead": { Drive: "LeadDrive" },
  "simple-eq": { Bass: "LowGain", Mid: "MidGain", Treble: "HighGain" },
};

const GENERIC_RENAME: Record<string, string> = {
  "Ch Vol": "ChVol",
  "Low Cut": "LowCut",
  "High Cut": "HighCut",
  "Early Refl": "EarlyReflections",
  "Thr Low": "Lo Thresh",
  "Thr Mid": "Mid Thresh",
  "Thr High": "Hi Thresh",
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
  Shift: "Interval1",
  Key: "KeyVoice1",
};

/** Shared UI names → candidate HX keys, tried in order. */
const ALIASES: Record<string, string[]> = {
  Treble: ["Tone", "Treble", "Filter", "High", "Bright"],
  Output: ["Level", "Volume", "Output", "Boost"],
  Decay: ["Decay", "Dwell", "Time"],
  Depth: ["Depth", "Intensity", "ChorusIntensity", "Width"],
  Rate: ["Speed", "Rate", "VibratoRate"],
  Speed: ["Speed", "Rate"],
  Mod: ["Depth", "Mod", "Modulation", "Rate"],
  Gain: ["Gain", "Level"],
  Predelay: ["Predelay", "PreDelay"],
  Volume: ["Level", "Volume"],
  Mid: ["Mid", "Middle"],
  Bass: ["Bass", "Low"],
  Mix: ["Mix", "Blend"],
  Threshold: ["Threshold", "Sensitivity", "PeakReduction"],
  Freq: ["Freq", "Frequency", "Peak", "Range"],
  Q: ["Q", "Resonance", "Peak"],
  Time: ["Time", "Time1"],
  Feedback: ["Feedback", "Repeats"],
  Shift: ["Interval1", "Interval", "IntervalVoice1", "Shift", "Pitch"],
  Key: ["KeyVoice1", "Key"],
  Delay: ["Time1", "Delay"],
  Distortion: ["Gain", "Drive", "Distortion"],
};

const DRIVE_EXACT = /^(drive|gain|fuzz|sustain|distortion|pregain|odgain)$/i;
const DRIVE_LOOSE = /drive|gain|fuzz|sustain/i;
const DRIVE_EXCLUDE = /mod|post|out|level|boost|bass|mid|treb|voice|cut|eq|shift|pitch/i;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function findKey(m: HxCatModel, name: string): string | undefined {
  if (m.byKey[name]) return name;
  const n = norm(name);
  for (const p of m.params) {
    if (norm(p.key) === n || norm(p.label) === n) return p.key;
  }
  return undefined;
}

/** Channel hint from the model name, so "Fullerton Nrm" Drive is DriveNorm, not DriveBright. */
function channelPick(m: HxCatModel, keys: string[]): string[] {
  if (keys.length < 2) return keys;
  const name = norm(m.name);
  const hints: Array<[RegExp, RegExp]> = [
    [/nrm|norm|normal/, /norm|nrm/i],
    [/brt|bright/, /bright|brt/i],
    [/ch1|channel1/, /1/],
    [/ch2|channel2/, /2/],
    [/lead/, /lead/i],
    [/rhythm|rhy/, /rhy/i],
  ];
  for (const [inName, inKey] of hints) {
    if (!inName.test(name)) continue;
    const hit = keys.filter((k) => inKey.test(k) || inKey.test(m.byKey[k]?.label ?? ""));
    if (hit.length) return hit;
  }
  // "Jump" and dual-stage amps: one Drive knob moves both stages.
  return keys;
}

function driveKeys(m: HxCatModel): string[] {
  const exact = m.params.filter((p) => p.type === "f" && (DRIVE_EXACT.test(p.key) || DRIVE_EXACT.test(norm(p.label))));
  if (exact.length) return exact.map((p) => p.key);
  const loose = m.params.filter(
    (p) =>
      p.type === "f" &&
      (DRIVE_LOOSE.test(p.key) || DRIVE_LOOSE.test(p.label)) &&
      !DRIVE_EXCLUDE.test(p.key) &&
      !DRIVE_EXCLUDE.test(p.label.replace(/drive/i, "")),
  );
  return channelPick(
    m,
    loose.map((p) => p.key),
  );
}

/** HX keys a preset knob writes to. Empty when the model has no such knob (it is then left at factory). */
export function resolveParamKeys(modelId: string, uiName: string): string[] {
  const m = hxModel(helixIdFor(modelId));
  if (!m) return [];
  const explicit = PARAM_RENAMES[modelId]?.[uiName];
  if (explicit && m.byKey[explicit]) return [explicit];
  const direct = findKey(m, uiName);
  if (direct) return [direct];
  const generic = GENERIC_RENAME[uiName];
  if (generic && m.byKey[generic]) return [generic];
  if (uiName === "Drive") return driveKeys(m);
  for (const cand of ALIASES[uiName] ?? []) {
    const k = findKey(m, cand);
    if (k) return [k];
  }
  return [];
}

export function paramFor(modelId: string, key: string): HxParam | undefined {
  return hxModel(helixIdFor(modelId))?.byKey[key];
}

const VOLUME_KEY = /^(ChVol|Ch Vol|Master|Level|Volume|Output)$/;
const LEGACY_LEVEL_UI = new Set(["Ch Vol", "ChVol", "Output", "Level", "Master", "Volume"]);

/**
 * Knobs that mute the path when low: channel volume, master, output and level — by the real HX
 * key, so a Tube Screamer's Gain (its drive) or Kinky Boost's Boost switch is not mistaken for one.
 */
export function isVolumeKnob(modelId: string, uiName: string): boolean {
  if (modelId === "volume-pedal") return false;
  const m = hxModel(helixIdFor(modelId));
  if (!m) return LEGACY_LEVEL_UI.has(uiName) || LEGACY_LEVEL_UI.has(uiName.replace(/\s+/g, ""));
  return resolveParamKeys(modelId, uiName).some((k) => VOLUME_KEY.test(k) && m.byKey[k]?.type === "f");
}

/** CLAUDE.md: channel volume / output / level / master stay at or above ~3.2 or the snapshot goes silent. */
export function clampUiLevel(modelId: string, uiName: string, raw: number): number {
  if (!isVolumeKnob(modelId, uiName)) return raw;
  return raw < 3.2 ? 3.2 : raw;
}

/** Knob → native value for one HX key. Ear-checked curves (gates, graphic EQs) are kept as they were tuned. */
export function nativeFor(modelId: string, key: string, uiName: string, ui: number): number | boolean | undefined {
  const p = paramFor(modelId, key);
  if (!p) return undefined;
  const raw = Number.isFinite(ui) ? clampUiLevel(modelId, uiName, ui) : 5;
  const special = specialCurve(modelId, key, raw);
  return coerceNative(p, special ?? uiToNative(p, raw));
}

const ui10 = (n: number) => Math.max(0, Math.min(10, Number.isFinite(n) ? n : 5));
/** UI 5 is noon / 0 dB. Span is the factory max in one direction. */
const bipolarDb = (ui: number, span: number) => Math.round(((ui - 5) / 5) * span * 10) / 10;
/** Gate open level: −80 … −8 dB across the knob, never tighter than −28 dB. */
const gateOpenDb = (ui: number) => Math.round(Math.max(-90, Math.min(-28, -80 + (ui / 10) * 72)) * 10) / 10;

const CALI_Q_SPANS: Record<string, number> = { "80Hz": 13, "240Hz": 13, "750Hz": 13, "2200Hz": 9.5, "6600Hz": 9.5 };

function specialCurve(modelId: string, key: string, raw: number): number | undefined {
  if (modelId === "noise-gate" && key === "Threshold") {
    const t = gateOpenDb(ui10(raw));
    return t > -48 ? -55 : t;
  }
  if (modelId === "hard-gate" && key === "OpenThreshold") {
    const open = gateOpenDb(ui10(raw));
    return open > -55 ? -62 : open;
  }
  if (modelId === "cali-q-graphic" && CALI_Q_SPANS[key]) return bipolarDb(ui10(raw), CALI_Q_SPANS[key]);
  if (modelId === "10-band-graphic" && /Hz$/.test(key)) return bipolarDb(ui10(raw), 12);
  if (modelId === "simple-eq" && /Gain$/.test(key)) return bipolarDb(ui10(raw), 12);
  return undefined;
}

export type NativeParams = Record<string, number | boolean>;

/** Factory defaults for every key the model has. */
export function factoryDefaults(modelId: string): NativeParams {
  const m = hxModel(helixIdFor(modelId));
  if (!m) return {};
  return Object.fromEntries(m.params.map((p) => [p.key, p.def]));
}

/** True when the preset asked this delay/mod block to follow tempo. */
export function syncNoteFor(block: StompBlock): number | undefined {
  const note = block.params.Note ?? block.params.Sync;
  if (typeof note === "number" && note >= 1 && note <= 19) return Math.round(note);
  // Note 0 is the player choosing a free-running delay; it overrides an older preset's Scale.
  if (note === 0) return undefined;
  const category = MODEL_MAP[block.modelId]?.category;
  // Presets written before real tempo sync stored "Scale 5" to mean the programmed dotted eighth.
  const scale = block.params.Scale;
  if (category === "delay" && typeof scale === "number" && Math.abs(scale - 5) <= 0.5) return SYNC_DOTTED_EIGHTH;
  return undefined;
}

const SKIP_UI = new Set(["Note", "Sync", "Mic"]);

/**
 * Every native knob for a block: factory defaults, then the preset's knobs on top,
 * then the per-model rules (amp hum, gates at unity, tempo sync).
 */
export function blockNativeParams(block: StompBlock, overrides?: Record<string, number>): NativeParams {
  const m = hxModel(helixIdFor(block.modelId));
  if (!m) return {};
  const out = factoryDefaults(block.modelId);
  const params = { ...block.params, ...(overrides ?? {}) };
  const scaleIsSync = syncNoteFor(block) !== undefined && params.Note === undefined && params.Sync === undefined;
  for (const [uiName, raw] of Object.entries(params)) {
    if (typeof raw !== "number" || SKIP_UI.has(uiName)) continue;
    if (uiName === "Scale" && scaleIsSync) continue;
    for (const key of resolveParamKeys(block.modelId, uiName)) {
      const v = nativeFor(block.modelId, key, uiName, raw);
      if (v !== undefined) out[key] = v;
    }
  }
  if (m.category === "amp" || m.category === "preamp") {
    // Quieter than factory hum/ripple; Liam's ear-checked presets were tuned this way.
    if (m.byKey.Hum && params.Hum === undefined) out.Hum = 0.05;
    if (m.byKey.Ripple && params.Ripple === undefined) out.Ripple = 0.05;
    // Bias at noon, as every ear-checked preset was exported before the factory catalog.
    if (m.byKey.Bias && params.Bias === undefined) out.Bias = 0.5;
    if (m.byKey.BiasX && params["Bias X"] === undefined && params.BiasX === undefined) out.BiasX = 0.5;
  }
  if (block.modelId.startsWith("cali-iv")) {
    // The amp's built-in graphic stays flat unless asked (factory Cali IV Rhythm 2.hlx).
    for (const band of ["80Hz", "240Hz", "750Hz", "2200Hz", "6600Hz"]) if (m.byKey[band] && params[band] === undefined) out[band] = 0;
  }
  if (block.modelId === "70s-chorus") {
    // The demos' CE-1 vibrato settings (chorus mode ignores them, vibrato mode uses them).
    if (m.byKey.VibratoRate && params.VibratoRate === undefined) out.VibratoRate = 0.34;
    if (m.byKey.VibratoDepth && params.VibratoDepth === undefined) out.VibratoDepth = 0.5;
  }
  if (block.modelId === "noise-gate" || block.modelId === "hard-gate" || block.modelId === "horizon-gate") {
    if (m.byKey.Level) out.Level = 0;
  }
  if (block.modelId === "hard-gate") {
    const open = typeof out.OpenThreshold === "number" ? out.OpenThreshold : -62;
    out.CloseThreshold = Math.round(Math.max(-96, open - 8) * 10) / 10;
  }
  if (block.modelId === "volume-pedal" && typeof out.Pedal === "number" && out.Pedal < 0.15) out.Pedal = 0.85;
  if (m.category === "cab" && m.byKey.Level) out.Level = 0;
  // A bass cab keeps the low E and B fundamentals (31–41 Hz).
  const lowCutKey = m.byKey.LowCut ? "LowCut" : m.byKey["Low Cut"] ? "Low Cut" : undefined;
  if (m.category === "cab" && lowCutKey && MODEL_MAP[block.modelId]?.instrument === "bass" && typeof out[lowCutKey] === "number") {
    out[lowCutKey] = Math.min(out[lowCutKey] as number, 40);
  }
  // Plateaux ships with a pitch shimmer in its factory default; a record rarely has one unless asked.
  if (block.modelId === "plateaux" && m.byKey.PitchMix && params["Pitch Mix"] === undefined && params.PitchMix === undefined) {
    out.PitchMix = 0;
  }
  if (m.category === "cab" && m.byKey.Mic && typeof block.params.Mic === "number") {
    out.Mic = coerceNative(m.byKey.Mic, block.params.Mic);
  }
  const sync = syncNoteFor({ ...block, params });
  if (m.byKey.TempoSync1) {
    out.TempoSync1 = sync !== undefined;
    if (sync !== undefined && m.byKey.SyncSelect1) out.SyncSelect1 = coerceNative(m.byKey.SyncSelect1, sync);
  }
  for (const p of m.params) out[p.key] = coerceNative(p, out[p.key] ?? p.def);
  return out;
}

/**
 * On/off switches (Kinky Boost "Boost" and "Bright", HX type "b") are never snapshot-controlled
 * in the file, so a switch that only a snapshot turns on would export off everywhere. A switch on
 * in any snapshot that enables the block is written on the block itself.
 */
export function liftSnapshotSwitches<T extends { blocks: StompBlock[]; snapshots: Snapshot[] }>(preset: T): T {
  let changed = false;
  const lifted = new Map<string, string[]>();
  const blocks = preset.blocks.map((block) => {
    const m = hxModel(helixIdFor(block.modelId));
    if (!m || !m.params.some((p) => p.type === "b")) return block;
    const base = blockNativeParams(block);
    const lift: Record<string, number> = {};
    for (const snap of preset.snapshots) {
      const on = snap.enabledBlocks?.length ? snap.enabledBlocks.includes(block.id) : block.enabled;
      if (!on) continue;
      for (const [uiName, raw] of Object.entries(snap.paramOverrides?.[block.id] ?? {})) {
        if (typeof raw !== "number") continue;
        for (const key of resolveParamKeys(block.modelId, uiName)) {
          if (m.byKey[key]?.type !== "b" || base[key] === true) continue;
          if (nativeFor(block.modelId, key, uiName, raw) === true) lift[key] = raw;
        }
      }
    }
    const keys = Object.keys(lift);
    if (!keys.length) return block;
    changed = true;
    // Drop the block's own names for that switch (Output vs Boost) so the "on" is the one written.
    const params = Object.fromEntries(
      Object.entries(block.params).filter(([uiName]) => !resolveParamKeys(block.modelId, uiName).some((k) => keys.includes(k))),
    );
    for (const key of keys) params[key] = lift[key];
    lifted.set(block.id, keys);
    return { ...block, params };
  });
  if (!changed) return preset;
  // The snapshots stop naming that switch, so the screen shows what the file plays.
  const snapshots = preset.snapshots.map((snap) => {
    if (!snap.paramOverrides) return snap;
    const paramOverrides: Record<string, Record<string, number>> = {};
    for (const [id, params] of Object.entries(snap.paramOverrides)) {
      const keys = lifted.get(id);
      const modelId = blocks.find((b) => b.id === id)?.modelId ?? "";
      const left = keys
        ? Object.fromEntries(Object.entries(params).filter(([uiName]) => !resolveParamKeys(modelId, uiName).some((k) => keys.includes(k))))
        : params;
      if (Object.keys(left).length) paramOverrides[id] = left;
    }
    return { ...snap, paramOverrides: Object.keys(paramOverrides).length ? paramOverrides : undefined };
  });
  return { ...preset, blocks, snapshots };
}

/** Legacy cab "@mic" index for HD2_Cab* (the newer CabMicIr_ cabs use the Mic param instead). */
export function legacyMicIndex(block: StompBlock): number {
  const raw = block.params.Mic;
  if (typeof raw !== "number") return 0;
  return Math.max(0, Math.min(15, Math.round(raw)));
}

/**
 * Clean a block's knobs from Gemini or an old preset: keep every knob the model really has
 * (by HX key, label or the app's older names), 0–10 for knobs, the real setting for whole-number
 * and Note knobs. Unknown names are dropped; nothing missing is invented.
 */
export function normalizeBlockParams(modelId: string, raw: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  const m = hxModel(helixIdFor(modelId));
  for (const [name, value] of Object.entries(raw)) {
    const n = typeof value === "number" ? value : typeof value === "boolean" ? (value ? 10 : 0) : Number(value);
    if (!Number.isFinite(n)) continue;
    if (name === "Note" || name === "Sync") {
      if (m?.byKey.SyncSelect1 && n >= 1 && n <= 19) out.Note = Math.round(n);
      continue;
    }
    if (name === "Mic") {
      out.Mic = Math.max(0, Math.min(15, Math.round(n)));
      continue;
    }
    const keys = resolveParamKeys(modelId, name);
    if (!keys.length) continue;
    const p = m?.byKey[keys[0]];
    out[name] = p?.type === "i" ? Math.max(p.min, Math.min(p.max, Math.round(n))) : Math.max(0, Math.min(10, n));
  }
  return out;
}
