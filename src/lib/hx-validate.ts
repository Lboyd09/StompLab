import { hxModel, hxModelOnUnit, type HxParam, type HxUnitFamily } from "@/data/hx-catalog";
import { podGoModel } from "@/data/podgo-catalog";

/**
 * Checks a .hlx / .pgp against HX Edit's and POD Go Edit's own catalogs and the per-unit layout
 * real exports use. HX Edit imports unknown knobs and bad values silently (it drops or clamps
 * them), so a clean import proves nothing; this does.
 *
 * `strict` adds the rules Stomp Lab's own files must meet on top of what real files show
 * (every snapshot names every block and every snapshot knob).
 */

type Unit = {
  family: HxUnitFamily | "podgo";
  inputs: string[];
  outputs: string[];
  snapshots: number;
  snapshotController: number;
  fsMax: number;
};

export const UNITS: Record<number, Unit> = {
  2162694: { family: "stomp", inputs: ["HelixStomp_AppDSPFlowInput"], outputs: ["HelixStomp_AppDSPFlowOutputMain", "HelixStomp_AppDSPFlowOutputSend"], snapshots: 3, snapshotController: 9, fsMax: 15 },
  2162699: { family: "stomp", inputs: ["HelixStomp_AppDSPFlowInput"], outputs: ["HelixStomp_AppDSPFlowOutputMain", "HelixStomp_AppDSPFlowOutputSend"], snapshots: 4, snapshotController: 12, fsMax: 10 },
  2162689: { family: "floor", inputs: ["HD2_AppDSPFlow1Input", "HD2_AppDSPFlow2Input"], outputs: ["HD2_AppDSPFlowOutput"], snapshots: 8, snapshotController: 19, fsMax: 15 },
  2162692: { family: "lt", inputs: ["HD2_AppDSPFlow1Input", "HD2_AppDSPFlow2Input"], outputs: ["HD2_AppDSPFlowOutput"], snapshots: 8, snapshotController: 19, fsMax: 15 },
  2162693: { family: "effects", inputs: ["HelixFx_AppDSPFlowInput"], outputs: ["HelixFx_AppDSPFlowOutput"], snapshots: 4, snapshotController: 10, fsMax: 14 },
  2162695: { family: "podgo", inputs: ["P34_AppDSPFlowInput"], outputs: ["P34_AppDSPFlowOutput"], snapshots: 4, snapshotController: 11, fsMax: 9 },
};

const EPS = 1e-3;

function checkValue(where: string, p: HxParam, v: unknown, issues: string[]) {
  if (p.type === "b") {
    if (typeof v !== "boolean") issues.push(`${where} should be on/off, got ${JSON.stringify(v)}`);
    return;
  }
  if (typeof v !== "number" || !Number.isFinite(v)) {
    issues.push(`${where} should be a number, got ${JSON.stringify(v)}`);
    return;
  }
  if (p.type === "i" && Math.round(v) !== v) issues.push(`${where} should be a whole number, got ${v}`);
  if (v < p.min - EPS || v > p.max + EPS) issues.push(`${where} = ${v} is outside ${p.min}…${p.max}`);
}

type Lookup = (id: string) => { byKey: Record<string, HxParam> } | undefined;

function checkParams(where: string, obj: Record<string, unknown>, lookup: Lookup, issues: string[]) {
  const id = String(obj["@model"] ?? "");
  const m = lookup(id);
  if (!m) {
    issues.push(`${where} @model ${id} does not exist on this unit`);
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("@")) continue;
    const p = m.byKey[k];
    if (!p) {
      issues.push(`${where} ${id} has no knob "${k}"`);
      continue;
    }
    checkValue(`${where} ${id}.${k}`, p, v, issues);
  }
}

