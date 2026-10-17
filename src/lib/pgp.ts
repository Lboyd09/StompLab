import { DEVICE_MAP } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import { helixIdFor, UNEXPORTABLE_MODELS } from "@/data/helix-ids";
import { podGoIdFor, podGoModel, type PodGoModel } from "@/data/podgo-catalog";
import type { Preset, StompBlock } from "@/data/types";
import { blockNativeParams, legacyMicIndex, nativeFor, resolveParamKeys } from "./hx-params";
import { coerceNative } from "./hx-units";
import { sortedBlocks, visualToHardwareFs } from "./preset-utils";

/**
 * POD Go Edit .pgp, laid out like the unit's own New Preset (POD Go 2.50 exports):
 * ten slots — Wah, Volume, two free, FX Loop, Amp, Cab, preset EQ, two free. The built-ins stay in
 * place (removing them is what breaks POD Go presets); our effects fill the four free slots.
 *   input P34_AppDSPFlowInput, output P34_AppDSPFlowOutput, no split/join
 *   EXP 1 = controller 1 (wah), EXP 2 = controller 2 (volume), toe switch = @fs_index 9
 *   snapshot knobs on controller 11, four snapshots, @pedalstate 2
 */

const PGP_DEVICE = 2162695;
const PGP_VERSION = 38797312; // 0x02500000 = POD Go 2.50
const PGP_BUILD_SHA = "v2.50";
const SNAPSHOT_CONTROLLER = 11;
const TOE_SWITCH = 9;
const FREE_SLOTS = 4;

type PgpJson = Record<string, unknown>;
type Placed = { block?: StompBlock; id: string; model: PodGoModel; role: string; enabled: boolean };

function snapshotLed(color: string): number {
  const c = color.toLowerCase();
  if (c.includes("red")) return 1;
  if (c.includes("orange")) return 2;
  if (c.includes("yellow")) return 3;
  if (c.includes("green")) return 4;
  if (c.includes("cyan") || c.includes("turquoise")) return 5;
  if (c.includes("blue")) return 6;
  if (c.includes("purple")) return 7;
  return 0;
}

