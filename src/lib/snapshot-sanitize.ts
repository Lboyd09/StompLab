import { MODEL_MAP } from "@/data/catalog";
import { DEVICE_MAP } from "@/data/categories";
import type { CategoryId, Preset, Snapshot, StompBlock } from "@/data/types";
import { isVolumeKnob } from "./hx-params";
import { routeFor } from "@/data/playback";

/**
 * In front of a real amp (HX Effects, or a unit set to play into an amp), a snapshot with every
 * pedal off is the amp's clean sound, not silence.
 */
function dryIsAudible(preset: Preset): boolean {
  return routeFor(preset.playbackTarget) === "pedals" || DEVICE_MAP[preset.stompModel]?.hasAmpCab === false;
}

const ABBREV: [RegExp, string][] = [
  [/\brhythm\b/i, "Rhy"],
  [/\bcrunch\b/i, "Crnch"],
  [/\bchorus\b/i, "Chors"],
  [/\bbridge\b/i, "Brdg"],
  [/\bdistortion\b/i, "Dist"],
  [/\boverdrive\b/i, "OD"],
  [/\bintroduction\b/i, "Intro"],
];

/** Helix snapshot names are 12 characters. Abbreviate before cutting a word in half. */
export function fitSnapshotName(raw: string, max = 12): string {
  let s = raw.replace(/[^\w\s+\-.'&]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "Snap";
  if (s.length <= max) return s;
  for (const [re, rep] of ABBREV) s = s.replace(re, rep);
  if (s.length <= max) return s;
  const words = s.split(" ");
  while (words.length > 1 && words.join(" ").length > max) words.pop();
  s = words.join(" ");
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/[\s-]+$/g, "") || "Snap";
}

const LEAD_SNAPSHOT = /\b(lead|solo)\b/i;

/**
 * Fit snapshots to a unit with fewer switches. The lead/solo snapshot is the one a player
 * misses most, so it is always kept; a section in the middle goes instead. Order is kept.
 */
export function keepSnapshots<T extends { name?: string }>(snaps: T[], max: number): T[] {
  if (snaps.length <= max) return snaps;
  if (max <= 0) return [];
  const leads = snaps.filter((s) => LEAD_SNAPSHOT.test(s.name ?? ""));
  // Every snapshot named lead ("Lead Verse", "Lead Chorus"): nothing to protect, keep the first ones.
  if (!leads.length || leads.length === snaps.length) return snaps.slice(0, max);
  // More solos than switches: still leave room for the first snapshot (the intro).
  const keptLeads = leads.slice(0, Math.max(1, max - 1));
  const others = snaps.filter((s) => !keptLeads.includes(s)).slice(0, max - keptLeads.length);
  const keep = new Set<T>([...others, ...keptLeads]);
  return snaps.filter((s) => keep.has(s));
}

const AMP_CAB: ReadonlySet<CategoryId> = new Set([
  "amp-guitar",
  "amp-bass",
  "preamp",
  "cab",
]);

const AMPS: ReadonlySet<CategoryId> = new Set(["amp-guitar", "amp-bass", "preamp"]);

/** Session graphics live in the loop — after the preamp, before the speaker. */
const LOOP_EQ = new Set(["cali-q-graphic", "10-band-graphic"]);

/** Effects with tails a gate must not sit after. */
const TIME_FX: ReadonlySet<CategoryId> = new Set(["delay", "reverb"]);

/** A gate after the cab, or a hot threshold, mutes the whole snapshot. */
const GATES = new Set(["hard-gate", "noise-gate", "horizon-gate"]);

/** UI 0–10. Above this a Hard Gate closes on a real chord and the snapshot goes silent. */
const MAX_GATE_THRESHOLD = 2.2;

/** UI 0–10. Below this the block is effectively off. */
const MIN_LEVEL = 3.2;

function categoryOf(modelId: string): CategoryId | undefined {
  return MODEL_MAP[modelId]?.category;
}

export function isAmpOrCab(modelId: string): boolean {
  const cat = categoryOf(modelId);
  return Boolean(cat && AMP_CAB.has(cat));
}

function isAmp(modelId: string): boolean {
  const cat = categoryOf(modelId);
  return Boolean(cat && AMPS.has(cat));
}

function isCab(modelId: string): boolean {
  return categoryOf(modelId) === "cab";
}

/**
 * Amp + cab must stay on in every snapshot or HX Edit goes silent. On a 4-cable rig the FX Loop
 * block is the real amp's preamp: bypassed, the amp drops out of the chain.
 */
export function essentialBlockIds(blocks: StompBlock[]): string[] {
  return blocks.filter((b) => isAmpOrCab(b.modelId) || b.modelId === "fx-loop").map((b) => b.id);
}

function reindex(blocks: StompBlock[]): StompBlock[] {
  return blocks.map((b, i) => ({ ...b, position: i }));
}

/**
 * Recorded order, not "whatever was typed last":
 * gates in front of the amp, session EQ between amp and cab, cab never before the amp.
 * Delays that were already in front (Echorec, SDD) stay there, with the gate ahead of them.
 */
export function arrangeSignal(blocks: StompBlock[]): StompBlock[] {
  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  const ampAt = sorted.findIndex((b) => isAmp(b.modelId));
  if (ampAt < 0) return reindex(sorted);

  const gates: StompBlock[] = [];
  const graphics: StompBlock[] = [];
  const rest: StompBlock[] = [];
  for (const block of sorted) {
    if (GATES.has(block.modelId)) gates.push(block);
    else if (LOOP_EQ.has(block.modelId)) graphics.push(block);
    else rest.push(block);
  }
  const ampInRest = rest.findIndex((b) => isAmp(b.modelId));
  // A gate after a pre-amp echo chops the repeats: it goes in front of the first delay/reverb.
  const timeAt = rest.slice(0, ampInRest).findIndex((b) => TIME_FX.has(categoryOf(b.modelId) as CategoryId));
  const gateAt = timeAt < 0 ? ampInRest : timeAt;
  const next = [
    ...rest.slice(0, gateAt),
    ...gates,
    ...rest.slice(gateAt, ampInRest),
    rest[ampInRest]!,
    ...graphics,
    ...rest.slice(ampInRest + 1),
  ];
  const cabLate: StompBlock[] = [];
  const body: StompBlock[] = [];
  let seenAmp = false;
  for (const block of next) {
    if (isAmp(block.modelId)) seenAmp = true;
    if (isCab(block.modelId) && !seenAmp) {
      cabLate.push(block);
      continue;
    }
    body.push(block);
    if (isAmp(block.modelId) && cabLate.length) {
      /* cabs collected before the amp are inserted after loop EQ, below */
    }
  }
  if (cabLate.length) {
    const at = body.findIndex((b) => isAmp(b.modelId));
    const graphicsAfter = body.slice(at + 1).findIndex((b) => !LOOP_EQ.has(b.modelId));
    const insertAt = graphicsAfter < 0 ? body.length : at + 1 + graphicsAfter;
    body.splice(insertAt, 0, ...cabLate);
  }
  return reindex(body);
}

function isLevelName(modelId: string, name: string): boolean {
  return isVolumeKnob(modelId, name);
}

function liftParams(modelId: string, params: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!params) return params;
  const next = { ...params };
  if (modelId === "volume-pedal") {
    for (const key of ["Level", "Position", "Pedal"] as const) {
      if (typeof next[key] === "number" && next[key] < 1.5) next[key] = 8;
    }
  }
  for (const [name, value] of Object.entries(next)) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (modelId === "volume-pedal" && (name === "Level" || name === "Position" || name === "Pedal")) continue;
    if (isLevelName(modelId, name) && value < MIN_LEVEL) next[name] = MIN_LEVEL;
  }
  if (typeof next.Threshold === "number" && GATES.has(modelId) && next.Threshold > MAX_GATE_THRESHOLD) {
    next.Threshold = MAX_GATE_THRESHOLD;
  }
  return next;
}

