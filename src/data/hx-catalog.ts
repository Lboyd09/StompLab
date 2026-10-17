import { HX_CATALOG_JSON } from "./hx-catalog.gen";

/**
 * HX Edit's own model catalog (HX Edit 3.82 via retr0h/toneharness, MIT — see HX_CATALOG_NOTICE.md).
 * One source of truth for every @model id, its knobs, their native ranges, defaults and DSP cost.
 * Stomp, Stomp XL, Floor and LT share models and parameters; Floor alone has FX Loop 3/4.
 */

export type HxParamType = "f" | "i" | "b";

export type HxParam = {
  key: string;
  label: string;
  type: HxParamType;
  min: number;
  max: number;
  def: number | boolean;
  unit: string;
};

export type HxCatModel = {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  subcategory: string;
  stereo: boolean;
  dsp: { mono: number; stereo: number };
  params: HxParam[];
  byKey: Record<string, HxParam>;
};

type RawParam = [string, HxParamType, number, number, number | boolean, string];
type RawModel = { n: string; b: string; c: string; sc: string; s: 0 | 1; d: [number, number]; p: Record<string, RawParam> };

let cache: Record<string, HxCatModel> | null = null;

function load(): Record<string, HxCatModel> {
  if (cache) return cache;
  const raw = JSON.parse(HX_CATALOG_JSON) as { models: Record<string, RawModel> };
  const out: Record<string, HxCatModel> = {};
  for (const [id, m] of Object.entries(raw.models)) {
    const params = Object.entries(m.p).map(([key, [label, type, min, max, def, unit]]) => ({
      key,
      label,
      type,
      min,
      max,
      def,
      unit,
    }));
    out[id] = {
      id,
      name: m.n,
      basedOn: m.b,
      category: m.c,
      subcategory: m.sc,
      stereo: m.s === 1,
      dsp: { mono: m.d[0], stereo: m.d[1] },
      params,
      byKey: Object.fromEntries(params.map((p) => [p.key, p])),
    };
  }
  cache = out;
  return out;
}

export function hxModel(id: string | undefined): HxCatModel | undefined {
  if (!id) return undefined;
  return load()[id];
}

export function hxModelIds(): string[] {
  return Object.keys(load());
}

/** Floor-only I/O models (the Floor has four sends/returns; Stomp, XL and LT have two). */
const FLOOR_ONLY = /^HD2_(FXLoop(Mono3|Mono4|Stereo3_4)|Send(Mono3|Mono4|Stereo3_4)|Return(Mono3|Mono4|Stereo3_4))$/;

export type HxUnitFamily = "stomp" | "floor" | "lt" | "effects";

/** Whether a catalog model can be loaded on that HX unit. POD Go has its own list (pod-go-models.ts). */
export function hxModelOnUnit(id: string, unit: HxUnitFamily): boolean {
  const m = hxModel(id);
  if (!m) return false;
  if (FLOOR_ONLY.test(id) && unit !== "floor") return false;
  if (unit === "effects" && (m.category === "amp" || m.category === "cab" || m.category === "preamp" || /^HD2_(Preamp|Cab|Amp)/.test(id))) {
    return false;
  }
  return true;
}

/** HX "Note Sync" values (SyncSelect1/2), 1-based, as HX Edit lists them. 8 = dotted eighth. */
export const SYNC_NOTES = [
  "1/1",
  "1/2 dotted",
  "1/2",
  "1/2 triplet",
  "1/4 dotted",
  "1/4",
  "1/4 triplet",
  "1/8 dotted",
  "1/8",
  "1/8 triplet",
  "1/16 dotted",
  "1/16",
  "1/16 triplet",
  "1/32 dotted",
  "1/32",
  "1/32 triplet",
  "1/64 dotted",
  "1/64",
  "1/64 triplet",
] as const;

export const SYNC_DOTTED_EIGHTH = 8;

/** Beats per note for each SyncSelect value (quarter note = 1 beat). */
export function syncNoteBeats(sel: number): number {
  const base = [4, 2, 1, 0.5, 0.25, 0.125, 0.0625];
  const i = Math.max(1, Math.min(19, Math.round(sel))) - 1;
  if (i === 0) return 4;
  const group = Math.floor((i - 1) / 3) + 1; // 1 = half, 2 = quarter, …
  const kind = (i - 1) % 3; // 0 dotted, 1 straight, 2 triplet
  const straight = base[group];
  return kind === 0 ? straight * 1.5 : kind === 1 ? straight : (straight * 2) / 3;
}
