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
    return {
      id: newId("snap"),
      name: s.name || `Snap ${i + 1}`,
      color: s.color || "#c5c9c2",
      enabledBlocks: enabled,
      notes: s.notes,
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
  "summary": "2-4 sentences",
  "originalGear": [{"role":"Guitar|Bass|Amp|Pedal|Cab","name":"","notes":""}],
  "blocks": [{"modelId":"scream-808","enabled":true,"params":{"Drive":5.0}}],
  "snapshots": [{"name":"Verse","color":"#7d9a6a","enabledModelIds":["scream-808"],"notes":""}],
  "footswitches": [{"index":1,"label":"DRIVE","color":"#ff7a18","action":"bypass","targetModelId":"scream-808","notes":""}],
  "programming": ["step"],
  "tips": ["tip"]
}`;
}

export function systemForDevice(stompModel: "hx-stomp" | "hx-stomp-xl", instrument: "guitar" | "bass") {
  const d = DEVICE_MAP[stompModel];
  return `You are a session guitar/bass tech who programs Line 6 HX Stomp presets.
Return ONLY valid JSON matching the schema. No markdown, no commentary.

Device: ${d.name}. Max ${d.maxBlocks} blocks, ${d.footswitches} footswitches, ${d.snapshots} snapshots, ${d.looper} looper, 1 DSP chip.
Instrument: ${instrument}.
Rules:
- Use ONLY modelId values from the catalog (the id field, kebab-case). Never invent models.
- Prefer HX models over Legacy.
- Stay within ${d.maxBlocks} blocks. Amp and Cab are separate blocks. Poly Pitch / Poly Wham / 12 String / Trinity Chorus are expensive.
- Signal order: Gate/Comp → Filter/Wah → Drive → Amp → Cab/IR → Mod → Delay → Reverb. Delay before amp is allowed for Gilmour-style.
- Params are 0–10 floats.
- Footswitch indexes are 1..${d.footswitches}.
- Snapshots: ${d.snapshots}. Use them for verse/chorus/solo.
- originalGear is the REAL recorded/live rig.
- programming is step-by-step how to build it on the unit.
- Be historically accurate. If uncertain, say so in summary.`;
}
