import { CATEGORIES, CATEGORY_MAP, DEVICE_MAP } from "./categories";
import { helixIdFor } from "./helix-ids";
import { AMP_MODELS } from "./models-amps";
import { CAB_MODELS } from "./models-cabs";
import { FX_MODELS } from "./models-fx";
import type { CategoryId, EquivalentHit, HxModel, Instrument, StompModelId } from "./types";

export const ALL_MODELS: HxModel[] = [...FX_MODELS, ...AMP_MODELS, ...CAB_MODELS];

export const MODEL_MAP: Record<string, HxModel> = Object.fromEntries(
  ALL_MODELS.map((m) => [m.id, m]),
);

/** Real-world names players type. First id is the closest HX model. */
export const PEDAL_ALIASES: Record<string, string[]> = {
  "ds-1": ["deez-one-vintage", "deez-one-mod"],
  ds1: ["deez-one-vintage", "deez-one-mod"],
  "ds 1": ["deez-one-vintage", "deez-one-mod"],
  "boss ds-1": ["deez-one-vintage", "deez-one-mod"],
  "boss ds1": ["deez-one-vintage", "deez-one-mod"],
  "boss ds 1": ["deez-one-vintage", "deez-one-mod"],
  "sd-1": ["stupor-od"],
  sd1: ["stupor-od"],
  "sd 1": ["stupor-od"],
  "boss sd-1": ["stupor-od"],
  "super overdrive": ["stupor-od"],
  "ts-9": ["scream-808"],
  ts9: ["scream-808"],
  "ts-808": ["scream-808"],
  ts808: ["scream-808"],
  "tube screamer": ["scream-808"],
  "cry baby": ["teardrop-310", "fassel", "weeper"],
  crybaby: ["teardrop-310"],
  "gcb-95": ["teardrop-310"],
  klon: ["minotaur"],
  centaur: ["minotaur"],
  rat: ["vermin-dist"],
  "proco rat": ["vermin-dist"],
  "big muff": ["bighorn-fuzz", "triangle-fuzz"],
  "small clone": ["70s-chorus"],
  "ce-1": ["70s-chorus"],
  ce1: ["70s-chorus"],
  "dual rectifier": ["cali-rectifire"],
  recto: ["cali-rectifire"],
  "jcm 800": ["brit-2203", "brit-2204"],
  jcm800: ["brit-2203", "brit-2204"],
  "twin reverb": ["us-double-nrm", "us-double-vib"],
  "deluxe reverb": ["us-deluxe-nrm", "us-deluxe-vib"],
  ac30: ["essex-a30"],
  "ac-30": ["essex-a30"],
  whammy: ["pitch-wham"],
  "mu-tron": ["mutant-filter"],
  mutron: ["mutant-filter"],
  "memory man": ["elephant-man"],
  "space echo": ["cosmos-echo"],
  echoplex: ["transistor-tape"],
  "sdd-3000": ["vintage-digital"],
  sdd3000: ["vintage-digital"],
  "dod 250": ["top-secret-od", "overdrive-legacy"],
  "od-250": ["top-secret-od", "overdrive-legacy"],
};

function normAlias(q: string) {
  return q.trim().toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();
}

export function lookupAliases(query: string): string[] {
  const q = normAlias(query);
  if (q.length < 2) return [];
  const dashed = q.replace(/\s+/g, "-");
  const squeezed = q.replace(/[\s-]+/g, "");
  return PEDAL_ALIASES[q] ?? PEDAL_ALIASES[dashed] ?? PEDAL_ALIASES[squeezed] ?? [];
}

export function modelsByCategory(id: CategoryId): HxModel[] {
  return ALL_MODELS.filter((m) => m.category === id);
}

export function searchModels(query: string, instrument?: Instrument): HxModel[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return instrument && instrument !== "both"
      ? ALL_MODELS.filter((m) => m.instrument === "both" || m.instrument === instrument)
      : ALL_MODELS;
  }
  const terms = q.split(/\s+/).filter(Boolean);
  const aliasList = lookupAliases(q);
  const aliasIds = new Set(aliasList);
  const instrumentOk = (m: HxModel) =>
    !(instrument && instrument !== "both" && m.instrument !== "both" && m.instrument !== instrument);

  if (aliasList.length) {
    const aliased = aliasList.map((id) => MODEL_MAP[id]).filter((m): m is HxModel => Boolean(m) && instrumentOk(m));
    const extras = ALL_MODELS.filter((m) => {
      if (!instrumentOk(m) || aliasIds.has(m.id)) return false;
      const hay = `${m.name} ${m.basedOn} ${m.tags.join(" ")}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    return [...aliased, ...extras];
  }

  return ALL_MODELS.filter((m) => {
    if (!instrumentOk(m)) return false;
    const hay = `${m.name} ${m.basedOn} ${m.description} ${m.tags.join(" ")} ${m.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function scoreModel(model: HxModel, q: string, aliasIds: Set<string>): number {
  if (aliasIds.has(model.id)) return aliasIds.size && [...aliasIds][0] === model.id ? 100 : 94;
  const name = model.name.toLowerCase();
  const based = model.basedOn.toLowerCase();
  const tags = model.tags.map((t) => t.toLowerCase());
  if (based === q || name === q) return 100;
  if (tags.some((t) => t === q)) return 92;
  if (based.startsWith(q) || name.startsWith(q)) return 80;
  if (tags.some((t) => t.startsWith(q))) return 74;
  if (based.includes(q)) return 68;
  if (name.includes(q)) return 60;
  if (tags.some((t) => t.includes(q))) return 54;
  if (model.description.toLowerCase().includes(q)) return 30;
  return 0;
}

export function findEquivalents(query: string, limit = 8): EquivalentHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const aliasIds = new Set(lookupAliases(q));
  const scored = ALL_MODELS.map((m) => {
    const parts = q.split(/\s+/);
    const score = Math.max(
      scoreModel(m, q, aliasIds),
      ...parts.map((p) => (p.length > 2 ? scoreModel(m, p, aliasIds) * 0.7 : 0)),
    );
    return { model: m, score };
  })
    .filter((x) => {
      if (x.score < 30) return false;
      // Alias queries ("DS-1") must not pick up a stand-in's disclaimer
      // ("this is the SD-1, not the DS-1") via description text.
      if (aliasIds.size && !aliasIds.has(x.model.id) && x.score < 80) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ model, score }) => ({
    modelId: model.id,
    score: Math.round(score),
    reason:
      score >= 80
        ? `Direct match for ${model.basedOn}`
        : score >= 60
          ? `Close model of ${model.basedOn}`
          : `Related — ${model.basedOn}`,
  }));
}

export function compactCatalogForPrompt(instrument?: Instrument, deviceId?: StompModelId): string {
  const device = deviceId ? DEVICE_MAP[deviceId] : undefined;
  const rows: string[] = [];
  for (const cat of CATEGORIES) {
    if (device && !device.hasAmpCab && ["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"].includes(cat.id)) {
      continue;
    }
    const models = modelsByCategory(cat.id).filter((m) => {
      if (m.io === "legacy") return false;
      if (cat.id === "mic" || cat.id === "ir") return false;
      if (!helixIdFor(m.id)) return false;
      if (!instrument || instrument === "both") return true;
      return m.instrument === "both" || m.instrument === instrument;
    });
    if (!models.length) continue;
    rows.push(`# ${cat.label}`);
    for (const m of models) {
      rows.push(`- ${m.id}|${m.basedOn}`);
    }
  }
  return rows.join("\n");
}

export { CATEGORIES, CATEGORY_MAP };
