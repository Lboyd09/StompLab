import { DEVICE_MAP } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import type { CategoryId, Preset, Snapshot, StompBlock } from "@/data/types";
import { newId } from "./preset-utils";
import { fitSnapshotName } from "./snapshot-sanitize";

const BOOSTS = new Set(["kinky-boost", "deranged-master"]);
const HIGH_GAIN_AMP = /rect|uber|soldano|diezel|engl|revv|badonk|archetype|panama|vitriol|placater|german-x|citrus-rv|anglo-heavy|pv-/;
/** Clean channels of high-gain amp families (Archetype Clean, PV Vitriol Clean, Placater Clean). */
const CLEAN_CHANNEL = /clean/;
/** Bass DI / amp-in-a-box pedals are the bass tone, not a drive that needs a gate. */
const BASS_DI = /bass-di|sansamp|zeroamp|obsidian|ampeg-scrambler/;

function categoryOf(modelId: string): CategoryId | undefined {
  return MODEL_MAP[modelId]?.category;
}

function isAmp(modelId: string): boolean {
  const cat = categoryOf(modelId);
  return cat === "amp-guitar" || cat === "amp-bass" || cat === "preamp";
}

function isDrive(modelId: string): boolean {
  return categoryOf(modelId) === "distortion" && !BOOSTS.has(modelId);
}

function isDelay(modelId: string): boolean {
  return categoryOf(modelId) === "delay";
}

function isLeadName(name: string): boolean {
  return /\b(lead|solo|lick)\b/i.test(name);
}

/**
 * Only a snapshot the model called clean is cleaned up. "Intro" alone is not
 * clean: plenty of records open on the riff.
 */
function isCleanName(name: string): boolean {
  return /\bclean\b/i.test(name) && !/\b(lead|solo|crunch|crnch|dist|dirty|heavy)\b/i.test(name);
}

/** Highest amp Drive that still counts as a clean sound (reference: clean 0.6–1.8). */
const CLEAN_DRIVE = 2.4;

/**
 * Clean by name, or clean by gain staging: no drive pedal on and the amp's
 * Drive for this snapshot at or under 2.4. A dirty intro (pedal on, or a
 * riff on the amp) stays dirty whatever it is called.
 */
function isCleanSnapshot(snap: Snapshot, blocks: StompBlock[]): boolean {
  if (isCleanName(snap.name)) return true;
  if (isLeadName(snap.name)) return false;
  const amp = blocks.find((b) => isAmp(b.modelId));
  if (!amp) return false;
  const on = new Set(snap.enabledBlocks);
  if (blocks.some((b) => isDrive(b.modelId) && on.has(b.id))) return false;
  const drive = snap.paramOverrides?.[amp.id]?.Drive ?? amp.params.Drive;
  return typeof drive === "number" && drive <= CLEAN_DRIVE;
}

const TIME_SIDE = new Set<CategoryId>(["modulation", "delay", "reverb"]);

/**
 * Where a gate or boost goes: in front of the amp. With no amp (a pedals-only rig into a real
 * amp), in front of the FX loop or the first modulation / delay / reverb — never after the tails.
 */
function frontOfAmp(blocks: StompBlock[]): number {
  const amp = blocks.findIndex((b) => isAmp(b.modelId));
  if (amp >= 0) return amp;
  const loop = blocks.findIndex((b) => b.modelId === "fx-loop" || TIME_SIDE.has(categoryOf(b.modelId) as CategoryId));
  return loop >= 0 ? loop : blocks.length;
}

function needsGate(blocks: StompBlock[], bass: boolean): boolean {
  if (blocks.some((b) => b.modelId === "noise-gate" || b.modelId === "hard-gate" || b.modelId === "horizon-gate")) {
    return false;
  }
  const amp = blocks.find((b) => isAmp(b.modelId));
  const highGainAmp = amp && !CLEAN_CHANNEL.test(amp.modelId) && HIGH_GAIN_AMP.test(amp.modelId);
  if (amp && ((amp.params.Drive ?? 0) >= 4.5 || highGainAmp)) return true;
  if (bass) return false;
  return blocks.some((b) => isDrive(b.modelId) && !BASS_DI.test(b.modelId));
}

/** Block slots the unit spends: an amp and the cab after it are one block on HX. */
function slotsUsed(blocks: StompBlock[]): number {
  let n = 0;
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    if (categoryOf(b.modelId) === "cab" && prev && isAmp(prev.modelId)) return;
    n += 1;
  });
  return n;
}

