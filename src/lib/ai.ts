import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { compactCatalogForPrompt, MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { Preset, StompBlock, UserGear } from "@/data/types";
import { newId } from "./preset-utils";

const GearSchema = z.object({
  id: z.string(),
  kind: z.enum(["guitar", "bass", "amp", "cab", "pedal", "pickup"]),
  name: z.string(),
  notes: z.string(),
});

const ResearchInput = z.object({
  song: z.string().min(1).max(120),
  artist: z.string().max(120).optional(),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: z.enum(["hx-stomp", "hx-stomp-xl"]),
  userGear: z.array(GearSchema).max(24),
});

const CreateInput = z.object({
  description: z.string().min(4).max(800),
  instrument: z.enum(["guitar", "bass"]),
  stompModel: z.enum(["hx-stomp", "hx-stomp-xl"]),
  userGear: z.array(GearSchema).max(24),
});

const EquivalentInput = z.object({
  query: z.string().min(2).max(120),
});

const BlockOut = z.object({
  modelId: z.string(),
  enabled: z.boolean().optional(),
  params: z.record(z.string(), z.number()).optional(),
});

const PresetOut = z.object({
  name: z.string(),
  tempo: z.number(),
  summary: z.string(),
  originalGear: z.array(
    z.object({ role: z.string(), name: z.string(), notes: z.string() }),
  ),
  recommendedGear: z.array(z.object({ item: z.string(), why: z.string() })),
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

type PresetOutT = z.infer<typeof PresetOut>;

async function chat(system: string, user: string, maxTokens = 2200): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("AI is not available in this environment");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`xAI API error ${res.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  return body.choices[0]?.message.content ?? "";
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("No JSON in model response");
  return JSON.parse(raw.slice(start, end + 1));
}

function gearPrompt(gear: UserGear[]): string {
  if (!gear.length) return "The player has not logged any personal gear.";
  return `The player owns:\n${gear.map((g) => `- ${g.kind}: ${g.name}${g.notes ? ` (${g.notes})` : ""}`).join("\n")}\nRecommend which of THESE to use, plus pickup/volume advice. If nothing fits, say so and suggest a generic substitute.`;
}

function systemForDevice(stompModel: "hx-stomp" | "hx-stomp-xl", instrument: "guitar" | "bass") {
  const d = DEVICE_MAP[stompModel];
  return `You are a session guitar/bass tech who programs Line 6 HX Stomp presets.
Return ONLY valid JSON matching the schema. No markdown, no commentary.

Device: ${d.name}. Max ${d.maxBlocks} blocks, ${d.footswitches} footswitches, ${d.snapshots} snapshots, ${d.looper} looper, 1 DSP chip.
Instrument: ${instrument}.
Rules:
- Use ONLY modelId values from the catalog (the id field, kebab-case). Never invent models.
- Prefer HX models over Legacy unless the user asks for a specific legacy unit.
- Stay within ${d.maxBlocks} blocks. Count Amp and Cab as separate blocks. Poly Pitch / Poly Wham / 12 String / Trinity Chorus / heavy verbs are expensive — if you use one, keep the rest light.
- Signal order is typical: Gate/Comp → Filter/Wah → Drive → Amp → Cab/IR → Mod → Delay → Reverb. Delay before amp is allowed for Gilmour-style.
- Params are 0–10 floats.
- Footswitch indexes are 1..${d.footswitches}. Always give a complete assignment plan.
- Snapshots: ${d.snapshots}. Use them for verse/chorus/solo, not just bypass.
- originalGear is the REAL recorded/live rig (amps, pedals, guitars) you researched.
- recommendedGear maps the player's own locker (if any) onto that song.
- programming is step-by-step how to build it on the unit (block order, snapshot recall, Command Center).
- Be historically accurate. If the song is well-known, name the actual pedals/amps. If uncertain, say so in summary — don't bluff a boutique pedal that wasn't there.`;
}

function toPreset(
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
    recommendedGear: out.recommendedGear,
    blocks,
    snapshots,
    footswitches,
    programming: out.programming,
    tips: out.tips,
  };
}

export const researchSong = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ResearchInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const catalog = compactCatalogForPrompt(data.instrument);
      const user = `Song: ${data.song}${data.artist ? ` by ${data.artist}` : ""}
${gearPrompt(data.userGear)}

Catalog (id | name | based on | dsp):
${catalog}

JSON schema:
{
  "name": "preset name <=18 chars",
  "tempo": 120,
  "summary": "2-4 sentences",
  "originalGear": [{"role":"Guitar|Bass|Amp|Pedal|Cab","name":"","notes":""}],
  "recommendedGear": [{"item":"","why":""}],
  "blocks": [{"modelId":"scream-808","enabled":true,"params":{"Drive":5.0}}],
  "snapshots": [{"name":"Verse","color":"#7d9a6a","enabledModelIds":["scream-808"],"notes":""}],
  "footswitches": [{"index":1,"label":"DRIVE","color":"#ff7a18","action":"bypass","targetModelId":"scream-808","notes":""}],
  "programming": ["step"],
  "tips": ["tip"]
}`;
      const text = await chat(
        systemForDevice(data.stompModel, data.instrument),
        user,
      );
      const parsed = PresetOut.parse(extractJson(text));
      const preset = toPreset(parsed, {
        source: "song",
        instrument: data.instrument,
        stompModel: data.stompModel,
        song: data.song,
        artist: data.artist,
      });
      return { ok: true as const, preset };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Research failed";
      return { ok: false as const, error: message };
    }
  });

export const createSound = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const catalog = compactCatalogForPrompt(data.instrument);
      const user = `Describe and build this sound on the ${DEVICE_MAP[data.stompModel].name}:
${data.description}

${gearPrompt(data.userGear)}

Catalog (id | name | based on | dsp):
${catalog}

Return the same JSON schema as a song preset. originalGear should list the real-world pedals/amps this patch is emulating. name the preset after the sound.`;
      const text = await chat(
        systemForDevice(data.stompModel, data.instrument),
        user,
      );
      const parsed = PresetOut.parse(extractJson(text));
      const preset = toPreset(parsed, {
        source: "custom",
        instrument: data.instrument,
        stompModel: data.stompModel,
      });
      return { ok: true as const, preset };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not build that sound";
      return { ok: false as const, error: message };
    }
  });

export const explainEquivalent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EquivalentInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const catalog = compactCatalogForPrompt();
      const text = await chat(
        `You map real guitar/bass pedals and amps to Line 6 HX models.
Return ONLY JSON: {"query":"","matches":[{"modelId":"","closeness":"exact|close|similar","how":"1-3 sentences on how to set it","basedOn":""}]}
Use only catalog modelId values. 1-4 matches, best first. If nothing is close, still pick the nearest and say so in how.`,
        `Find HX equivalents for: ${data.query}\n\nCatalog:\n${catalog}`,
        900,
      );
      const json = extractJson(text) as {
        matches?: { modelId: string; closeness: string; how: string }[];
      };
      const matches = (json.matches ?? [])
        .filter((m) => MODEL_MAP[m.modelId])
        .slice(0, 4)
        .map((m) => ({
          modelId: m.modelId,
          closeness: m.closeness,
          how: m.how,
          model: MODEL_MAP[m.modelId],
        }));
      return { ok: true as const, matches };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lookup failed";
      return { ok: false as const, error: message };
    }
  });