function sanitizeLabel(s: string, max: number) {
  const clean = s.replace(/[^\w\s+\-.'&]/g, " ").replace(/\s+/g, " ").trim();
  return (clean || "Stomp Lab").slice(0, max);
}

/** Native knobs for a POD Go model: the HX mapping, filtered to the keys POD Go has, with POD Go defaults. */
function podParams(block: StompBlock | undefined, model: PodGoModel, overrides?: Record<string, number>) {
  const hx = block ? blockNativeParams(block, overrides) : {};
  const out: Record<string, number | boolean> = {};
  for (const p of model.params) {
    const v = hx[p.key];
    out[p.key] = coerceNative(p, v === undefined ? p.def : v);
  }
  return out;
}

function enabledIn(snapIndex: number, preset: Preset, block: StompBlock): boolean {
  const snap = preset.snapshots[snapIndex];
  if (snap?.enabledBlocks?.length) return snap.enabledBlocks.includes(block.id);
  return block.enabled;
}

export function pgpLayout(preset: Preset): { slots: Placed[]; dropped: StompBlock[] } {
  const dropped: StompBlock[] = [];
  let amp: StompBlock | undefined;
  let cab: StompBlock | undefined;
  let wah: StompBlock | undefined;
  let vol: StompBlock | undefined;
  const pre: StompBlock[] = [];
  const post: StompBlock[] = [];
  for (const b of sortedBlocks(preset)) {
    const m = MODEL_MAP[b.modelId];
    const hid = helixIdFor(b.modelId);
    if (!m || !hid || UNEXPORTABLE_MODELS.has(b.modelId) || m.category === "mic" || m.category === "ir") {
      if (m?.category !== "mic") dropped.push(b);
      continue;
    }
    if ((m.category === "amp-guitar" || m.category === "amp-bass" || m.category === "preamp") && !amp) amp = b;
    else if (m.category === "cab" && !cab) cab = b;
    else if (m.category === "wah" && !wah) wah = b;
    else if (b.modelId === "volume-pedal" && !vol) vol = b;
    else if (m.category === "amp-guitar" || m.category === "amp-bass" || m.category === "preamp" || m.category === "cab") dropped.push(b);
    else (amp ? post : pre).push(b);
  }
  const resolve = (b: StompBlock, stage: "pre" | "post") => {
    const id = podGoIdFor(helixIdFor(b.modelId)!, stage);
    return id ? { id, model: podGoModel(id)! } : undefined;
  };
  const fixed = (id: string) => ({ id, model: podGoModel(id)! });

  // A graphic / parametric EQ goes in POD Go's own preset-EQ slot when it has a STATIC twin.
  let eqBlock: StompBlock | undefined;
  let eqId: string | undefined;
  for (const b of [...post, ...pre]) {
    if (MODEL_MAP[b.modelId]?.category !== "eq") continue;
    const hid = helixIdFor(b.modelId)!;
    const id = podGoModel(hid.replace(/^HD2_(EQ)?/, "HD2_EQ_STATIC_") + "Stereo") ? hid.replace(/^HD2_(EQ)?/, "HD2_EQ_STATIC_") + "Stereo" : undefined;
    if (id) {
      eqBlock = b;
      eqId = id;
      break;
    }
  }
  // Four free slots. Over that, drop the effects that matter least to the sound of the record.
  const KEEP: Record<string, number> = { distortion: 6, delay: 6, reverb: 5, modulation: 4, pitch: 4, filter: 4, eq: 2, dynamics: 2, volume: 1 };
  const candidates = [...pre, ...post].filter((b) => b !== eqBlock);
  const usable = candidates.filter((b) => {
    const ok = Boolean(resolve(b, pre.includes(b) ? "pre" : "post"));
    if (!ok) dropped.push(b);
    return ok;
  });
  while (usable.length > FREE_SLOTS) {
    let worst = usable.length - 1;
    for (let i = usable.length - 1; i >= 0; i--) {
      const score = (b: StompBlock) => KEEP[MODEL_MAP[b.modelId]?.category ?? ""] ?? 3;
      if (score(usable[i]) < score(usable[worst])) worst = i;
    }
    dropped.push(...usable.splice(worst, 1));
  }
  const freePre: Placed[] = [];
  const freePost: Placed[] = [];
  for (const b of usable) {
    const stage = pre.includes(b) ? "pre" : "post";
    (stage === "pre" ? freePre : freePost).push({ block: b, ...resolve(b, stage)!, role: "fx", enabled: b.enabled });
  }

  const wahR = wah ? resolve(wah, "pre") : undefined;
  const ampR = amp ? resolve(amp, "pre") : undefined;
  const cabR = cab ? resolve(cab, "post") : undefined;
  const slots: Placed[] = [
    wahR ? { block: wah, ...wahR, role: "wah", enabled: wah!.enabled } : { ...fixed("HD2_WahUKWah846Stereo"), role: "wah", enabled: false },
    vol
      ? { block: vol, ...fixed("HD2_VolPanVolStereo"), role: "vol", enabled: vol.enabled }
      : { ...fixed("HD2_VolPanVolStereo"), role: "vol", enabled: false },
    ...freePre,
    { ...fixed("HD2_FXLoopMono1"), role: "fxloop", enabled: false },
    ampR ? { block: amp, ...ampR, role: "amp", enabled: true } : { ...fixed("HD2_AmpUSDoubleNrm"), role: "amp", enabled: true },
    cabR ? { block: cab, ...cabR, role: "cab", enabled: true } : { ...fixed("HD2_Cab2x12DoubleC12N"), role: "cab", enabled: true },
    eqBlock && eqId
      ? { block: eqBlock, ...fixed(eqId), role: "eq", enabled: eqBlock.enabled }
      : { ...fixed("HD2_EQ_STATIC_ParametricStereo"), role: "eq", enabled: false },
    ...freePost,
  ];
  if (wah && !wahR) dropped.push(wah);
  if (amp && !ampR) dropped.push(amp);
  if (cab && !cabR) dropped.push(cab);
  return { slots, dropped };
}

function blockType(p: Placed): number {
  if (p.role === "amp") return 1;
  if (p.role === "cab") return p.id.startsWith("HD2_CabMicIr_") ? 0 : 2;
  if (p.role === "fxloop") return 5;
  const cat = p.block ? MODEL_MAP[p.block.modelId]?.category : undefined;
  if (cat === "delay" || cat === "reverb") return 5;
  return 0;
}

export function buildPgp(preset: Preset, opts?: { fsMode?: "stomp" | "snapshot" | "preset" }): PgpJson {
  const device = DEVICE_MAP[preset.stompModel] ?? DEVICE_MAP["pod-go"];
  const { slots } = pgpLayout(preset);
  const tempo = Math.max(40, Math.min(240, Math.round(preset.tempo || 120)));
  const snapCount = device.snapshots;
  const snaps = preset.snapshots.slice(0, snapCount);

  const dsp0: PgpJson = {
    input: { "@input": 1, "@model": "P34_AppDSPFlowInput", noiseGate: false, decay: 0.5, threshold: -48 },
    output: { "@model": "P34_AppDSPFlowOutput", "@output": 1, pan: 0.5, gain: 0 },
  };
  slots.forEach((p, i) => {
    const b: PgpJson = {
      "@model": p.id,
      "@position": i,
      "@no_snapshot_bypass": false,
      "@enabled": p.block ? enabledIn(0, preset, p.block) && p.enabled !== false : p.enabled,
      "@type": blockType(p),
    };
    if (blockType(p) === 5) b["@trails"] = p.role !== "fxloop";
    if (p.role === "amp") b["@bypassvolume"] = 1;
    if (p.role === "cab" && !p.model.byKey.Mic) b["@mic"] = p.block ? legacyMicIndex(p.block) : 5;
    Object.assign(b, podParams(p.block, p.model, p.block ? preset.snapshots[0]?.paramOverrides?.[p.block.id] : undefined));
    if (p.role === "vol" && !p.block) b.Pedal = 1;
    dsp0[`block${i}`] = b;
  });
  for (let i = slots.length; i < 10; i++) dsp0[`block${i}`] = { "@position": i };

  // Snapshot-controlled knobs.
  const assigned = new Map<number, Array<{ uiName: string; key: string; min: number; max: number }>>();
  slots.forEach((p, i) => {
    if (!p.block) return;
    const names = new Set<string>();
    for (const s of snaps) for (const n of Object.keys(s.paramOverrides?.[p.block.id] ?? {})) names.add(n);
    const list: Array<{ uiName: string; key: string; min: number; max: number }> = [];
    for (const uiName of names) {
      for (const key of resolveParamKeys(p.block.modelId, uiName)) {
        const param = p.model.byKey[key];
        if (!param || param.type === "b") continue;
        const values = new Set(
          snaps.map((s) => JSON.stringify(nativeFor(p.block!.modelId, key, uiName, s.paramOverrides?.[p.block!.id]?.[uiName] ?? p.block!.params[uiName] ?? 5))),
        );
        if (values.size > 1) list.push({ uiName, key, min: param.min, max: param.max });
      }
    }
    if (list.length) assigned.set(i, list);
  });

  const controller: PgpJson = {};
  const wahIdx = slots.findIndex((p) => p.role === "wah");
  const volIdx = slots.findIndex((p) => p.role === "vol");
  controller[`block${wahIdx}`] = { Pedal: { "@min": 0, "@controller": 1, "@max": 1 } };
  controller[`block${volIdx}`] = { Pedal: { "@min": 0, "@controller": 2, "@max": 1 } };
  for (const [i, list] of assigned) {
    const slot = (controller[`block${i}`] as PgpJson) ?? {};
    for (const item of list) slot[item.key] = { "@min": item.min, "@controller": SNAPSHOT_CONTROLLER, "@max": item.max };
    controller[`block${i}`] = slot;
  }

  const footswitch: PgpJson = {
    [`block${wahIdx}`]: { "@fs_label": slots[wahIdx].model.name, "@fs_enabled": false, "@fs_index": TOE_SWITCH, "@fs_ledcolor": 196619, "@fs_primary": true, "@fs_momentary": false },
    [`block${volIdx}`]: { "@fs_label": "Volume Pedal", "@fs_enabled": true, "@fs_index": TOE_SWITCH, "@fs_ledcolor": 65408, "@fs_momentary": false },
  };
  for (const fs of preset.footswitches) {
    if (fs.action !== "bypass" || !fs.targetBlockId) continue;
    const i = slots.findIndex((p) => p.block?.id === fs.targetBlockId);
    if (i < 0 || slots[i].role === "wah" || slots[i].role === "vol") continue;
    footswitch[`block${i}`] = {
      "@fs_label": sanitizeLabel(fs.label || slots[i].model.name, 16),
      "@fs_enabled": true,
      "@fs_index": Math.max(1, Math.min(6, visualToHardwareFs(fs.index))),
      "@fs_ledcolor": 13676288,
      "@fs_primary": true,
      "@fs_momentary": false,
    };
  }

  const tone: PgpJson = {
    dsp0,
    dsp1: {},
    controller: { dsp0: controller },
    footswitch: { dsp0: footswitch },
    global: {
      "@model": "@global_params",
      "@cursor_group": `block${slots.findIndex((p) => p.role === "amp")}`,
      "@pedalstate": opts?.fsMode === "stomp" ? 0 : 2,
      "@current_snapshot": 0,
      "@tempo": tempo,
    },
  };

  for (let s = 0; s < snapCount; s++) {
    const snap = snaps[s];
    const src = snap ?? snaps[0];
    const blocks: Record<string, boolean> = {};
    const controllers: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number | boolean }>> = {
      [`block${wahIdx}`]: { Pedal: { "@fs_enabled": false, "@value": 0 } },
      [`block${volIdx}`]: { Pedal: { "@fs_enabled": false, "@value": 1 } },
    };
    slots.forEach((p, i) => {
      blocks[`block${i}`] = p.block ? (src?.enabledBlocks?.length ? src.enabledBlocks.includes(p.block.id) : p.block.enabled) && p.enabled !== false : p.enabled;
      const list = assigned.get(i);
      if (!list || !p.block) return;
      const native = podParams(p.block, p.model, src?.paramOverrides?.[p.block.id]);
      const vals: Record<string, { "@fs_enabled": boolean; "@value": number | boolean }> = {};
      for (const item of list) vals[item.key] = { "@fs_enabled": false, "@value": native[item.key] };
      controllers[`block${i}`] = { ...(controllers[`block${i}`] ?? {}), ...vals };
    });
    for (let i = slots.length; i < 10; i++) blocks[`block${i}`] = true;
    tone[`snapshot${s}`] = {
      "@name": snap ? sanitizeLabel(snap.name, 12).toUpperCase() : `SNAPSHOT ${s + 1}`,
      "@tempo": tempo,
      "@valid": true,
      blocks: { dsp0: blocks },
      "@pedalstate": 2,
      "@ledcolor": snap ? snapshotLed(snap.color) : 0,
      controllers: { dsp0: controllers },
    };
  }

  return {
    data: {
      meta: {
        name: sanitizeLabel(preset.name || "Stomp Lab", 16),
        application: "POD Go Edit",
        build_sha: PGP_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: PGP_VERSION,
      },
      device: PGP_DEVICE,
      tone,
      device_version: PGP_VERSION,
    },
    meta: { original: 0, pbn: 0, premium: 0 },
    schema: "L6Preset",
    version: 6,
  };
}
