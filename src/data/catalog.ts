import { CATEGORIES, CATEGORY_MAP, DEFAULT_PARAMS, DEVICE_MAP, STOMP_DEVICES } from "./categories";
import { HELIX_IDS, UNEXPORTABLE_MODELS, helixIdFor } from "./helix-ids";
import { hxModel, hxModelOnUnit } from "./hx-catalog";
import { podGoIdFor } from "./podgo-catalog";
import { AMP_MODELS } from "./models-amps";
import { CAB_MODELS } from "./models-cabs";
import { FX_MODELS } from "./models-fx";
import type { CategoryId, EquivalentHit, HxModel, Instrument, StompDevice, StompModelId } from "./types";

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
  "fuzz face": ["arbitrator-fuzz"],
  "big muff pi": ["bighorn-fuzz", "triangle-fuzz"],
  "ram's head": ["bighorn-fuzz"],
  "rams head": ["bighorn-fuzz"],
  "green russian": ["bighorn-fuzz"],
  "vox wah": ["uk-wah-846"],
  v847: ["uk-wah-846"],
  "v-847": ["uk-wah-846"],
  "phase 90": ["script-mod-phase"],
  "mxr phase 90": ["script-mod-phase"],
  "carbon copy": ["analog-echo-legacy", "transistor-tape"],
  "memory man deluxe": ["elephant-man"],
  "holy grail": ["hot-springs", "plate"],
  svt: ["ampeg-svt-nrm", "ampeg-svt-brt"],
  "ampeg svt": ["ampeg-svt-nrm", "ampeg-svt-brt"],
  "5150": ["pv-panama"],
  6505: ["pv-panama"],
  plexi: ["brit-p75-nrm", "brit-p75-brt", "brit-j45-nrm"],
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

const AMP_CAB_CATS = new Set<CategoryId>(["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"]);

/** Whether this factory model is on a given Line 6 unit. */
export function modelOnDevice(model: HxModel, deviceId: StompModelId): boolean {
  const device = DEVICE_MAP[deviceId];
  if (!device) return false;
  if (!device.hasAmpCab && AMP_CAB_CATS.has(model.category)) return false;
  const hid = helixIdFor(model.id);
  if (!hid) return model.category === "mic";
  if (deviceId === "pod-go") return Boolean(podGoIdFor(hid, "pre") || podGoIdFor(hid, "post"));
  const family = deviceId === "helix-floor" ? "floor" : deviceId === "helix-lt" ? "lt" : deviceId === "hx-effects" ? "effects" : "stomp";
  return hxModelOnUnit(hid, family);
}

/** Knob names to offer Gemini for a model: HX Edit's own labels, minus amp-modeling internals. */
const HIDDEN_KNOBS = /^(Hum|Ripple|Bias|Bias X|Tempo Sync.*|Note Sync.*|Headroom|Stereo|Trails|Scale)$/i;
export function promptKnobs(modelId: string): string[] {
  const m = hxModel(helixIdFor(modelId));
  if (!m) return [];
  const names = m.params.map((p) => p.label).filter((l) => !HIDDEN_KNOBS.test(l));
  if (m.byKey.SyncSelect1) names.push("Note");
  return [...new Set(names)];
}

export function devicesForModel(model: HxModel): StompDevice[] {
  return STOMP_DEVICES.filter((d) => modelOnDevice(model, d.id));
}