function liftBlock(block: StompBlock): StompBlock {
  return { ...block, params: liftParams(block.modelId, block.params) ?? block.params };
}

/**
 * Snapshot 2+ going silent is almost always: amp/cab bypassed, a gate after
 * the speaker, or a snapshot controller with no @value (HX treats that as 0).
 */
export function sanitizeSnapshots(preset: Preset): Preset {
  const blocks = arrangeSignal(preset.blocks).map(liftBlock);
  const known = new Set(blocks.map((b) => b.id));
  const essentials = essentialBlockIds(blocks);
  const fallback = blocks.filter((b) => b.enabled && !GATES.has(b.modelId)).map((b) => b.id);
  const dry = blocks.filter((b) => !GATES.has(b.modelId)).map((b) => b.id);

  const snapshots: Snapshot[] = preset.snapshots.map((snap) => {
    const kept = snap.enabledBlocks.filter((id) => known.has(id));
    const enabled = [...kept];
    for (const id of essentials) {
      if (!enabled.includes(id)) enabled.push(id);
    }
    // A volume pedal parked at heel, or a gate, must not be the only thing "on"
    // while the amp is bypassed — essentials already cover amp/cab.
    if (!enabled.length && !dryIsAudible(preset)) enabled.push(...(fallback.length ? fallback : dry));
    const paramOverrides = snap.paramOverrides
      ? Object.fromEntries(
          Object.entries(snap.paramOverrides).map(([id, params]) => {
            const block = blocks.find((b) => b.id === id);
            return [id, liftParams(block?.modelId ?? "", params) ?? {}];
          }),
        )
      : undefined;
    return {
      ...snap,
      name: fitSnapshotName(snap.name),
      enabledBlocks: enabled,
      paramOverrides,
    };
  });

  return { ...preset, blocks, snapshots };
}

