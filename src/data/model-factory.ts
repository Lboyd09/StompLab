import { DEFAULT_PARAMS } from "./categories";
import type { CategoryId, DspWeight, HxModel, Instrument, IoType } from "./types";

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeAbbrev(name: string) {
  const cleaned = name.replace(/\bLegacy\b/gi, "").replace(/[()]/g, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 4);
  if (parts.length === 2) return (parts[0].slice(0, 2) + parts[1].slice(0, 2)).slice(0, 4);
  return parts
    .map((p) => p[0])
    .join("")
    .slice(0, 4);
}

export function m(
  category: CategoryId,
  name: string,
  basedOn: string,
  description: string,
  tags: string,
  extra?: {
    io?: IoType;
    instrument?: Instrument;
    dsp?: DspWeight;
    params?: string[];
    abbrev?: string;
    id?: string;
  },
): HxModel {
  const io = extra?.io ?? (name.toLowerCase().includes("legacy") ? "legacy" : "mono-stereo");
  return {
    id: extra?.id ?? slug(name),
    name,
    category,
    basedOn,
    description,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    io,
    instrument: extra?.instrument ?? "both",
    dsp: extra?.dsp ?? "medium",
    abbrev: extra?.abbrev ?? makeAbbrev(name),
    params: extra?.params ?? DEFAULT_PARAMS[category],
  };
}
