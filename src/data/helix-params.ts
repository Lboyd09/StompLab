import { hxModel, hxModelIds } from "./hx-catalog";

/**
 * Factory knob keys per @model, read from HX Edit's catalog (see hx-catalog.ts).
 * The exporter writes only these keys; HX Edit silently drops anything else.
 */
export const FACTORY_HLX_PARAMS: Record<string, readonly string[]> = Object.fromEntries(
  hxModelIds().map((id) => [id, hxModel(id)!.params.map((p) => p.key)]),
);

export function factoryParamsFor(helixId: string): ReadonlySet<string> | undefined {
  const list = FACTORY_HLX_PARAMS[helixId];
  return list ? new Set(list) : undefined;
}
