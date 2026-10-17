import type { HxParam, HxParamType } from "./hx-catalog";
import { PODGO_CATALOG_JSON } from "./podgo-catalog.gen";

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

/** The POD Go @model for a Helix id, given where it sits (before the amp = mono, after the cab = stereo). */
export function podGoIdFor(helixId: string, stage: "pre" | "post"): string | undefined {
  const all = load();
  const id = POD_GO_STAND_INS[helixId] ?? helixId;
  if (all[id]) return id;
  const order = stage === "pre" ? ["Mono", "Stereo"] : ["Stereo", "Mono"];
  const versioned = /^(.*?)(V\d)$/.exec(id);
  for (const suffix of order) {
    if (all[id + suffix]) return id + suffix;
    // "HD2_DelayVintageDigitalV2" is "HD2_DelayVintageDigitalStereoV2" on POD Go.
    if (versioned && all[versioned[1] + suffix + versioned[2]]) return versioned[1] + suffix + versioned[2];
  }
  return undefined;
}

/** Helix models POD Go 2.50 does not have, and the closest model it does. */
export const POD_GO_STAND_INS: Record<string, string> = {
  // Roland RE-201 Space Echo → the closest tape echo on POD Go.
  HD2_DelayCosmosEcho: "HD2_DelayTransistorTape",
};