export function validatePreset(file: unknown, opts: { strict?: boolean } = {}): string[] {
  const issues: string[] = [];
  const j = file as { version?: number; schema?: string; data?: { device?: number; device_version?: number; meta?: { name?: string }; tone?: Record<string, unknown> } };
  if (j?.schema !== "L6Preset") issues.push("schema is not L6Preset");
  if (j?.version !== 6) issues.push(`version ${j?.version} is not 6`);
  const device = j?.data?.device ?? 0;
  const unit = UNITS[device === 2162696 ? 2162695 : device];
  if (!unit) return [...issues, `device ${device} is not a known Line 6 unit`];
  if (typeof j.data?.device_version !== "number") issues.push("device_version missing");
  const tone = (j.data?.tone ?? {}) as Record<string, any>;
  const dsp = (tone.dsp0 ?? {}) as Record<string, Record<string, unknown>>;
  const podgo = unit.family === "podgo";
  const lookup: Lookup = podgo
    ? (id) => podGoModel(id)
    : (id) => (hxModelOnUnit(id, unit.family as HxUnitFamily) ? hxModel(id) : undefined);

  // I/O
  for (const [k, b] of Object.entries(dsp)) {
    if (/^input/.test(k) && !unit.inputs.includes(String(b["@model"]))) issues.push(`${k} @model ${b["@model"]} is not this unit's input`);
    if (/^output/.test(k) && !unit.outputs.includes(String(b["@model"]))) issues.push(`${k} @model ${b["@model"]} is not this unit's output`);
  }
  if (!podgo && opts.strict) {
    for (const k of ["inputA", "inputB", "outputA", "outputB", "split", "join"]) if (!dsp[k]) issues.push(`dsp0.${k} missing`);
  }

  // Blocks and cabs
  const blockKeys = Object.keys(dsp).filter((k) => /^block\d+$/.test(k) && dsp[k]["@model"]);
  for (const k of blockKeys) {
    checkParams(`dsp0.${k}`, dsp[k], lookup, issues);
    const cabRef = dsp[k]["@cab"];
    if (typeof cabRef === "string" && !dsp[cabRef]) issues.push(`dsp0.${k} points at missing ${cabRef}`);
  }
  for (const k of Object.keys(dsp).filter((k) => /^cab\d+$/.test(k))) checkParams(`dsp0.${k}`, dsp[k], lookup, issues);

  // Controllers
  const declared = new Map<string, number>();
  for (const [bk, params] of Object.entries((tone.controller?.dsp0 ?? {}) as Record<string, Record<string, any>>)) {
    const blk = dsp[bk];
    const m = blk ? lookup(String(blk["@model"])) : undefined;
    for (const [pk, c] of Object.entries(params)) {
      declared.set(`${bk}.${pk}`, c["@controller"]);
      if (!blk) issues.push(`controller ${bk} has no block`);
      else if (m && !m.byKey[pk] && !pk.startsWith("@")) issues.push(`controller ${bk}.${pk} is not a knob of ${blk["@model"]}`);
      if (typeof c["@min"] !== typeof c["@max"]) issues.push(`controller ${bk}.${pk} min/max types differ`);
    }
  }

  // Snapshots
  const snapKeys = Object.keys(tone).filter((k) => /^snapshot\d+$/.test(k));
  for (const sk of snapKeys) {
    const idx = Number(sk.slice(8));
    if (idx >= unit.snapshots) issues.push(`${sk} is past this unit's ${unit.snapshots} snapshots`);
    const states = tone[sk]?.blocks?.dsp0 ?? {};
    if (opts.strict) {
      for (const k of blockKeys) if (typeof states[k] !== "boolean") issues.push(`${sk} has no on/off for ${k}`);
      for (const [path, ctl] of declared) {
        if (ctl !== unit.snapshotController) continue;
        const [bk, pk] = path.split(".");
        if (tone[sk]?.controllers?.dsp0?.[bk]?.[pk]?.["@value"] === undefined) issues.push(`${sk} has no value for snapshot knob ${path}`);
      }
      for (const forbidden of ["@fs_index", "@fs_label"]) if (forbidden in (tone[sk] ?? {})) issues.push(`${sk} carries ${forbidden}, real snapshots do not`);
    }
    for (const [bk, params] of Object.entries((tone[sk]?.controllers?.dsp0 ?? {}) as Record<string, Record<string, any>>)) {
      const blk = dsp[bk];
      const m = blk ? lookup(String(blk["@model"])) : undefined;
      for (const [pk, v] of Object.entries(params)) {
        const p = m?.byKey[pk];
        if (p && v?.["@value"] !== undefined) checkValue(`${sk} ${bk}.${pk}`, p, v["@value"], issues);
      }
    }
  }
  if (opts.strict) {
    for (let i = 0; i < unit.snapshots; i++) if (!tone[`snapshot${i}`]) issues.push(`snapshot${i} missing`);
    const snapCtls = [...declared.values()].filter((c) => c > 2);
    for (const c of snapCtls) if (c !== unit.snapshotController) issues.push(`snapshot knob uses controller ${c}; this unit uses ${unit.snapshotController}`);
  }

  // Footswitches
  for (const [bk, f] of Object.entries((tone.footswitch?.dsp0 ?? {}) as Record<string, any>)) {
    if (!dsp[bk]) issues.push(`footswitch ${bk} has no block`);
    const i = f["@fs_index"];
    if (typeof i !== "number" || i < 1 || i > unit.fsMax) issues.push(`footswitch ${bk} @fs_index ${i} is not a switch on this unit`);
  }
  return issues;
}
