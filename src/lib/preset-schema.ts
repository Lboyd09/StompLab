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
  return `{"name":"<=18 chars","tempo":120,"summary":"album/year, real rig, HX stand-ins. Distinctive parts named. <=240 chars","originalGear":[{"role":"Guitar|Amp|Pedal|Cab","name":"real gear","notes":""}],"blocks":[{"modelId":"deez-one-vintage","enabled":true,"params":{"Drive":5.2,"Treble":5.5,"Output":6.0,"Mic":0}}],"snapshots":[{"name":"Verse","color":"#7d9a6a","enabledModelIds":["deez-one-vintage"],"paramOverrides":{"cali-iv-rhythm-2":{"Drive":3.2}},"notes":""},{"name":"Solo","color":"#e24a3a","enabledModelIds":["deez-one-vintage","kinky-boost"],"paramOverrides":{"cali-iv-rhythm-2":{"Drive":5.5,"Ch Vol":7.2}},"notes":"lead — not the rhythm tone"}],"footswitches":[{"index":1,"label":"INTRO","color":"#c5c9c2","action":"snapshot","snapshotName":"Intro"},{"index":4,"label":"SOLO","color":"#e24a3a","action":"snapshot","snapshotName":"Solo"}],"programming":["step"],"tips":["how to play it like the record"]}
Params MUST be JSON numbers 0-10. Cab Mic is 0 (SM57) — never a string. If the song has a solo or signature trick, it MUST appear as its own snapshot.`;
}

const STAND_INS = `HX stand-ins (use these ids, never invent):
- BOSS DS-1 → deez-one-vintage (MIJ) or deez-one-mod (Keeley). NEVER stupor-od (that is the SD-1).
- BOSS SD-1 → stupor-od.
- Ibanez TS-9/TS808 tightener (Drive 1–2.5, Level 7–8) → scream-808.
- EHX Small Clone / BOSS CE-1 → 70s-chorus.
- ProCo RAT → vermin-dist. Klon → minotaur. Big Muff → bighorn-fuzz or triangle-fuzz.
- Marshall Shredmaster → kwb. Silver Jubilee 2555 → placater-dirty.
- Mesa Dual Rectifier → cali-rectifire. Mesa Mark / Studio Pre → cali-iv-rhythm-2.
- Fender Twin → us-deluxe-nrm (ONE amp only; intro Drive 1.5–2.5 + hot-springs).
- Marshall JCM-800 → brit-2203 or brit-2204. Plexi → brit-plexi-brt.
- Korg SDD-3000 → vintage-digital. Memory Man → elephant-man. Space Echo → cosmos-echo. Echorec → cosmos-echo. EP-3 → transistor-tape.
- Cry Baby → teardrop-310 or uk-wah-846. Mu-Tron III → mutant-filter. Whammy → pitch-wham.
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
      ? `Export is a .hlx for ${d.name} (device ${d.hlxDeviceId ?? "?"}). Only catalog modelId values. Do not invent models, dual-path splits, IRs, or features this unit does not have.`
      : `${d.name} cannot export a .hlx (POD Go uses .podgp). Still return a real HX chain they can copy by hand.`;
  const snapCount = d.snapshots;
  return `Session tech. Program a Line 6 ${d.name} preset that sounds like the RECORD. JSON only.
Max ${d.maxBlocks} blocks, ${snapCount} snapshots, ${d.footswitches} FS. Instrument: ${instrument}.
${exportRule}

Tone:
- Album + year in summary. Studio tracking rig first.
- originalGear = real guitars/pedals/amps/cabs (the actual products). Then map each to a catalog id.
- Every block must be on that recording. No spare gate/comp/chorus/hall.
- Params 0–10 numbers. Cab Mic = 0 (SM57). Never strings in params.
- GAIN: never dime Drive. Distortion pedals ~noon (4.5–6.5). TS tightener Drive 1–2.5 / Level 7–8. Amp Drive 1.5–3 clean intro, 3–5 crunch, 5–6.5 high-gain rhythm. Metal 5–7, not 10. If the record is mid-gain, stay mid-gain.
- ${ampRule}
- Skip Poly Pitch/Wham/12-string/Trinity Chorus unless the song needs them.
- ${play.prompt}

${STAND_INS}

Order: documented order if known (delay before amp, wah last, etc.). Else dirt → amp → cab → time. Amp+cab as a pair.

Arrangement (mandatory — this is how you miss a song):
- Name the recorded sections in snapshot order: Intro, Verse, Chorus, Solo, Bridge, Outro. Drop a name only if that section is not on the record.
- A guitar solo, lead break, or "wacky"/signature part (country-bend solo, tapping, talk box, harmonic, octave, reverse, volume swell, filter trick) MUST be its own snapshot. A solo is almost never the rhythm tone: boost on, delay/reverb Mix up, amp Drive or Ch Vol +1–2, maybe a different OD. Put those in paramOverrides AND toggle the extra block.
- Signature tricks get an enabled block that other snaps bypass — do not flatten the song into verse/chorus only.
- Snapshots MUST sound different. Documented clean intros (Teen Spirit Twin+Clone no DS-1; Sandman wah arpeggio) are SNAPSHOT 1.
- Use up to ${snapCount} snapshots. FS 1..${Math.min(snapCount, d.footswitches)} = action "snapshot" in section order. No TAP on FS1–3. MODE/TAP are hardware extras — do not spend numbered FS on them.

programming = unit steps. tips = pick/volume so it matches the record.`;
}