function hasRoom(preset: Preset, blocks: StompBlock[]): boolean {
  if (preset.stompModel === "pod-go") {
    // POD Go: four free effect blocks beside its built-in wah, volume, amp, cab and EQ.
    const free = blocks.filter((b) => {
      const c = categoryOf(b.modelId);
      return c && !["amp-guitar", "amp-bass", "preamp", "cab", "mic", "wah"].includes(c) && b.modelId !== "volume-pedal";
    });
    return free.length < 4;
  }
  const max = DEVICE_MAP[preset.stompModel]?.maxBlocks ?? 8;
  return slotsUsed(blocks) < max;
}

const GEAR_SWAP: { gear: RegExp; from: string; to: string }[] = [
  { gear: /\bce-?2w?\b/i, from: "70s-chorus", to: "chorus" },
  { gear: /\bce-?1\b|small clone/i, from: "chorus", to: "70s-chorus" },
  { gear: /\bds-?1\b/i, from: "stupor-od", to: "deez-one-vintage" },
  { gear: /\bsd-?1\b|super overdrive/i, from: "deez-one-vintage", to: "stupor-od" },
  { gear: /\bechorec|\bbinson\b/i, from: "cosmos-echo", to: "echo-platter-legacy" },
  { gear: /\bspace echo|\bre-?201\b/i, from: "echo-platter-legacy", to: "cosmos-echo" },
];

const SOURCED = /session|interview|guitar world|rig rundown|confirmed|credit|documented|premier guitar|tape op|sound on sound|likely/i;

function markLikely(preset: Preset): Preset {
  return {
    ...preset,
    originalGear: preset.originalGear.map((g) => {
      if (SOURCED.test(`${g.notes} ${g.name}`)) return g;
      return { ...g, notes: g.notes ? `Likely — ${g.notes}` : "Likely — not from a session credit." };
    }),
  };
}

function swapModelId(preset: Preset, from: string, to: string): Preset {
  if (!MODEL_MAP[to]) return preset;
  const blocks = preset.blocks.map((b) => (b.modelId === from ? { ...b, modelId: to } : b));
  const snapshots = preset.snapshots.map((s) => ({
    ...s,
    paramOverrides: s.paramOverrides
      ? Object.fromEntries(Object.entries(s.paramOverrides).map(([id, params]) => [id, params]))
      : s.paramOverrides,
  }));
  const footswitches = preset.footswitches.map((f) =>
    f.targetBlockId && blocks.find((b) => b.id === f.targetBlockId)?.modelId === to ? f : f,
  );
  return { ...preset, blocks, snapshots, footswitches };
}

function alignGear(preset: Preset): Preset {
  let next = preset;
  const gearText = preset.originalGear.map((g) => `${g.name} ${g.notes}`).join(" \n ");
  for (const rule of GEAR_SWAP) {
    if (!rule.gear.test(gearText)) continue;
    if (!next.blocks.some((b) => b.modelId === rule.from)) continue;
    next = swapModelId(next, rule.from, rule.to);
  }
  return next;
}

function withOverrides(snap: Snapshot, blockId: string, patch: Record<string, number>): Snapshot {
  return {
    ...snap,
    paramOverrides: {
      ...snap.paramOverrides,
      [blockId]: { ...snap.paramOverrides?.[blockId], ...patch },
    },
  };
}