export type PlayableIssue = { presetId: string; snapshot: string; reason: string };

/** What a player would call a blank preset: no amp, no cab, or a mute level. */
export function playableIssues(preset: Preset): PlayableIssue[] {
  const issues: PlayableIssue[] = [];
  const healed = sanitizeSnapshots(preset);
  const amp = healed.blocks.find((b) => isAmp(b.modelId));
  const cab = healed.blocks.find((b) => isCab(b.modelId));
  if (amp && cab && cab.position < amp.position) {
    issues.push({ presetId: healed.id, snapshot: "*", reason: "cab sits before the amp" });
  }
  const gate = healed.blocks.find((b) => GATES.has(b.modelId));
  if (amp && gate && gate.position > amp.position) {
    issues.push({ presetId: healed.id, snapshot: "*", reason: "gate sits after the amp" });
  }
  const graphic = healed.blocks.find((b) => LOOP_EQ.has(b.modelId));
  if (amp && cab && graphic && (graphic.position < amp.position || graphic.position > cab.position)) {
    issues.push({
      presetId: healed.id,
      snapshot: "*",
      reason: "session EQ is not between the amp and the cab",
    });
  }
  for (const snap of healed.snapshots) {
    const on = new Set(snap.enabledBlocks);
    if (amp && !on.has(amp.id)) {
      issues.push({ presetId: healed.id, snapshot: snap.name, reason: "amp bypassed" });
    }
    if (cab && !on.has(cab.id)) {
      issues.push({ presetId: healed.id, snapshot: snap.name, reason: "cab bypassed" });
    }
    if (!amp && !cab && snap.enabledBlocks.length === 0 && !dryIsAudible(healed)) {
      issues.push({ presetId: healed.id, snapshot: snap.name, reason: "no blocks on" });
    }
    const over = snap.paramOverrides ?? {};
    for (const [id, params] of Object.entries(over)) {
      if (!on.has(id)) continue;
      for (const [name, value] of Object.entries(params)) {
        const blockModel = healed.blocks.find((b) => b.id === id)?.modelId ?? "";
        if (!isLevelName(blockModel, name)) continue;
        if (typeof value === "number" && value < MIN_LEVEL) {
          issues.push({ presetId: healed.id, snapshot: snap.name, reason: `${name} is muted` });
        }
      }
    }
  }
  return issues;
}
