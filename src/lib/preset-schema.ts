import { z } from "zod";
import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import { helixIdFor } from "@/data/helix-ids";
import { PLAYBACK_MAP } from "@/data/playback";
import type { PlaybackTarget, Preset, StompBlock, StompModelId, UserGear } from "@/data/types";
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
  for (const b of out.blocks.slice(0, device.maxBlocks)) {
    const model = MODEL_MAP[b.modelId];
    if (!model) continue;
    if (!helixIdFor(model.id)) continue;
    if (skipAmpCab && AMP_CAB.has(model.category)) continue;
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

  const snapshots = out.snapshots.slice(0, device.snapshots).map((s, i) => {
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
    .filter((f) => f.index >= 1 && f.index <= device.footswitches)
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

  const fingerprint = (out.fingerprint ?? "").trim();
  const summary = fingerprint && !out.summary.toLowerCase().includes(fingerprint.slice(0, 28).toLowerCase())
    ? `${fingerprint} ${out.summary}`.trim()
    : out.summary;

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
    summary,
    originalGear: out.originalGear,
    recommendedGear: out.recommendedGear ?? [],
    blocks,
    snapshots,
    footswitches,
    programming: out.programming,
    tips: out.tips,
    playbackTarget: meta.playbackTarget,
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
  return `{"name":"<=18 chars","tempo":120,"fingerprint":"one sentence: brightness, dirt, mids, pick attack, room","summary":"album/year/studio/producer, real rig, HX stand-ins. Only distinctive TONE changes named. <=240 chars","originalGear":[{"role":"Guitar|Amp|Pedal|Cab","name":"real product (not 'tube amp')","notes":"how it was used on the record"}],"blocks":[{"modelId":"catalog-id","enabled":true,"params":{"Drive":4.5,"Bass":5.0,"Mid":6.0,"Treble":5.5,"Output":6.0,"Mic":0}}],"snapshots":[{"name":"ToneA","color":"#7d9a6a","enabledModelIds":["id-on"],"paramOverrides":{"amp-id":{"Drive":3.0}},"notes":"why this tone is different"},{"name":"ToneB","color":"#e24a3a","enabledModelIds":["id-on"],"paramOverrides":{"amp-id":{"Drive":4.2,"Ch Vol":6.2}},"notes":"loud section — not a copy of ToneA"}],"footswitches":[{"index":1,"label":"TONEA","color":"#7d9a6a","action":"snapshot","snapshotName":"ToneA"},{"index":2,"label":"TONEB","color":"#e24a3a","action":"snapshot","snapshotName":"ToneB"},{"index":4,"label":"GATE","color":"#f5d000","action":"bypass","targetModelId":"hard-gate"},{"index":5,"label":"EQ","color":"#c6e800","action":"bypass","targetModelId":"cali-q-graphic"}],"programming":["step"],"tips":["how to play it like the record"]}
Params MUST be JSON numbers 0-10. Set EVERY factory knob. Cab Mic is 0 (SM57). Only snapshots that change the tone. If the record used a gate or dedicated EQ, include those blocks and spare FS bypass. Do not copy the example modelIds — pick from the catalog for THIS song.`;
}

export function jsonSchemaHintCustom() {
  return `{"name":"<=18 chars","tempo":120,"summary":"what you built and why — not a song title. <=240 chars","originalGear":[{"role":"Guitar|Amp|Pedal|Cab","name":"gear this description implies","notes":"how it is used in THIS custom rig"}],"blocks":[{"modelId":"minotaur","enabled":true,"params":{"Drive":4.8,"Treble":5.2,"Output":6.0}}],"snapshots":[{"name":"Rhythm","color":"#c5c9c2","enabledModelIds":["minotaur"],"paramOverrides":{},"notes":""},{"name":"Lead","color":"#e24a3a","enabledModelIds":["minotaur","kinky-boost"],"paramOverrides":{"minotaur":{"Drive":5.6}},"notes":"lift, not a copied solo from a record"}],"footswitches":[{"index":1,"label":"RHYTHM","color":"#c5c9c2","action":"snapshot","snapshotName":"Rhythm"},{"index":4,"label":"GATE","color":"#f5d000","action":"bypass","targetModelId":"hard-gate"}],"programming":["step"],"tips":["how to play THIS sound"]}
Params MUST be JSON numbers 0-10. Set EVERY factory knob. This is a CUSTOM sound — do not name a real song in summary. Do not copy a featured demo chain.`;
}

const STAND_INS = `HX stand-ins (use these ids, never invent):
- BOSS DS-1 → deez-one-vintage (MIJ) or deez-one-mod (Keeley). NEVER stupor-od (that is the SD-1).
- BOSS SD-1 → stupor-od.
- Ibanez TS-9/TS808 tightener (Drive 1–2.5, Level 7–8) → scream-808.
- EHX Small Clone / BOSS CE-1 → 70s-chorus.
- ProCo RAT → vermin-dist. Klon → minotaur. Big Muff → bighorn-fuzz or triangle-fuzz.
- Marshall Shredmaster → kwb. Silver Jubilee 2555 → placater-dirty.
- Mesa Dual Rectifier → cali-rectifire. Mesa Studio Pre / Mark clean rhythm used as a pedal platform → cali-iv-rhythm-1. Mark IV crunch → cali-iv-rhythm-2. Mark IV lead → cali-iv-lead.
- Fender Twin Reverb → us-double-nrm (NOT us-deluxe-nrm — Deluxe is a different amp).
- Fender Deluxe Reverb → us-deluxe-nrm.
- Marshall JCM-800 → brit-2203 or brit-2204. Plexi → brit-plexi-brt. Hiwatt DR-103 → whowatt-100.
- Korg SDD-3000 → vintage-digital. Memory Man → elephant-man. Space Echo / Echorec → cosmos-echo. EP-3 → transistor-tape.
- Cry Baby → teardrop-310. Vox V846 → uk-wah-846. Mu-Tron III → mutant-filter. Whammy → pitch-wham.
- Mesa 5-band graphic → cali-q-graphic. Marshall 1960 G12T-75 → 4x12-1960-t75. Mesa V30 4x12 → 4x12-cali-v30.
- Diezel VH4 → das-benzin-lead (lead) or das-benzin-mega (tight rhythm). SansAmp bass → zeroamp-bass-di.
- Fender Eighty-Five / other solid-state clean platforms → us-deluxe-nrm (NOT jazz-rivet — that choruses the whole patch).
Only catalog modelId values. Prefer HX over Legacy.`;

export function systemForDevice(
  stompModel: StompModelId,
  instrument: "guitar" | "bass",
  playbackTarget: PlaybackTarget = "frfr",
) {
  const d = DEVICE_MAP[stompModel] ?? DEVICE_MAP["hx-stomp"];
  const play = PLAYBACK_MAP[playbackTarget];
  const ampRule = d.hasAmpCab
    ? "One amp. Bypassed amps still cost DSP. Snapshot Drive/Ch Vol instead of a second amp."
    : "HX Effects has NO amp, cab, preamp, or IR. Pedals only. If they need a real amp, say so in tips and use send-return. Never emit amp-guitar, amp-bass, preamp, cab, mic, or ir blocks.";
  const exportRule =
    d.exportFormat === "hlx"
      ? `Export is a .hlx for ${d.name} (device ${d.hlxDeviceId ?? "?"}). Only catalog modelId values that exist in the catalog list. Do not invent models, dual-path splits, IRs, or features this unit does not have.`
      : d.exportFormat === "pgp"
        ? `Export is a .pgp for POD Go Edit (device ${d.hlxDeviceId ?? "2162695"}). Same HX model ids as Helix. Do not invent models. Skip poly pitch/whammy.`
        : `${d.name} cannot export a file. Still return a real HX chain they can copy by hand.`;
  const snapCount = d.snapshots;
  return `Session tech. Program a Line 6 ${d.name} preset that A/Bs against the RECORD — not a genre template, not a YouTube cover. JSON only.
Max ${d.maxBlocks} blocks, ${snapCount} snapshots, ${d.footswitches} FS. Instrument: ${instrument}.
${exportRule}

This unit:
- Work like a session tech: guitar/pickups, amp + channel, pedal order, cab + mic, then playing technique. Map each real piece to a catalog id only after originalGear is filled.
- Every block must be on that recording. No spare chorus/hall/comp.
- GATE: include noise-gate or hard-gate ONLY if the record is tight high-gain / palm-muted / documented as gated. Snapshots turn it ON for tight rhythm and OFF for clean intro / ambient parts. Spare FS (4+) = action "bypass" labeled GATE. Do not invent a gate on a clean, indie, or vintage record.
- EQ: include simple-eq, parametric, or cali-q-graphic ONLY if the session used a dedicated EQ (Mesa graphic, rack EQ, documented scoop/boost beyond amp knobs). Snapshots toggle it. Spare FS = action "bypass" labeled EQ. Do not add a spare EQ "just in case."
- Set EVERY factory knob on every block to a 0–10 number. Omitting a param stores 5 and the preset sounds generic. Cab Mic = 0 (SM57) unless the session used something else — still a number, never a string.
- EQ follows the record. Mid-forward (grunge, classic rock) stays mid-forward. Scooped modern stays scooped. Dark Plexi stays dark. Do not "fix" or hype it.
- GAIN: never dime Drive unless the session documented it. Distortion pedals ~noon (4.5–6.5) unless a published number exists (use that). TS tightener Drive 1–2.5 / Level 7–8. Amp Drive 1.5–3 clean intro, 3–5 crunch, 5–6.5 high-gain rhythm. Metal 5–7, not 10. If the record is mid-gain, stay mid-gain. Guitar volume is a gain stage — verses often roll the guitar down instead of a second amp.
- Unknown rock song ≠ Dual Rectifier. Unknown Fender song ≠ Deluxe. Pick the closest documented amp from that album/era.
- ${ampRule}
- Skip Poly Pitch/Wham/12-string/Trinity Chorus unless the song needs them.
- ${play.prompt}

${STAND_INS}

Order: documented order if known (delay before amp, wah last, etc.). Else dirt → amp → cab → time. Amp+cab as a pair.

Arrangement (mandatory — this is how you miss a song):
- Only snapshots that change the TONE. If intro and verse share the same chain and knobs, they are ONE snapshot. Do not invent a snapshot for a lyric section that sounds the same.
- Name the recorded tone changes in order (Clean, Chorus, Solo). Drop a name when that section is not a different sound.
- A guitar solo, lead break, or signature trick MUST be its own snapshot when the tone actually changes (boost on, delay Mix up, amp Drive or Ch Vol +1–2). A solo is almost never the rhythm tone. Put those in paramOverrides AND toggle the extra block.
- Use up to ${snapCount} snapshots. FS 1..${Math.min(snapCount, d.footswitches)} = action "snapshot" in that order. No TAP on FS1–3.

programming = unit steps. tips = pick, pickup, and guitar volume so the player can match the record.`;
}

/** Song-specific research brief. Catalog + schema are appended by the caller. */
export function songResearchInstructions(
  song: string,
  artist: string | undefined,
  instrument: "guitar" | "bass",
  wahLine?: string,
) {
  const title = song.trim();
  const billed = (artist ?? "").trim();
  const who = billed ? `${title} by ${billed}` : title;
  return `Song: ${who}
Instrument: ${instrument} as it was TRACKED on the record (not a cover, not a live-only tour).

Fill originalGear with REAL products BEFORE any modelId — name the product (Fender Twin Reverb, BOSS DS-1), never a category ('tube amp'). Summary starts with the tone fingerprint, then album title, year, studio, producer, and which player.
If sources disagree: session credits / Guitar World "original gear" beat a simplified method (e.g. Twin Reverb vs the Mesa Studio Pre that was actually tracked). Prefer the tracking/studio rig over a later live rig.
Listener test: if you A/B the album against this preset, brightness, dirt amount, midrange, and room must match.
Map the arrangement by TONE, not by lyric section: intro and verse that share a chain are one snapshot. A solo is almost never the rhythm tone — its own snapshot, paramOverrides for Drive / Ch Vol / Mix so they actually export.
If that session used a noise gate or a dedicated EQ, those blocks go in the chain with on/off via snapshots and spare FS. If it did not, leave them out.
${wahLine ? `\n${wahLine}` : ""}`;
}

export function systemForCustomSound(
  stompModel: StompModelId,
  instrument: "guitar" | "bass",
  playbackTarget: PlaybackTarget = "frfr",
) {
  const d = DEVICE_MAP[stompModel] ?? DEVICE_MAP["hx-stomp"];
  const play = PLAYBACK_MAP[playbackTarget];
  const ampRule = d.hasAmpCab
    ? "One amp. Bypassed amps still cost DSP. Snapshot Drive/Ch Vol instead of a second amp."
    : "HX Effects has NO amp, cab, preamp, or IR. Pedals only. If they need a real amp, say so in tips and use send-return. Never emit amp-guitar, amp-bass, preamp, cab, mic, or ir blocks.";
  const exportRule =
    d.exportFormat === "hlx"
      ? `Export is a .hlx for ${d.name} (device ${d.hlxDeviceId ?? "?"}). Only catalog modelId values that exist in the catalog list. Do not invent models, dual-path splits, IRs, or features this unit does not have.`
      : d.exportFormat === "pgp"
        ? `Export is a .pgp for POD Go Edit (device ${d.hlxDeviceId ?? "2162695"}). Same HX model ids as Helix. Do not invent models. Skip poly pitch/whammy.`
        : `${d.name} cannot export a file. Still return a real HX chain they can copy by hand.`;
  const snapCount = d.snapshots;
  return `Session tech. Invent a NEW Line 6 ${d.name} preset from the player's description. This is a custom rig — not a song replica, not a famous player's documented patch, not a close copy of Teen Spirit / Sandman / Numb or any other record. JSON only.
Max ${d.maxBlocks} blocks, ${snapCount} snapshots, ${d.footswitches} FS. Instrument: ${instrument}.
${exportRule}

Custom-sound rules:
- Build only what they asked for. If they said "Klon into a Deluxe with slapback", that is the chain. Do not add a DS-1, Rectifier, wah intro, Small Clone, or any other famous-song leftover.
- Do not research a similar song and copy it. Do not name a real song in summary unless they named one.
- originalGear = the products implied by THIS description, not an album credit list.
- Set EVERY factory knob on every block to a 0–10 number. Omitting a param stores 5.
- ${ampRule}
- GAIN: never dime Drive. Pedals ~noon (4.5–6.5). Amp Drive 1.5–3 clean, 3–5 crunch, 5–6.5 high-gain, metal 5–7.
- GATE: include a gate only if they asked for tightness / metal chug / a gate. Spare FS = bypass GATE.
- EQ: include simple-eq / parametric / cali-q-graphic only if they asked for a scoop, mid boost, or a graphic. Spare FS = bypass EQ. Do not add a spare EQ "just in case."
- WAH: follow the wah instruction. Do not copy a famous wah intro.
- Skip Poly Pitch/Wham/12-string/Trinity Chorus unless they asked.
- ${play.prompt}

${STAND_INS}

Order: dirt → amp → cab → time unless they specified otherwise. Amp+cab as a pair.

Snapshots: if they described scenes (clean / crunch / lead), those are the snapshots and they MUST sound different. Otherwise three useful scenes: Rhythm, Lift, Lead. FS 1..${Math.min(snapCount, d.footswitches)} = snapshot in that order. Spare FS after that: GATE then EQ bypass if those blocks exist. No TAP on FS1–3.

programming = unit steps. tips = how to play this custom sound.`;
}

/** Custom-sound brief. Catalog + schema are appended by the caller. */
export function customSoundInstructions(description: string, instrument: "guitar" | "bass", wahLine?: string) {
  return `CUSTOM SOUND (not a song). Instrument: ${instrument}.
Player description:
${description.trim()}

Invent a unique HX chain that delivers THAT description. Do not substitute a similar famous record. Do not copy a player rig from memory (Cobain, Hetfield, Gilmour, Frusciante, Morello, Edge, etc.) unless the player named them.
If the description is a feeling ("warm broken-up American clean") pick the closest catalog amp and set knobs — still original, not a named-song patch.
Listener test: would a player who typed that sentence recognize this preset as what they asked for, not as a cover of a hit?
${wahLine ? `\n${wahLine}` : ""}`;
}