function shapeGenerated(preset: Preset): Preset {
  const next = alignGear(markLikely(preset));
  let blocks = next.blocks.map((b) => ({ ...b, params: { ...b.params } }));

  const bass = next.instrument === "bass";
  for (const block of blocks) {
    if (!isDelay(block.modelId)) continue;
    if ((block.params.Time ?? 0) >= 9) block.params.Time = 4.2;
    // No time and no note: follow the song tempo on the dotted eighth. A Time the model chose stays free-running.
    if (block.params.Note === undefined && block.params.Time === undefined && (block.params.Scale ?? 0) <= 0) block.params.Note = 8;
  }

  if (needsGate(blocks, bass) && hasRoom(next, blocks) && MODEL_MAP["noise-gate"]) {
    const gate: StompBlock = {
      id: newId("blk"),
      modelId: "noise-gate",
      enabled: true,
      path: "main",
      position: frontOfAmp(blocks),
      params: { Threshold: 1.8, Decay: 2.4, Level: 5 },
    };
    blocks = [...blocks.slice(0, gate.position), gate, ...blocks.slice(gate.position)].map((b, i) => ({
      ...b,
      position: i,
    }));
  }

  // A solo is a lift over the rest of the song. If every snapshot is named
  // like a lead ("Lead Verse", "Lead Chorus"), there is nothing to lift over.
  const leadSnaps = next.snapshots.filter((s) => isLeadName(s.name));
  const liftLeads = leadSnaps.length > 0 && leadSnaps.length < next.snapshots.length;
  let boost = blocks.find((b) => b.modelId === "kinky-boost");
  if (liftLeads && !boost && !bass && hasRoom(next, blocks) && MODEL_MAP["kinky-boost"]) {
    const at = frontOfAmp(blocks);
    boost = {
      id: newId("blk"),
      modelId: "kinky-boost",
      enabled: false,
      path: "main",
      position: at,
      params: { Drive: 1.2, Treble: 5.2, Output: 7 },
    };
    blocks = [...blocks.slice(0, at), boost, ...blocks.slice(at)].map((b, i) => ({ ...b, position: i }));
  }

  const gate = blocks.find((b) => b.modelId === "noise-gate" || b.modelId === "hard-gate");
  const amp = blocks.find((b) => isAmp(b.modelId));
  const dirt = blocks.filter((b) => isDrive(b.modelId));
  const delays = blocks.filter((b) => isDelay(b.modelId));

  const snapshots = next.snapshots.map((snap) => {
    let enabled = [...snap.enabledBlocks];
    const clean = bass ? isCleanName(snap.name) : isCleanSnapshot(snap, blocks);
    const drive = amp ? (snap.paramOverrides?.[amp.id]?.Drive ?? amp.params.Drive ?? 0) : 0;
    if (clean) {
      enabled = enabled.filter((id) => !dirt.some((d) => d.id === id) && id !== gate?.id);
      if (amp && !enabled.includes(amp.id)) enabled.push(amp.id);
    } else if (gate && !enabled.includes(gate.id) && (dirt.some((d) => enabled.includes(d.id)) || drive >= 4.5)) {
      enabled.push(gate.id);
    }
    let shaped: Snapshot = { ...snap, name: fitSnapshotName(snap.name), enabledBlocks: enabled };
    if (clean && amp) {
      const drive = shaped.paramOverrides?.[amp.id]?.Drive ?? amp.params.Drive ?? 5;
      const master = shaped.paramOverrides?.[amp.id]?.Master ?? amp.params.Master ?? 5;
      shaped = withOverrides(shaped, amp.id, {
        Drive: Math.min(drive, 2.2),
        Master: Math.min(Math.max(master, 3.4), 5.2),
      });
    }
    if (liftLeads && isLeadName(snap.name) && boost) {
      // Without a boost the lift comes from Ch Vol in levelMatch below.
      if (!shaped.enabledBlocks.includes(boost.id)) shaped = { ...shaped, enabledBlocks: [...shaped.enabledBlocks, boost.id] };
      shaped = withOverrides(shaped, boost.id, { Drive: 1.2, Output: 7 });
    }
    if (isLeadName(snap.name)) {
      for (const delay of delays) {
        const mix = shaped.paramOverrides?.[delay.id]?.Mix ?? delay.params.Mix ?? 5;
        const fb = shaped.paramOverrides?.[delay.id]?.Feedback ?? delay.params.Feedback ?? 5;
        shaped = withOverrides(shaped, delay.id, { Mix: Math.min(mix, 2.5), Feedback: Math.min(fb, 3.5) });
      }
    }
    return shaped;
  });

  const footswitches = next.footswitches.map((f) => {
    const snap = f.snapshotId ? snapshots.find((s) => s.id === f.snapshotId) : undefined;
    const label = fitSnapshotName(snap?.name || f.label, 12);
    return { ...f, label: label.slice(0, 12) };
  });

  const leveled = bass ? { blocks, snapshots } : levelMatch(blocks, snapshots, liftLeads);
  return { ...next, blocks: leveled.blocks, snapshots: leveled.snapshots, footswitches };
}

/**
 * SL-60 level match. A rough loudness estimate per snapshot from its gain
 * staging, then the amp's Ch Vol nudged so clean and rhythm sit level and a
 * solo is a small lift (about +2.5 dB), not a 6 dB jump.
 *
 * Estimate, in dB relative to nothing in particular:
 *   2 per Ch Vol step, 0.4 per amp Drive step (more gain = more compression =
 *   louder at the same knob), 1.5 for a drive pedal on, 3 for the boost on.
 * A move up is capped at 1.2 on the knob (don't blow up a quiet part); a move
 * down can be up to 2.5 (taming a jump is safe). Never below 3.2 (mute floor).
 */
