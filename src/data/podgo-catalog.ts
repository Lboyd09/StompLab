import type { HxParam, HxParamType } from "./hx-catalog";
import { PODGO_CATALOG_JSON } from "./podgo-catalog.gen";
import { podGoIdFor, POD_GO_STAND_INS } from "./podgo-ids";

/**
 * POD Go Edit 2.50's model catalog (via fargraph/pod-go-presets, MIT — see HX_CATALOG_NOTICE.md).
 * POD Go uses the Helix ids, but effects carry a Mono/Stereo suffix (the path is mono into the amp
 * and stereo after the cab), and the built-in EQ slot uses HD2_EQ_STATIC_* models.
 */

export type PodGoModel = { id: string; name: string; category: string; dsp: number; params: HxParam[]; byKey: Record<string, HxParam> };

type RawParam = [string, HxParamType, number, number, number | boolean, string];

let cache: Record<string, PodGoModel> | null = null;

function load(): Record<string, PodGoModel> {
  if (cache) return cache;
  const raw = JSON.parse(PODGO_CATALOG_JSON) as {
    models: Record<string, { n: string; c: string; d: number; p: Record<string, RawParam> }>;
  };
  const out: Record<string, PodGoModel> = {};
  for (const [id, m] of Object.entries(raw.models)) {
    const params = Object.entries(m.p).map(([key, [label, type, min, max, def, unit]]) => ({ key, label, type, min, max, def, unit }));
    out[id] = { id, name: m.n, category: m.c, dsp: m.d, params, byKey: Object.fromEntries(params.map((p) => [p.key, p])) };
  }
  cache = out;
  return out;
}

export function podGoModel(id: string | undefined): PodGoModel | undefined {
  return id ? load()[id] : undefined;
}

export { podGoIdFor, POD_GO_STAND_INS };