export function aliasesForModel(id: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const [alias, ids] of Object.entries(PEDAL_ALIASES)) {
    if (!ids.includes(id) || seen.has(alias)) continue;
    seen.add(alias);
    names.push(alias);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

export function catalogModels(opts?: {
  query?: string;
  instrument?: Instrument;
  category?: CategoryId | "";
  deviceId?: StompModelId | "";
}): HxModel[] {
  let models = searchModels(opts?.query ?? "", opts?.instrument);
  if (opts?.category) models = models.filter((m) => m.category === opts.category);
  if (opts?.deviceId) models = models.filter((m) => modelOnDevice(m, opts.deviceId as StompModelId));
  return models;
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

function scoreModel(model: HxModel, q: string, aliasList: readonly string[]): number {
  const aliasIndex = aliasList.indexOf(model.id);
  if (aliasIndex === 0) return 100;
  if (aliasIndex > 0) return 94;
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
  const aliasList = lookupAliases(q);
  const aliasIds = new Set(aliasList);
  const scored = ALL_MODELS.map((m) => {
    const parts = q.split(/\s+/);
    const score = Math.max(
      scoreModel(m, q, aliasList),
      ...parts.map((p) => (p.length > 2 ? scoreModel(m, p, aliasList) * 0.7 : 0)),
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
    .sort((a, b) => {
      const delta = b.score - a.score;
      if (delta) return delta;
      const ai = aliasList.indexOf(a.model.id);
      const bi = aliasList.indexOf(b.model.id);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    })
    .slice(0, limit);

  return scored.map(({ model, score }) => {
    const rounded = Math.round(score);
    return {
      modelId: model.id,
      score: rounded,
      reason:
        rounded >= 100
          ? `Line 6 model: ${model.name}`
          : rounded >= 80
            ? `Direct match for ${model.name}`
            : rounded >= 60
              ? `Close model of ${model.name}`
              : `Related — ${model.name}`,
    };
  });
}

const PROMPT_LEGACY_IDS = new Set(["echo-platter-legacy"]);

export function compactCatalogForPrompt(
  instrument?: Instrument,
  deviceId?: StompModelId,
  opts?: { omitWah?: boolean },
): string {
  const device = deviceId ? DEVICE_MAP[deviceId] : undefined;
  const skipCat = new Set<string>(["mic", "ir", "looper", "volume"]);
  if (opts?.omitWah) skipCat.add("wah");
  const rows: string[] = [];
  for (const cat of CATEGORIES) {
    if (skipCat.has(cat.id)) continue;
    if (device && !device.hasAmpCab && ["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"].includes(cat.id)) {
      continue;
    }
    let models = modelsByCategory(cat.id).filter((m) => {
      // Legacy models stay out, except the Binson Echorec stand-in the stand-in list names.
      if (m.io === "legacy" && !PROMPT_LEGACY_IDS.has(m.id)) return false;
      if (!helixIdFor(m.id)) return false;
      if (deviceId === "pod-go" && String(HELIX_IDS[m.id] ?? "").startsWith("L6SPB_")) return false;
      if (!instrument || instrument === "both") return true;
      return m.instrument === "both" || m.instrument === instrument;
    });
    if (cat.id === "send-return") {
      models = models.filter((m) => ["fx-loop", "send", "return"].includes(m.id));
    }
    if (deviceId) models = models.filter((m) => modelOnDevice(m, deviceId));
    if (!models.length) continue;
    // Knobs every model in the category shares go in the header. The most common remaining set
    // (when 3+ rows share it) is the header default, so those rows carry no list; others list their own.
    const lists = models.map((m) => promptKnobs(m.id));
    const shared = (lists[0] ?? []).filter((k) => lists.every((l) => l.includes(k)));
    const owns = lists.map((l) => l.filter((k) => !shared.includes(k)).join(","));
    const counts = new Map<string, number>();
    for (const o of owns) if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
    const [common, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    // Only when no row is knob-free, or "no list" would read as the default.
    const usual = n >= 3 && owns.every(Boolean) ? common : "";
    const head = [shared.length ? `every model: ${shared.join(",")}` : "", usual ? `no list = ${usual}` : ""].filter(Boolean);
    rows.push(head.length ? `# ${cat.label} (${head.join("; ")})` : `# ${cat.label}`);
    models.forEach((m, i) => {
      const own = owns[i];
      const knobs = own && own !== usual ? `|${own}` : "";
      const based = m.basedOn === "Line 6 Original" ? "Line 6" : m.basedOn;
      rows.push(`- ${m.id}|${based}${knobs}`);
    });
  }
  return rows.join("\n");
}

export { CATEGORIES, CATEGORY_MAP };