const DB_PER_CHVOL = 2;
const DB_PER_DRIVE = 0.4;
const DB_DIRT_ON = 1.5;
const DB_BOOST_ON = 3;
export const LEAD_LIFT_DB = 2.5;
const MAX_CHVOL_UP = 1.2;
const MAX_CHVOL_DOWN = 2.5;
const MIN_CHVOL = 3.2;
const MAX_CHVOL = 8.5;
/** Hand-built demos sit at Ch Vol 5.4–6.2; an amp the model left unset starts here. */
const DEFAULT_CHVOL = 6;

/** Gain staging part of the estimate (no Ch Vol): amp Drive, a drive pedal, the boost. */
function gainOf(blocks: StompBlock[], snap: Snapshot): number {
  const amp = blocks.find((b) => isAmp(b.modelId));
  if (!amp) return 0;
  const on = new Set(snap.enabledBlocks);
  const drive = Math.min(snap.paramOverrides?.[amp.id]?.Drive ?? amp.params.Drive ?? 5, 7);
  const dirt = blocks.some((b) => isDrive(b.modelId) && !BASS_DI.test(b.modelId) && on.has(b.id));
  const boost = blocks.some((b) => BOOSTS.has(b.modelId) && on.has(b.id));
  return DB_PER_DRIVE * drive + (dirt ? DB_DIRT_ON : 0) + (boost ? DB_BOOST_ON : 0);
}

export function snapshotLoudness(blocks: StompBlock[], snap: Snapshot): number | null {
  const amp = blocks.find((b) => isAmp(b.modelId));
  if (!amp) return null;
  const chVol = snap.paramOverrides?.[amp.id]?.["Ch Vol"] ?? amp.params["Ch Vol"] ?? DEFAULT_CHVOL;
  return DB_PER_CHVOL * chVol + gainOf(blocks, snap);
}

function levelMatch(
  blocks: StompBlock[],
  snapshots: Snapshot[],
  liftLeads: boolean,
): { blocks: StompBlock[]; snapshots: Snapshot[] } {
  const amp = blocks.find((b) => isAmp(b.modelId));
  if (!amp || snapshots.length < 2) return { blocks, snapshots };
  let ampBlocks = blocks;
  if (amp.params["Ch Vol"] === undefined) {
    ampBlocks = blocks.map((b) => (b.id === amp.id ? { ...b, params: { ...b.params, "Ch Vol": DEFAULT_CHVOL } } : b));
  }
  const lead = (s: Snapshot) => liftLeads && isLeadName(s.name);
  // The reference is the main dirty part: the non-solo snapshot with the most
  // gain (not just the first one, which is often a quiet intro).
  const base = snapshots
    .filter((s) => !lead(s))
    .reduce<Snapshot | undefined>((best, s) => (!best || gainOf(ampBlocks, s) > gainOf(ampBlocks, best) ? s : best), undefined);
  if (!base) return { blocks: ampBlocks, snapshots };
  const baseDb = snapshotLoudness(ampBlocks, base);
  if (baseDb === null) return { blocks: ampBlocks, snapshots };
  const ampBlock = ampBlocks.find((b) => b.id === amp.id)!;

  const out = snapshots.map((snap) => {
    if (snap.id === base.id) return snap;
    const db = snapshotLoudness(ampBlocks, snap);
    if (db === null) return snap;
    const target = baseDb + (lead(snap) ? LEAD_LIFT_DB : 0);
    const move = Math.max(-MAX_CHVOL_DOWN, Math.min(MAX_CHVOL_UP, (target - db) / DB_PER_CHVOL));
    if (Math.abs(move) < 0.25) return snap;
    const chVol = snap.paramOverrides?.[amp.id]?.["Ch Vol"] ?? ampBlock.params["Ch Vol"] ?? DEFAULT_CHVOL;
    const next = Math.round(Math.max(MIN_CHVOL, Math.min(MAX_CHVOL, chVol + move)) * 10) / 10;
    return withOverrides(snap, amp.id, { "Ch Vol": next });
  });
  return { blocks: ampBlocks, snapshots: out };
}

/** Post-process a generated preset. Featured demos only get the name fit via sanitize. */
export function finishTone(preset: Preset, bpm?: number | null): Preset {
  const paced =
    typeof bpm === "number" && bpm >= 40 && bpm <= 240
      ? { ...preset, tempo: Math.round(bpm) }
      : preset;
  if (paced.source === "featured") return paced;
  return shapeGenerated(paced);
}
