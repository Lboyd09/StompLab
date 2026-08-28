import { CATEGORIES, CATEGORY_MAP } from "./categories";
import { AMP_MODELS } from "./models-amps";
import { CAB_MODELS } from "./models-cabs";
import { FX_MODELS } from "./models-fx";
import type { CategoryId, EquivalentHit, HxModel, Instrument } from "./types";

export const ALL_MODELS: HxModel[] = [...FX_MODELS, ...AMP_MODELS, ...CAB_MODELS];

export const MODEL_MAP: Record<string, HxModel> = Object.fromEntries(
  ALL_MODELS.map((m) => [m.id, m]),
);

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
  return ALL_MODELS.filter((m) => {
    if (instrument && instrument !== "both" && m.instrument !== "both" && m.instrument !== instrument) {
      return false;
    }
    const hay = `${m.name} ${m.basedOn} ${m.description} ${m.tags.join(" ")} ${m.category}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

function scoreModel(model: HxModel, q: string): number {
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
  const scored = ALL_MODELS.map((m) => {
    const parts = q.split(/\s+/);
    const score = Math.max(
      scoreModel(m, q),
      ...parts.map((p) => (p.length > 2 ? scoreModel(m, p) * 0.7 : 0)),
    );
    return { model: m, score };
  })
    .filter((x) => x.score >= 30)
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

export function compactCatalogForPrompt(instrument?: Instrument): string {
  const rows: string[] = [];
  for (const cat of CATEGORIES) {
    const models = modelsByCategory(cat.id).filter((m) => {
      if (m.io === "legacy") return false;
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
