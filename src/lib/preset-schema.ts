import { z } from "zod";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import { helixIdFor } from "@/data/helix-ids";
import { PLAYBACK_MAP, routeFor } from "@/data/playback";
import type { GearRecommendation, PlaybackTarget, Preset, StompBlock, StompModelId, UserGear } from "@/data/types";
import { guitarArrangement } from "@/data/guitar-parts";
import { guitarRolePrompt, parseGuitarRole, type GuitarRole } from "./guitar-role";
import { newId } from "./preset-utils";
import { normalizeBlockParams } from "./hx-params";
import { fitSnapshotName, sanitizeSnapshots } from "./snapshot-sanitize";

export const GearSchema = z.object({
  id: z.string(),
  kind: z.enum(["guitar", "bass", "amp", "cab", "pedal", "pickup"]),
  name: z.string(),
  notes: z.string(),
});

/** Cab Mic in the UI is 0–12 (SM57 = 0). Gemini often emits "SM57" instead. */
const MIC_NAME: Record<string, number> = {
  sm57: 0,
  "57": 0,
  "57dynamic": 0,
  "409": 1,
  "421": 2,
  "30": 3,
  "20": 4,
  "121": 5,
  "160": 6,
  "4038": 7,
  "414": 8,
  "84": 9,
  "67": 10,
  "87": 11,
  "47": 12,
  "112": 0,
};

function coerceNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const key = v.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (key in MIC_NAME) return MIC_NAME[key];
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Knobs arrive as {Knob: value} or, from the response schema, as [{name, value}]. */
function coerceParams(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw
        .filter((k): k is { name: unknown; value: unknown } => Boolean(k) && typeof k === "object" && "name" in k)
        .map((k) => [String(k.name ?? "").trim(), k.value])
    : Object.entries(raw as Record<string, unknown>);
  const out: Record<string, number> = {};
  for (const [k, v] of entries) {
    if (!k) continue;
    const n = coerceNum(v);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

const Params = z.preprocess(coerceParams, z.record(z.string(), z.number()));

export const BlockOut = z.object({
  modelId: z.string(),
  enabled: z.preprocess((v) => (v === "false" || v === 0 ? false : v !== false), z.boolean()).optional(),
  params: Params.optional(),
});

/** Overrides arrive as {modelId: knobs} or, from the response schema, as [{modelId, params}]. */
const Overrides = z.preprocess((v) => {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, Record<string, number>> = {};
  const entries: [string, unknown][] = Array.isArray(v)
    ? v
        .filter((o): o is { modelId: unknown; params: unknown } => Boolean(o) && typeof o === "object" && "modelId" in o)
        .map((o) => [String(o.modelId ?? "").trim(), o.params])
    : Object.entries(v as Record<string, unknown>);
  for (const [modelId, params] of entries) {
    if (!modelId) continue;
    out[modelId] = { ...out[modelId], ...coerceParams(params) };
  }
  return out;
}, z.record(z.string(), z.record(z.string(), z.number())));

export const PresetOut = z.object({
  name: z.string(),
  tempo: z.preprocess((v) => coerceNum(v) ?? 120, z.number()),
  tuning: z.string().optional().default(""),
  guitarist: z.string().optional().default(""),
  summary: z.string().optional().default(""),
  fingerprint: z.string().optional().default(""),
  originalGear: z
    .array(
      z.object({
        role: z.string().optional().default("Gear"),
        name: z.string(),
        notes: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  recommendedGear: z
    .array(
      z.object({
        item: z.string(),
        why: z.string().optional().default(""),
        kind: z.string().optional(),
        fromLocker: z.boolean().optional(),
      }),
    )
    .optional(),
  blocks: z.array(BlockOut).min(1).max(16),
  snapshots: z
    .array(
      z.object({
        name: z.string(),
        color: z.string().optional().default("#c5c9c2"),
        enabledModelIds: z.array(z.string()).optional(),
        sections: z.string().optional().default(""),
        changes: z.string().optional().default(""),
        notes: z.string().optional().default(""),
        paramOverrides: Overrides.optional(),
      }),
    )
    .optional()
    .default([]),
  footswitches: z
    .array(
      z.object({
        index: z.preprocess((v) => coerceNum(v) ?? 1, z.number()),
        label: z.string().optional().default("FS"),
        color: z.string().optional().default("#c5c9c2"),
        action: z
          .enum(["bypass", "snapshot", "tap", "tuner", "looper", "preset-up", "preset-down", "mode"])
          .optional()
          .default("snapshot"),
        targetModelId: z.string().optional(),
        snapshotName: z.string().optional(),
        notes: z.string().optional().default(""),
      }),
    )
    .optional()
    .default([]),
  programming: z.array(z.string()).optional().default([]),
  tips: z.array(z.string()).optional().default([]),
  song: z.string().optional(),
  artist: z.string().optional(),
});

export type PresetOutT = z.infer<typeof PresetOut>;

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON in model response");
  return JSON.parse(raw.slice(start, end + 1));
}

/** Never surface Zod dumps to the visitor. */
export function parsePresetJson(json: unknown): PresetOutT {
  if (json && typeof json === "object") {
    const rec = json as Record<string, unknown>;
    const code = String(rec.error ?? rec.reason ?? "");
    if (
      rec.unknown === true ||
      rec.unknown_song === true ||
      /unknown_song|not_a_song|no_song/i.test(code)
    ) {
      throw new Error("We couldn't find that song. Check the title and artist, or open a demo.");
    }
  }
  const result = PresetOut.safeParse(json);
  if (result.success) return result.data;
  throw new Error("We couldn't read that preset. Try that song again.");
}

export function toPreset(
  out: PresetOutT,
  meta: {
    source: Preset["source"];
    instrument: "guitar" | "bass";
    stompModel: StompModelId;
    song?: string;
    artist?: string;
    playbackTarget?: PlaybackTarget;
  },
): Preset {
  const device = DEVICE_MAP[meta.stompModel] ?? DEVICE_MAP["hx-stomp"];
  const skipAmpCab = !device.hasAmpCab;
  const AMP_CAB = new Set(["amp-guitar", "amp-bass", "preamp", "cab", "mic", "ir"]);
  const blocks: StompBlock[] = [];
  for (const b of out.blocks) {
    const model = MODEL_MAP[b.modelId];
    if (!model) continue;
    if (!helixIdFor(model.id)) continue;
    if (skipAmpCab && AMP_CAB.has(model.category)) continue;
    // An amp and the cab after it are one block on the unit.
    const prev = blocks[blocks.length - 1];
    const fusedCab = model.category === "cab" && prev && ["amp-guitar", "amp-bass", "preamp"].includes(MODEL_MAP[prev.modelId]?.category ?? "");
    const used = blocks.filter((x, i) => !(MODEL_MAP[x.modelId]?.category === "cab" && i > 0 && ["amp-guitar", "amp-bass", "preamp"].includes(MODEL_MAP[blocks[i - 1].modelId]?.category ?? ""))).length;
    if (!fusedCab && used >= device.maxBlocks) continue;
    const params = normalizeBlockParams(model.id, b.params);
    blocks.push({
      id: newId("blk"),
      modelId: model.id,
      enabled: b.enabled !== false,
      path: "main",
      position: blocks.length,
      params,
    });
  }
  if (!blocks.length) throw new Error("No valid HX models in the response");

  const snapshots = out.snapshots.slice(0, device.snapshots).map((s, i) => {
    const enabled = s.enabledModelIds?.length
      ? blocks.filter((b) => s.enabledModelIds!.includes(b.modelId)).map((b) => b.id)
      : blocks.filter((b) => b.enabled).map((b) => b.id);
    const paramOverrides: Record<string, Record<string, number>> = {};
    if (s.paramOverrides) {
      for (const [modelId, params] of Object.entries(s.paramOverrides)) {
        const block = blocks.find((b) => b.modelId === modelId);
        if (!block) continue;
        paramOverrides[block.id] = normalizeBlockParams(block.modelId, params);
      }
    }
    return {
      id: newId("snap"),
      name: s.name || `Snap ${i + 1}`,
      color: s.color || "#c5c9c2",
      enabledBlocks: enabled,
      notes: snapshotNotes(s),
      paramOverrides: Object.keys(paramOverrides).length ? paramOverrides : undefined,
    };
  });

  const footswitches = out.footswitches
    .filter((f) => f.index >= 1 && f.index <= device.footswitches)
    .map((f) => {
      const target = f.targetModelId ? blocks.find((b) => b.modelId === f.targetModelId) : undefined;
      const snap = f.snapshotName
        ? snapshots.find((s) => s.name.toLowerCase() === f.snapshotName!.toLowerCase())
        : snapshots[f.index - 1];
      return {
        index: f.index,
        label: fitSnapshotName(f.label, 12).toUpperCase(),
        color: f.color || "#c5c9c2",
        action: f.action,
        targetBlockId: target?.id,
        snapshotId: f.action === "snapshot" ? snap?.id : undefined,
        notes: f.notes,
      };
    });

  const fingerprint = (out.fingerprint ?? "").trim();
  let summary = fingerprint && !out.summary.toLowerCase().includes(fingerprint.slice(0, 28).toLowerCase())
    ? `${fingerprint} ${out.summary}`.trim()
    : out.summary;
  const guitarist = out.guitarist.trim();
  if (guitarist && meta.source === "song" && !summary.toLowerCase().includes(guitarist.toLowerCase().split(/[\s(—,-]+/)[0])) {
    summary = `${summary} Part: ${guitarist}.`.trim();
  }
  const tuning = tuningTip(out.tuning);
  const tips = tuning && !out.tips.some((t) => sameTuningTip(t, tuning)) ? [tuning, ...out.tips] : out.tips;

  return sanitizeSnapshots({
    id: newId("pst"),
    createdAt: Date.now(),
    source: meta.source,
    song: meta.song ?? out.song,
    artist: meta.artist ?? out.artist,
    instrument: meta.instrument,
    stompModel: meta.stompModel,
    name: out.name.slice(0, 18),
    tempo: Math.max(40, Math.min(240, Math.round(out.tempo || 120))),
    summary,
    originalGear: out.originalGear,
    recommendedGear: out.recommendedGear ?? [],
    blocks,
    snapshots,
    footswitches,
    programming: out.programming,
    tips,
    playbackTarget: meta.playbackTarget,
  });
}

/** What the player reads under a snapshot: which sections it covers and what changes. */
function snapshotNotes(s: { sections?: string; changes?: string; notes?: string }): string {
  const sections = (s.sections ?? "").trim();
  const what = (s.changes ?? "").trim() || (s.notes ?? "").trim();
  if (!sections) return what;
  if (!what) return sections;
  return `${sections}: ${what}`;
}

/** A model tip that already says the same retune, so it is not said twice. */
function sameTuningTip(tip: string, ours: string): boolean {
  const t = tip.toLowerCase();
  if (/half step/i.test(ours)) return /half[- ]step|\beb standard\b|e♭/.test(t);
  if (/whole step/i.test(ours)) return /whole[- ]step|\bd standard\b/.test(t);
  if (/^drop d/i.test(ours)) return /\bdrop d\b/.test(t);
  return /\btun(e|ed|ing)\b/.test(t);
}

/**
 * One plain tip for a tuning that is not E standard. No pitch block is added:
 * the player retunes the guitar.
 */
export function tuningTip(raw: string | undefined): string | null {
  const t = (raw ?? "").replace(/♭/g, "b").replace(/♯/g, "#").trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  const plain = lower.replace(/\(.*\)/g, "").replace(/\btuning\b/g, "").replace(/[^a-z#]+/g, " ").trim();
  if (/^(e )?standard( e)?$/.test(plain) || plain === "e" || plain === "") return null;
  if (/\bdrop d\b/.test(lower) && !/half|eb|d#/.test(lower)) return "Drop D: tune the low E string down to D.";
  if (/\beb\b|d#|\be flat\b|half[- ]step|semitone down/.test(lower) && !/drop/.test(lower)) {
    return "Tune down a half step (Eb standard), like the record.";
  }
  if (/\bd standard\b|whole[- ]step|full step|one step down/.test(lower) && !/drop/.test(lower)) {
    return "Tune down a whole step (D standard), like the record.";
  }
  if (/standard/.test(lower) && /^e\b/.test(lower)) return null;
  return `Tuning on the record: ${t.slice(0, 60)}.`;
}

export function overlayUserGear(preset: Preset, gear: UserGear[]): Preset {
  if (!gear.length) return preset;
  const recs: GearRecommendation[] = (preset.recommendedGear ?? []).map((r) => ({ ...r }));
  const seen = new Set(recs.map((r) => gearKey(r.item)).filter(Boolean));

  function add(item: string, why: string, kind?: GearRecommendation["kind"], fromLocker = true) {
    const key = gearKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    recs.push({ item, why, kind, fromLocker });
  }

  for (const g of gear.filter((item) => item.kind === preset.instrument)) {
    const match = preset.originalGear.find((o) => gearNamesMatch(o.name, g.name));
    add(
      g.name,
      match
        ? `Grab your ${g.name}${g.notes ? ` (${g.notes})` : ""}. Closest match to the ${match.name} on the record.`
        : `Your ${g.kind}${g.notes ? ` — ${g.notes}` : ""}. Use this for the part.`,
      g.kind,
    );
  }

  for (const orig of preset.originalGear) {
    const hit = gear.find((g) => gearNamesMatch(g.name, orig.name));
    if (hit) {
      add(
        hit.name,
        `Grab your ${hit.name}. The record used ${orig.name}${orig.notes ? ` — ${orig.notes}` : ""}.`,
        hit.kind,
      );
    }
  }

  for (const g of gear.filter((item) => item.kind === "amp")) {
    add(
      g.name,
      "If you want a real power amp, 4-cable-method into this head and bypass the Stomp cab.",
      "amp",
    );
  }
  for (const g of gear.filter((item) => item.kind === "cab")) {
    add(
      g.name,
      "Use this cab if you run 4CM or a real head. Otherwise the HX cab models the record.",
      "cab",
    );
  }
  for (const g of gear.filter((item) => item.kind === "pedal")) {
    add(
      g.name,
      "Park it in an FX Loop block if you prefer the real pedal over the HX model.",
      "pedal",
    );
  }
  for (const g of gear.filter((item) => item.kind === "pickup")) {
    add(g.name, "Your pickups — stay on this guitar if they fit the record.", "pickup");
  }

  recs.sort((a, b) => Number(Boolean(b.fromLocker)) - Number(Boolean(a.fromLocker)));
  return { ...preset, recommendedGear: recs.slice(0, 16) };
}

function gearKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function gearNamesMatch(a: string, b: string) {
  const aa = gearKey(a);
  const bb = gearKey(b);
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  if (aa.includes(bb) || bb.includes(aa)) return true;
  const aw = new Set(aa.split(" ").filter((w) => w.length > 2));
  const bw = bb.split(" ").filter((w) => w.length > 2);
  if (aw.size === 0 || bw.length === 0) return false;
  return bw.filter((w) => aw.has(w)).length >= 2;
}

export function publicPreset(preset: Preset): Preset {
  return { ...preset, recommendedGear: [] };
}

export function jsonSchemaHint() {
  return `{"guitarist":"whose part this is, e.g. 'Slash (lead guitar)'","tuning":"E standard | Eb standard | D standard | Drop D | ...","tempo":96,"originalGear":[{"role":"Guitar|Amp|Pedal|Cab","name":"real product (not 'tube amp')","notes":"how and where it was used on the record, with any published settings"}],"fingerprint":"one sentence: brightness, dirt, mids, pick attack, room","summary":"album/year/studio/producer, which player, real rig, HX stand-ins. <=240 chars","name":"<=18 chars","blocks":[{"modelId":"catalog-id","enabled":true,"params":[{"name":"Drive","value":4.5},{"name":"Bass","value":5.0},{"name":"Mid","value":6.0},{"name":"Treble","value":5.5},{"name":"Ch Vol","value":5.8}]}],"snapshots":[{"name":"Intro","sections":"Intro, Verse 1","changes":"what this player's tone does here and why, from the record","color":"#7d9a6a","enabledModelIds":["amp-id","cab-id","reverb-id"],"paramOverrides":[{"modelId":"amp-id","params":[{"name":"Drive","value":4.5},{"name":"Ch Vol","value":5.8}]}]},{"name":"Chorus","sections":"Chorus 1, Chorus 2, Outro","changes":"drive pedal on, gate on","color":"#e24a3a","enabledModelIds":["gate-id","dirt-id","amp-id","cab-id","reverb-id"],"paramOverrides":[{"modelId":"amp-id","params":[{"name":"Drive","value":4.2},{"name":"Ch Vol","value":5.8}]}]},{"name":"Solo","sections":"Guitar solo","changes":"boost on for the lift, delay on","color":"#f5d000","enabledModelIds":["gate-id","dirt-id","kinky-boost","amp-id","cab-id","delay-id","reverb-id"],"paramOverrides":[{"modelId":"kinky-boost","params":[{"name":"Boost","value":10},{"name":"Drive","value":1.2}]}]}],"footswitches":[{"index":1,"label":"INTRO","color":"#7d9a6a","action":"snapshot","snapshotName":"Intro"},{"index":2,"label":"CHORUS","color":"#e24a3a","action":"snapshot","snapshotName":"Chorus"},{"index":3,"label":"SOLO","color":"#f5d000","action":"snapshot","snapshotName":"Solo"}],"programming":["step"],"tips":["pickup, pick, guitar volume, and tuning so it plays like the record"]}
params are arrays of {"name","value"} with JSON numbers. Do not copy the example modelIds, names, or numbers — pick from the catalog and the record for THIS song.`;
}

export function jsonSchemaHintCustom() {
  return `{"guitarist":"custom","tuning":"E standard unless they asked","tempo":96,"originalGear":[{"role":"Guitar|Amp|Pedal|Cab","name":"gear this description implies","notes":"how it is used in THIS custom rig"}],"fingerprint":"","summary":"what you built and why — not a song title. <=240 chars","name":"<=18 chars","blocks":[{"modelId":"minotaur","enabled":true,"params":[{"name":"Gain","value":4.8},{"name":"Tone","value":5.2},{"name":"Level","value":6.0}]}],"snapshots":[{"name":"Rhythm","sections":"main part","changes":"","color":"#c5c9c2","enabledModelIds":["minotaur","amp-id","cab-id"],"paramOverrides":[{"modelId":"amp-id","params":[{"name":"Drive","value":4.2},{"name":"Ch Vol","value":5.4}]}]},{"name":"Lead","sections":"solo","changes":"lift, not a copied solo from a record","color":"#e24a3a","enabledModelIds":["minotaur","kinky-boost","amp-id","cab-id"],"paramOverrides":[{"modelId":"kinky-boost","params":[{"name":"Boost","value":10},{"name":"Drive","value":1.2}]}]}],"footswitches":[{"index":1,"label":"RHYTHM","color":"#c5c9c2","action":"snapshot","snapshotName":"Rhythm"},{"index":4,"label":"GATE","color":"#f5d000","action":"bypass","targetModelId":"noise-gate"}],"programming":["step"],"tips":["how to play THIS sound"]}
params are arrays of {"name","value"}: knob names from the catalog line for that model, values JSON numbers 0-10. Set every knob that shapes the tone. Every snapshot's enabledModelIds MUST include the amp and the cab. This is a CUSTOM sound — do not name a real song in summary. Do not copy a featured demo chain.`;
}

const STAND_INS = `HX stand-ins (use these ids, never invent):
- BOSS DS-1 → deez-one-vintage (MIJ) or deez-one-mod (Keeley). NEVER stupor-od (that is the SD-1). BOSS SD-1 → stupor-od.
- Ibanez TS808/TS-9 → scream-808. ProCo RAT → vermin-dist. Klon → minotaur. Big Muff → bighorn-fuzz or triangle-fuzz. Marshall Shredmaster → kwb.
- BOSS CE-2 → chorus. BOSS CE-1 / EHX Small Clone → 70s-chorus.
- Mesa Dual Rectifier → cali-rectifire. Mesa Studio Pre / Mark clean rhythm as a pedal platform → cali-iv-rhythm-1. Mark IV crunch → cali-iv-rhythm-2, lead → cali-iv-lead.
- Fender Twin Reverb → us-double-nrm (NOT us-deluxe-nrm — Deluxe is a different amp). Fender Deluxe Reverb → us-deluxe-nrm. Fender Eighty-Five / solid-state clean platform → us-deluxe-nrm.
- Marshall JCM-800 → brit-2203 or brit-2204. Plexi → brit-plexi-brt. Silver Jubilee 2555 → placater-dirty. Hiwatt DR-103 → whowatt-100. Diezel VH4 → das-benzin-lead (lead) or das-benzin-mega (tight rhythm).
- Korg SDD-3000 → vintage-digital. Memory Man → elephant-man. Space Echo / RE-201 → cosmos-echo. Binson Echorec → echo-platter-legacy. EP-3 → transistor-tape.
- Cry Baby → teardrop-310. Vox V846 → uk-wah-846. Mu-Tron III → mutant-filter. Whammy → pitch-wham.
- Mesa 5-band graphic → cali-q-graphic. Marshall 1960 G12T-75 → 4x12-1960-t75. Mesa V30 4x12 → 4x12-cali-v30. SansAmp bass → zeroamp-bass-di.
Only catalog modelId values.`;

const KNOB_RULES = `KNOBS: use the knob names listed for each model (the real HX Edit controls). Values are 0–10 like HX Edit's screen, 5 = noon. Set every knob that shapes this tone; one left out keeps Line 6's factory default.
- dB knobs (effect Level, comp Gain, EQ bands): 5 = 0 dB.
- Low Cut ≈ 20 + 30 × value Hz (2 ≈ 80 Hz guitar, 0.7 ≈ 40 Hz bass). High Cut ≈ 1.5 + 1.86 × value kHz.
- Whole-number knobs carry the real setting: Interval in semitones, Mic number (0 = 57 Dynamic), Mode / Clipping / Voice count from 0.
- On/off knobs (Boost, Bright, Peak Type): 10 = on, 0 = off.`;

const DELAY_RULES = `DELAY: a delay whose repeats follow the beat (almost every rock, pop and worship delay) uses Note, never Time: 8 = dotted eighth, 6 = quarter, 9 = eighth, 5 = dotted quarter, 12 = sixteenth, 7 = quarter triplet (a quarter is 60000 / BPM ms, a dotted eighth 0.75 of that). A slapback or free-running delay leaves Note out and sets Time (value × 100 ms; slapback 0.8–1.4).`;

/**
 * Where the hand-built demos (src/data/featured.ts) sit. They A/B well on
 * hardware, so generated presets are calibrated to the same ranges.
 */
const REFERENCE_LEVELS = `REFERENCE SETTINGS (hand-built presets that A/B well on hardware; stay in range unless the record or a published setting says otherwise):
- Amp: Ch Vol 5.4–6.2, Master 4.6–5.6, Presence 3–5.5, Sag 2.8–4.2. Every amp sets its gain knob (Drive, Gain, or its own name) in base params. Drive: clean 0.6–2.4; edge of breakup 2.5–3.5; classic crunch 4.5–6; high-gain riff with no pedal 5–6.5; metal ≤ 7; high-gain amp behind a TS 3.4–4.5 (the pedal tightens). Never dime Drive unless the session documented it. Mid-gain records stay mid-gain; guitar volume is a gain stage.
- Drive pedals: about noon (4.5–6.5) unless a published number exists. TS as a tightener: Gain 1–2.5, Level 7–8, Tone 5–5.5.
- Solo lift: kinky-boost, Boost 10 (its switch on), Drive 1–1.5 (about +3 dB). Amp Drive and Ch Vol stay where the riff had them.
- Delay: lead Mix 1.8–2.5, Feedback 2.5–3.5. Slapback Mix 1.5–2.5, one repeat. Ambient dotted eighth that is the sound (U2 / worship): Mix 3–4, Feedback 3–4.5.
- Reverb: dry studio rock Room/Plate Mix 1–2, Decay 1.5–3.5; ballad / ambient Mix 2.5–4; Mix 5+ only for a wash.
- Cab: Mic 0 (57), Distance 1.6–3, Low Cut 2–2.8, High Cut 7–8, Early Refl 2.2–4.2.
- Gate: Threshold 1.6–1.8 (above 2.2 mutes), Decay 2.4, Level 5.`;

/** What the model may put in the amp/cab spot, from the unit and the player's rig (SL-62). */
function ampRuleFor(hasAmpCab: boolean, playbackTarget: PlaybackTarget): string {
  if (!hasAmpCab) {
    return "HX Effects has NO amp, cab, preamp, or IR. Pedals only. If they need a real amp, say so in tips and use send-return. Never emit amp-guitar, amp-bass, preamp, cab, mic, or ir blocks. Ignore every rule about amp Drive, Ch Vol, or keeping amp and cab on.";
  }
  const route = routeFor(playbackTarget);
  if (route === "pedals" || route === "4cm") {
    return "The player's real guitar amp is the amp and the speaker. Never emit amp-guitar, amp-bass, preamp, cab, mic, or ir blocks — pedals only. Ignore every rule about amp Drive, Ch Vol, or keeping amp and cab on: there is no amp block. Put the record's gain in drive pedals and the noise-gate after them.";
  }
  if (route === "no-cab") {
    return "One amp, and NO cab, mic, or ir block: the speaker is real. Snapshot Drive/Ch Vol instead of a second amp. Ignore every rule about the cab.";
  }
  return "One amp. Bypassed amps still cost DSP. Snapshot Drive/Ch Vol instead of a second amp.";
}

function exportRuleFor(d: (typeof DEVICE_MAP)[StompModelId]): string {
  return d.exportFormat === "hlx"
    ? `Export is a .hlx for ${d.name} (device ${d.hlxDeviceId ?? "?"}). No invented models, dual-path splits, IRs, or features this unit lacks.`
    : d.exportFormat === "pgp"
      ? `Export is a .pgp for POD Go Edit. POD Go has a built-in wah, volume pedal, amp, cab and EQ plus FOUR free effect blocks — at most 4 effects besides those. Only the models listed.`
      : `${d.name} cannot export a file. Still return a real HX chain they can copy by hand.`;
}

/** Snapshot switches, then the spares, from the unit's real switch and snapshot counts. */
function footswitchRule(snapCount: number, footswitches: number): string {
  const n = Math.min(snapCount, footswitches);
  const spare =
    footswitches > n
      ? ` Spare FS ${n + 1}+ = action "bypass" for GATE, then EQ, then WAH, only if those blocks exist.`
      : " No spare switches: any spare-FS instruction (wah, gate, EQ) does not apply here; those blocks switch per snapshot.";
  return `FOOTSWITCHES: FS 1–${n} = action "snapshot", in snapshot order.${spare} No TAP on a snapshot switch.`;
}

export function systemForDevice(
  stompModel: StompModelId,
  instrument: "guitar" | "bass",
  playbackTarget: PlaybackTarget = "frfr",
) {
  const d = DEVICE_MAP[stompModel] ?? DEVICE_MAP["hx-stomp"];
  const play = PLAYBACK_MAP[playbackTarget];
  const ampRule = ampRuleFor(d.hasAmpCab, playbackTarget);
  const snapCount = d.snapshots;
  const route = routeFor(playbackTarget);
  const ampInChain = d.hasAmpCab && route !== "pedals" && route !== "4cm";
  const keepOn = !ampInChain ? "" : route === "no-cab" ? "lists the amp in enabledModelIds (omitting it mutes it), and " : "lists the amp and cab in enabledModelIds (omitting them mutes it), and ";
  const solo =
    instrument === "bass"
      ? "- Bass overrides the guitar ranges above: no kinky-boost, bass cab Low Cut 0.5–1 so the low E stays."
      : `- The solo / lead part is always one of the ${snapCount}; if the song has more tone changes, merge the closest non-solo sections. A solo is almost never the rhythm tone: kinky-boost on for that snapshot only (not extra amp Drive, not only a Ch Vol nudge), plus its own delay/scoop changes in paramOverrides so they export.`;
  return `Program a Line 6 ${d.name} preset that A/Bs against the RECORD, the way a session tech would. Not a genre template, not a cover.
Max ${d.maxBlocks} blocks (an amp and its cab count as one), ${snapCount} snapshots, ${d.footswitches} footswitches. Instrument: ${instrument}.
${exportRuleFor(d)}

${KNOB_RULES}
${DELAY_RULES}

${REFERENCE_LEVELS}

CHAIN:
- Every block must be on the recording: guitar/pickups, amp + channel, pedal order, cab + mic. No spare chorus, hall, or comp. Skip Poly Pitch/Wham/12-string/Trinity Chorus unless the song needs them.
- Order: the documented order, else wah → comp → dirt → amp → cab → modulation → delay → reverb.
- ${ampRule}
- Unknown rock song ≠ Dual Rectifier. Unknown Fender song ≠ Deluxe. Pick the closest documented amp from that album/era.
- PEDAL PLATFORM: a clean head/preamp used as a pedal platform (Mesa Studio Pre, Hiwatt, Twin) uses its CLEAN channel. The pedal is the dirt.
- GATE: noise-gate in front of the amp only for a high-gain amp (or amp Drive ≥ 4.5) or a drive/fuzz with its gain at 6+. A low-gain overdrive or Klon on a clean amp gets no gate. Bypassed on clean snapshots. Never hard-gate.
- EQ follows the record: mid-forward stays mid-forward, scooped stays scooped, dark stays dark. Add simple-eq, parametric or cali-q-graphic only if the session used a dedicated EQ (Mesa graphic, rack EQ); a session graphic sits between amp and cab. Snapshots toggle it.
- SATURATING ECHO: Echorec / tape / Memory Man tracked in front of dirt goes BEFORE the amp. A digital dotted eighth usually goes after.
- SINGING FUZZ: a Big Muff has Sustain, Tone, Level only (no Mid knob); keep Tone near 4–5 for a vocal lead. No TS stacked on a muff unless the session did.
- TIGHT CHUG: TS tightener into a high-gain amp at moderate Drive, not a wall of Drive 7+.
- ${play.prompt}

SNAPSHOTS (at most ${snapCount}):
- Walk the record first bar to last. A snapshot only where this player's TONE changes (blocks or knobs); sections that share a chain are one snapshot. Song order, first sound first.
- CLEAN OPENING: snapshot 1 is the recorded opening. A clean intro is clean: dirt off, gate off, amp Drive ≤ 2.4. A riff intro keeps its full drive.
${solo}
- VERSE MOD: a chorus/vibe that is the verse identity turns OFF for a dry anthem chorus unless the record left it on.
- Every snapshot ${keepOn}fills "sections" (song parts it covers, in order) and "changes" (what differs from the snapshot before, and why).
- LEVELS: sections sit at the record's level. Ch Vol, Output, Level, Master and Boost stay ≥ 3.2 (0 recalls as mute); volume pedal never at the heel. A clean snapshot gets Ch Vol +0.5–1 over the dirty one.
- NAMES (12 characters): the song section (Intro, Verse, Chorus, Bridge, Solo, Outro). "Clean" only when the part is truly clean; "Solo"/"Lead" only on the solo snapshot. Abbreviate whole words (Chors, Crnch, Brdg, Cln Ambient); never cut one in half.
- ${footswitchRule(snapCount, d.footswitches)}

originalGear notes not backed by a session credit, interview, or published rig (or that the research notes call likely) start with "Likely —".
programming = unit steps. tips = pick, pickup, guitar volume, and tuning so the player can match the record.

${STAND_INS}`;
}

/** Song-specific research brief. Hardware and tone rules live in systemForDevice; catalog + schema are appended by the caller. */
export function songResearchInstructions(
  song: string,
  artist: string | undefined,
  instrument: "guitar" | "bass",
  wahLine?: string,
  guitarRole: GuitarRole = "both",
) {
  const title = song.trim();
  const billed = (artist ?? "").trim();
  const who = billed ? `${title} by ${billed}` : title;
  return `Song: ${who}
Instrument: ${instrument} as it was TRACKED on the record: the original studio album version (not a cover, live version, remaster with new parts, or re-recording).
If you cannot identify a real commercially released recording matching this title with high confidence, do NOT invent a preset. Reply only: {"error":"unknown_song","message":"not a real song"}.

${guitarRolePrompt(parseGuitarRole(guitarRole), instrument, guitarArrangement(song, artist))}
originalGear: include the guitar, pickup position, and any published amp/pedal settings. Summary starts with the tone fingerprint, then album title, year, studio, producer, and which player.
Listener test: A/B the album against this preset — brightness, dirt, midrange, and room must match.
Put the record's tuning in "tuning"; no pitch block for tuning.${wahLine ? `\n${wahLine}` : ""}`;
}

export function systemForCustomSound(
  stompModel: StompModelId,
  instrument: "guitar" | "bass",
  playbackTarget: PlaybackTarget = "frfr",
) {
  const d = DEVICE_MAP[stompModel] ?? DEVICE_MAP["hx-stomp"];
  const play = PLAYBACK_MAP[playbackTarget];
  const ampRule = ampRuleFor(d.hasAmpCab, playbackTarget);
  const snapCount = d.snapshots;
  return `Session tech. Invent a NEW Line 6 ${d.name} preset from the player's description. This is a custom rig — not a song replica, not a famous player's documented patch, not a close copy of Teen Spirit / Sandman / Numb or any other record. JSON only.
Max ${d.maxBlocks} blocks, ${snapCount} snapshots, ${d.footswitches} FS. Instrument: ${instrument}.
${exportRuleFor(d)}

Custom-sound rules:
- Build only what they asked for. If they said "Klon into a Deluxe with slapback", that is the chain. Do not add a DS-1, Rectifier, wah intro, Small Clone, or any other famous-song leftover.
- Do not research a similar song and copy it. Do not name a real song in summary unless they named one.
- originalGear = the products implied by THIS description, not an album credit list.
- ${KNOB_RULES}
- ${DELAY_RULES} Lead delay Mix ≤ 2.5, Feedback ≤ 3.5.
- ${ampRule}
- GAIN: never dime Drive. Pedals ~noon (4.5–6.5). Amp Drive 1.5–3 clean, 3–5 crunch, 5–6.5 high-gain, metal 5–7.
- GATE: if the chain has a high-gain amp or a high-gain drive or fuzz, add noise-gate in front of the amp, Threshold 1.6–2, bypassed on clean snapshots. A low-gain overdrive on a clean amp gets no gate. Never hard-gate. A hot threshold mutes the snapshot.
- EQ: include simple-eq / parametric / cali-q-graphic only if they asked for a scoop, mid boost, or a graphic. Spare FS = bypass EQ. Do not add a spare EQ "just in case."
- WAH: follow the wah instruction. Do not copy a famous wah intro.
- Skip Poly Pitch/Wham/12-string/Trinity Chorus unless they asked.
- ${play.prompt}

${STAND_INS}

Order: dirt → amp → cab → time unless they specified otherwise. Amp+cab as a pair.

Snapshots: if they described scenes (clean / crunch / lead), those are the snapshots and they MUST sound different. Otherwise up to three useful scenes: Rhythm, Lift, Lead.
${footswitchRule(snapCount, d.footswitches)}

programming = unit steps. tips = how to play this custom sound.`;
}

/** Custom-sound brief. Catalog + schema are appended by the caller. */
export function customSoundInstructions(
  description: string,
  instrument: "guitar" | "bass",
  wahLine?: string,
  _guitarRole: GuitarRole = "both",
  playerName?: string,
) {
  const player = (playerName ?? "").trim();
  const playerBlock = player
    ? `Optional player to evoke (not a cover of a named song): ${player}. Capture their typical guitar, amp, gain structure, and attack. Still a CUSTOM sound — do not name a real song in summary. Do not copy a featured demo.`
    : `Do not copy a player rig from memory (Cobain, Hetfield, Gilmour, Frusciante, Morello, Edge, etc.) unless the player named them.`;
  return `CUSTOM SOUND (not a song). Instrument: ${instrument}.
Player description:
${description.trim()}

Invent a unique HX chain that delivers THAT description. Do not substitute a similar famous record.
${playerBlock}
If the description is a feeling ("warm broken-up American clean") pick the closest catalog amp and set knobs — still original, not a named-song patch.
Listener test: would a player who typed that sentence recognize this preset as what they asked for, not as a cover of a hit?
When the chain has an amp and cab, every snapshot's enabledModelIds MUST include them.
Build the one rig they described. Do not invent a second guitarist.
${wahLine ? `\n${wahLine}` : ""}`;
}

/** System line for the grounded look at the record (step 1 of a song build). */
export const RECORD_NOTES_SYSTEM =
  "Session guitarist and Line 6 preset designer doing homework before programming a patch. Search the web for the studio recording. Report facts, not a preset. Mark anything you could not confirm with 'likely'. Reply with one JSON object only, no markdown.";

/**
 * Step 1 prompt: what a session player looks up before matching a record.
 * The answer is plain text (search grounding cannot return a JSON schema on
 * 2.5 Flash), read loosely by parseRecordNotes.
 */
export function recordNotesPrompt(
  song: string,
  artist: string,
  album: string,
  instrument: "guitar" | "bass",
  guitarRole: GuitarRole = "both",
): string {
  const part =
    instrument === "bass"
      ? "the bass part"
      : guitarRole === "lead"
        ? "the LEAD guitarist's part (the player with the solo and the signature lines), not the rhythm player"
        : "the main guitar part; if the record has more than one electric guitar part, the lead / featured part";
  return `Look up the original studio album version of "${song}" by ${artist}${album ? ` (album ${album})` : ""}. Focus on ${part}.
Return one JSON object with short values:
{"bpm": album tempo as a number, taken from a tempo or chart site (SongBPM, Tunebat, Musicnotes, SongSelect, a published chart). Report the tempo the chart uses: a slow ballad or worship song is usually charted at its slow count (Oceans by Hillsong UNITED is about 67), not doubled. 0 if no source gives one,
 "bpmSource": "the site the tempo came from",
 "tuning": "E standard | Eb standard | D standard | Drop D | ... — check an official tab or chart (Songsterr, Ultimate Guitar official, Musicnotes); many 90s rock records are Drop D or Eb, so don't assume E standard",
 "guitarist": "who played this part on the record",
 "guitar": "guitar model and pickup position used",
 "amp": "amp model, channel, and any published settings",
 "pedals": "pedals in signal order, with settings and which sections they are on",
 "cab": "cab, speakers, mic if known",
 "gain": "clean / edge of breakup / crunch / high gain, per section",
 "eq": "brightness, mids, scoop, any studio EQ",
 "delay": "type, time as a note value at this tempo or in ms, how wet",
 "reverb": "type and how wet (dry / subtle / washy)",
 "sections": [{"section": "Intro", "tone": "what the part sounds like and what changes"}],
 "sources": ["site names"]}
Studio recording, not a live rig or a later tour board. If you find nothing for a field, say "unknown".`;
}

/** Loose read of the step 1 answer: a compact fact sheet for the preset prompt, plus the tempo. */
export function parseRecordNotes(text: string | null | undefined): { notes: string; bpm: number | null } {
  const raw = (text ?? "").trim();
  if (!raw) return { notes: "", bpm: null };
  let notes = raw;
  let bpm: number | null = null;
  try {
    const obj = extractJson(raw) as Record<string, unknown>;
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      bpm = Number(obj.bpm) || null;
      const rest = { ...obj };
      delete rest.bpm;
      notes = JSON.stringify(rest);
    }
  } catch {
    const m = raw.match(/\b(\d{2,3}(?:\.\d+)?)\s*bpm\b/i);
    if (m) bpm = Number(m[1]);
  }
  if (bpm !== null && (!Number.isFinite(bpm) || bpm < 40 || bpm > 240)) bpm = null;
  return { notes: notes.slice(0, 3500), bpm: bpm === null ? null : Math.round(bpm) };
}
