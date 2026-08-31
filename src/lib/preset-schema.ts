import { z } from "zod";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import { helixIdFor } from "@/data/helix-ids";
import type { Preset, StompBlock, UserGear } from "@/data/types";
import { newId } from "./preset-utils";

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

function coerceParams(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
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

const Overrides = z.preprocess((v) => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, Record<string, number>> = {};
  for (const [modelId, params] of Object.entries(v as Record<string, unknown>)) {
    out[modelId] = coerceParams(params);
  }
  return out;
}, z.record(z.string(), z.record(z.string(), z.number())));

export const PresetOut = z.object({
  name: z.string(),
  tempo: z.preprocess((v) => coerceNum(v) ?? 120, z.number()),
  summary: z.string().optional().default(""),
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
      }),
    )
    .optional(),
  blocks: z.array(BlockOut).min(1).max(8),
  snapshots: z
    .array(
      z.object({
        name: z.string(),
        color: z.string().optional().default("#c5c9c2"),
        enabledModelIds: z.array(z.string()).optional(),
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
  const result = PresetOut.safeParse(json);
  if (result.success) return result.data;
  throw new Error("Gemini sent a preset we couldn't read. Try that song again.");
}

export function toPreset(
  out: PresetOutT,
  meta: {
    source: Preset["source"];
    instrument: "guitar" | "bass";
    stompModel: "hx-stomp" | "hx-stomp-xl";
    song?: string;
    artist?: string;
  },
): Preset {
  const blocks: StompBlock[] = [];
  for (const b of out.blocks.slice(0, 8)) {
    const model = MODEL_MAP[b.modelId];
    if (!model) continue;
    if (!helixIdFor(model.id)) continue;
    const params: Record<string, number> = {};
    for (const p of model.params) {
      const v = b.params?.[p];
      params[p] = typeof v === "number" ? Math.max(0, Math.min(10, v)) : 5;
    }
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

  const snapshots = out.snapshots.slice(0, DEVICE_MAP[meta.stompModel].snapshots).map((s, i) => {
    const enabled = s.enabledModelIds?.length
      ? blocks.filter((b) => s.enabledModelIds!.includes(b.modelId)).map((b) => b.id)
      : blocks.filter((b) => b.enabled).map((b) => b.id);
    const paramOverrides: Record<string, Record<string, number>> = {};
    if (s.paramOverrides) {
      for (const [modelId, params] of Object.entries(s.paramOverrides)) {
        const block = blocks.find((b) => b.modelId === modelId);
        if (!block) continue;
        paramOverrides[block.id] = params;
      }
    }
    return {
      id: newId("snap"),
      name: s.name || `Snap ${i + 1}`,
      color: s.color || "#c5c9c2",
      enabledBlocks: enabled,
      notes: s.notes,
      paramOverrides: Object.keys(paramOverrides).length ? paramOverrides : undefined,
    };
  });

  const footswitches = out.footswitches
    .filter((f) => f.index >= 1 && f.index <= DEVICE_MAP[meta.stompModel].footswitches)
    .map((f) => {
      const target = f.targetModelId ? blocks.find((b) => b.modelId === f.targetModelId) : undefined;
      const snap = f.snapshotName
        ? snapshots.find((s) => s.name.toLowerCase() === f.snapshotName!.toLowerCase())
        : snapshots[f.index - 1];
      return {
        index: f.index,
        label: f.label.slice(0, 8).toUpperCase(),
        color: f.color || "#c5c9c2",
        action: f.action,
        targetBlockId: target?.id,
        snapshotId: f.action === "snapshot" ? snap?.id : undefined,
        notes: f.notes,
      };
    });

  return {
    id: newId("pst"),
    createdAt: Date.now(),
    source: meta.source,
    song: meta.song ?? out.song,
    artist: meta.artist ?? out.artist,
    instrument: meta.instrument,
    stompModel: meta.stompModel,
    name: out.name.slice(0, 18),
    tempo: Math.max(40, Math.min(240, Math.round(out.tempo || 120))),
    summary: out.summary,
    originalGear: out.originalGear,
    recommendedGear: out.recommendedGear ?? [],
    blocks,
    snapshots,
    footswitches,
    programming: out.programming,
    tips: out.tips,
  };
}

export function overlayUserGear(preset: Preset, gear: UserGear[]): Preset {
  if (!gear.length) return preset;
  const recs = [...preset.recommendedGear];
  const inst = gear.find((g) => g.kind === preset.instrument);
  if (inst && !recs.some((r) => r.item === inst.name)) {
    recs.unshift({
      item: inst.name,
      why: `Your ${inst.kind}${inst.notes ? ` — ${inst.notes}` : ""}. Use this for the part.`,
    });
  }
  const amp = gear.find((g) => g.kind === "amp");
  if (amp && !recs.some((r) => r.item === amp.name)) {
    recs.push({
      item: amp.name,
      why: "If you want a real power amp, 4-cable-method into this head and bypass the Stomp cab.",
    });
  }
  const pedal = gear.find((g) => g.kind === "pedal");
  if (pedal && !recs.some((r) => r.item === pedal.name)) {
    recs.push({
      item: pedal.name,
      why: "Park it in an FX Loop block if you prefer the real pedal over the HX model.",
    });
  }
  return { ...preset, recommendedGear: recs };
}

export function publicPreset(preset: Preset): Preset {
  return { ...preset, recommendedGear: [] };
}

export function jsonSchemaHint() {
  return `{
  "name": "preset name <=18 chars",
  "tempo": 120,
  "summary": "2-4 sentences: album/year, the real rig, and which HX stand-ins you used",
  "originalGear": [{"role":"Guitar|Bass|Amp|Pedal|Cab","name":"real gear","notes":"era / how it was used"}],
  "blocks": [{"modelId":"scream-808","enabled":true,"params":{"Drive":2.0,"Output":7.5,"Mic":0}}],
  "snapshots": [{"name":"Verse","color":"#7d9a6a","enabledModelIds":["scream-808"],"paramOverrides":{"brit-2204":{"Drive":4.2}},"notes":""}],
  "footswitches": [{"index":1,"label":"INTRO","color":"#c5c9c2","action":"snapshot","snapshotName":"Intro","notes":""}],
  "programming": ["step"],
  "tips": ["how to play it so it sounds like the record"]
}
Every params value MUST be a JSON number 0-10. Cab Mic is 0 (SM57) through 12 — never a mic name string.`;
}

const STAND_INS = `Common HX stand-ins when Helix has no exact model:
- BOSS DS-1 → stupor-od (SD-1, same family). Helix has no DS-1.
- EHX Small Clone → 70s-chorus (CE-1 family; depth up, rate moderate).
- Marshall Shredmaster → knuckle-dragon (high-gain pedal into a clean amp).
- Marshall Silver Jubilee 2555 → placater-dirty.
- Mesa Studio Preamp → cali-iv-rhythm-2.
- Fender Twin Reverb → us-deluxe-nrm (do NOT load a second amp — snapshot Drive down + hot-springs for the Twin intro).
- Korg SDD-3000 → vintage-digital.
- Binson Echorec → cosmos-echo.
- Roland RE-201 Space Echo → cosmos-echo.
- Maestro Echoplex EP-3 → transistor-tape.
- EHX Deluxe Memory Man → elephant-man.
- Mu-Tron III → mutant-filter.
- Dunlop Cry Baby → uk-wah-846.
- Ibanez TS-9 / TS808 as a tightener (Drive low, Level high) → scream-808.
- Fender spring tank → hot-springs.
Never invent modelIds. Prefer HX models over Legacy. Every block MUST have a factory HD2_* mapping — skip anything you cannot find in the catalog.`;

export function systemForDevice(stompModel: "hx-stomp" | "hx-stomp-xl", instrument: "guitar" | "bass") {
  const d = DEVICE_MAP[stompModel];
  return `You are a session guitar/bass tech who programs Line 6 HX Stomp presets that SOUND LIKE THE RECORD.
Return ONLY valid JSON matching the schema. No markdown, no commentary.

Device: ${d.name}. Max ${d.maxBlocks} blocks, ${d.footswitches} footswitches, ${d.snapshots} snapshots, ${d.looper} looper, 1 DSP chip.
Instrument: ${instrument}.

Accuracy rules — reconstruct the real recorded (or best-known live) rig, then map it:
- Name the album and year in summary. Prefer the studio tracking rig over a later tour unless asked for live.
- Primary sources, in order: Guitar Chalk song/amp-settings articles, producer/tech interviews (Butch Vig, Bob Rock, Alan Parsons, Phil Taylor), album credits, well-known rig rundowns. If sources conflict, pick the most-cited RECORD-era rig and say so in summary.
- Put REAL guitars, pedals, amps, cabs, mics in originalGear. Then map each piece to the closest catalog modelId.
- Every block must earn its place on that recording. Do not pad with unused gate, compressor, EQ, chorus, or hall reverb.
- Params are 0–10 floats. NEVER put a string in params (no "SM57", no "dotted 8th"). Cab Mic is the number 0 for SM57.
- When a setting is documented (TS Drive low / Level high, muff sustain up, dotted-8th delay, Twin spring, etc.), use it. Invent only what is undocumented, matching that player's known values.
- The preset must be playable on one DSP: skip Poly Pitch / Poly Wham / 12 String / Trinity Chorus unless the song needs them. NEVER load two amps — bypassed blocks still cost DSP. Snapshot Drive / Ch Vol instead.

${STAND_INS}

Signal order:
- Do NOT force Gate/Comp → Filter → Drive → Amp → Cab → Mod → Delay → Reverb.
- If the song has a documented order (delay before amp, fuzz after amp, wah last, etc.), use that order.
- If order is unknown, use common sense for that style (dirt into amp, time-based after, unless the artist is famous for pre-amp echo).
- Do NOT add a noise gate or compressor unless the part actually uses one (metal tightness, country squash, bass leveling). Many classic tones have neither.
- Amp and cab belong together as a pair when you are modeling a miked amp. Skip the cab for DI / FRFR / 4-cable-method / "amp as preamp into a real power amp" tones. Never split amp and cab to opposite ends of the chain.

Footswitches vs snapshots — map the SONG, not a generic chain:
- Break the track into real sections (intro / verse / pre-chorus / chorus / solo / breakdown).
- You MUST emit one snapshot per distinct section, up to the device max (${d.snapshots}). Names like Intro, Verse, Chorus, Solo.
- Snapshots must SOUND different: toggle the pedals that actually change (chorus, wah, muff, delay) AND put Drive / Ch Vol / Mix in paramOverrides. A chorus snapshot with the same blocks as the verse is wrong.
- If the record has a clean, chorused, or quiet intro (Smells Like Teen Spirit = Twin Reverb + Small Clone, no DS-1; Enter Sandman wah arpeggio), that is SNAPSHOT 1. Do not start the preset on the heavy chorus tone. Documented clean intros get their own snapshot.
- Footswitches 1..${Math.min(3, d.footswitches)} MUST be action "snapshot" recalling those sections in order. Do NOT put TAP or a lone bypass on FS1–FS3. TAP is the hardware TAP switch (index 8 on XL). Extra bypass stomps are only allowed on XL indexes 1–3 after the snapshot row.
- On HX Stomp, Snapshot mode is required so FS1–FS3 recall those snapshots.

programming is step-by-step on the unit, including snapshot parameter recall. tips are how to pick, volume-knob, and play so it sounds like the record — not generic advice.`;
}
