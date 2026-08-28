import { z } from "zod";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { Preset, StompBlock, UserGear } from "@/data/types";
import { newId } from "./preset-utils";

export const GearSchema = z.object({
  id: z.string(),
  kind: z.enum(["guitar", "bass", "amp", "cab", "pedal", "pickup"]),
  name: z.string(),
  notes: z.string(),
});

export const BlockOut = z.object({
  modelId: z.string(),
  enabled: z.boolean().optional(),
  params: z.record(z.string(), z.number()).optional(),
});

export const PresetOut = z.object({
  name: z.string(),
  tempo: z.number(),
  summary: z.string(),
  originalGear: z.array(
    z.object({ role: z.string(), name: z.string(), notes: z.string() }),
  ),
  recommendedGear: z.array(z.object({ item: z.string(), why: z.string() })).optional(),
  blocks: z.array(BlockOut).min(1).max(8),
  snapshots: z.array(
    z.object({
      name: z.string(),
      color: z.string(),
      enabledModelIds: z.array(z.string()).optional(),
      notes: z.string(),
      paramOverrides: z.record(z.string(), z.record(z.string(), z.number())).optional(),
    }),
  ),
  footswitches: z.array(
    z.object({
      index: z.number(),
      label: z.string(),
      color: z.string(),
      action: z.enum([
        "bypass",
        "snapshot",
        "tap",
        "tuner",
        "looper",
        "preset-up",
        "preset-down",
        "mode",
      ]),
      targetModelId: z.string().optional(),
      snapshotName: z.string().optional(),
      notes: z.string(),
    }),
  ),
  programming: z.array(z.string()),
  tips: z.array(z.string()),
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
  "blocks": [{"modelId":"scream-808","enabled":true,"params":{"Drive":2.0,"Output":7.5}}],
  "snapshots": [{"name":"Verse","color":"#7d9a6a","enabledModelIds":["scream-808"],"paramOverrides":{"brit-2204":{"Drive":4.2}},"notes":""}],
  "footswitches": [{"index":1,"label":"DRIVE","color":"#ff7a18","action":"bypass","targetModelId":"scream-808","notes":""}],
  "programming": ["step"],
  "tips": ["how to play it so it sounds like the record"]
}`;
}

const STAND_INS = `Common HX stand-ins when Helix has no exact model:
- BOSS DS-1 → stupor-od (SD-1, same family). Helix has no DS-1.
- EHX Small Clone → 70s-chorus (CE-1 family; depth up, rate moderate).
- Marshall Shredmaster → knuckle-dragon (high-gain pedal into a clean amp).
- Marshall Silver Jubilee 2555 → placater-dirty.
- Mesa Studio Preamp → cali-iv-rhythm-2.
- Korg SDD-3000 → vintage-digital.
- Binson Echorec → cosmos-echo.
- Roland RE-201 Space Echo → cosmos-echo.
- Maestro Echoplex EP-3 → transistor-tape.
- EHX Deluxe Memory Man → elephant-man.
- Mu-Tron III → mutant-filter.
- Dunlop Cry Baby → uk-wah-846.
- Ibanez TS-9 / TS808 as a tightener (Drive low, Level high) → scream-808.
Never invent modelIds. Prefer HX models over Legacy.`;

export function systemForDevice(stompModel: "hx-stomp" | "hx-stomp-xl", instrument: "guitar" | "bass") {
  const d = DEVICE_MAP[stompModel];
  return `You are a session guitar/bass tech who programs Line 6 HX Stomp presets that SOUND LIKE THE RECORD.
Return ONLY valid JSON matching the schema. No markdown, no commentary.

Device: ${d.name}. Max ${d.maxBlocks} blocks, ${d.footswitches} footswitches, ${d.snapshots} snapshots, ${d.looper} looper, 1 DSP chip.
Instrument: ${instrument}.

Accuracy rules — reconstruct the real recorded (or best-known live) rig, then map it:
- Name the album and year in summary. Prefer the studio tracking rig over a later tour unless asked for live.
- Use primary sources: album credits, producer/tech interviews, well-known rig rundowns. If sources conflict, pick the most-cited record-era rig and say so.
- Put REAL guitars, pedals, amps, cabs, mics in originalGear. Then map each piece to the closest catalog modelId.
- Every block must earn its place on that recording. Do not pad with unused gate, compressor, EQ, chorus, or hall reverb.
- Params are 0–10 floats. When a setting is documented (TS Drive low / Level high, muff sustain up, dotted-8th delay, etc.), use it. Invent only what is undocumented, matching that player's known values.
- The preset must be playable on one DSP: skip Poly Pitch / Poly Wham / 12 String / Trinity Chorus unless the song needs them.

${STAND_INS}

Signal order:
- Do NOT force Gate/Comp → Filter → Drive → Amp → Cab → Mod → Delay → Reverb.
- If the song has a documented order (delay before amp, fuzz after amp, wah last, etc.), use that order.
- If order is unknown, use common sense for that style (dirt into amp, time-based after, unless the artist is famous for pre-amp echo).
- Do NOT add a noise gate or compressor unless the part actually uses one (metal tightness, country squash, bass leveling). Many classic tones have neither.
- Amp and cab belong together as a pair when you are modeling a miked amp. Skip the cab for DI / FRFR / 4-cable-method / "amp as preamp into a real power amp" tones. Never split amp and cab to opposite ends of the chain.

Footswitches vs snapshots — map the SONG, not a generic chain:
- Break the track into real sections (intro / verse / pre-chorus / chorus / solo / breakdown).
- You MUST emit one snapshot per distinct section, up to the device max (${d.snapshots}). Names like INTRO, VERSE, CHORUS, SOLO.
- Snapshots must SOUND different: toggle the pedals that actually change (chorus, wah, muff, delay) AND put Drive / Ch Vol / Mix in paramOverrides. A chorus snapshot with the same blocks as the verse is wrong.
- If the record has a clean or quiet intro (Enter Sandman arpeggio, verse-quiet Nirvana), that is its own snapshot — do not leave the heavy rhythm on by default.
- Footswitch bypass when the player stomps one or two pedals. Indexes 1..${d.footswitches}.
- On HX Stomp, prefer Snapshot mode for songs with 2–3 sections so FS1–FS3 recall those snapshots.

programming is step-by-step on the unit, including snapshot parameter recall. tips are how to pick, volume-knob, and play so it sounds like the record — not generic advice.`;
}
