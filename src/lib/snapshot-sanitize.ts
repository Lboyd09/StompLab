import { MODEL_MAP } from "@/data/catalog";
import type { CategoryId, Preset, Snapshot, StompBlock } from "@/data/types";

const AMP_CAB: ReadonlySet<CategoryId> = new Set([
  "amp-guitar",
  "amp-bass",
  "preamp",
  "cab",
]);

const AMPS: ReadonlySet<CategoryId> = new Set(["amp-guitar", "amp-bass", "preamp"]);

/** Session graphics live in the loop — after the preamp, before the speaker. */
const LOOP_EQ = new Set(["cali-q-graphic", "10-band-graphic"]);

/** A gate after the cab, or a hot threshold, mutes the whole snapshot. */
const GATES = new Set(["hard-gate", "noise-gate", "horizon-gate"]);

/** UI 0–10. Above this a Hard Gate closes on a real chord. */
const MAX_GATE_THRESHOLD = 4.2;

/** Volume knobs that mute the path if a snapshot controller drops them to 0. */
const LEVEL_PARAMS = new Set([
  "Ch Vol",
  "ChVol",
  "Output",
  "Level",
  "Master",
  "Volume",
  "Boost",
]);

/** UI 0–10. Below this the block is effectively off. */
const MIN_LEVEL = 1.5;

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

/** Amp + cab must stay on in every snapshot or HX Edit goes silent. */
export function essentialBlockIds(blocks: StompBlock[]): string[] {
  return blocks.filter((b) => isAmpOrCab(b.modelId)).map((b) => b.id);
}

function reindex(blocks: StompBlock[]): StompBlock[] {
  return blocks.map((b, i) => ({ ...b, position: i }));
}

/**
 * Recorded order, not "whatever was typed last":
 * gates in front of the amp, session EQ between amp and cab, cab never before the amp.
 * Delays that were already in front (Echorec, SDD) stay there.
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
  const next = [
    ...rest.slice(0, ampInRest),
    ...gates,
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

function clampLevelParams(params: Record<string, number> | undefined): Record<string, number> | undefined {
  if (!params) return params;
  const next = { ...params };
  for (const [name, value] of Object.entries(next)) {
    if (!LEVEL_PARAMS.has(name) && !LEVEL_PARAMS.has(name.replace(/\s+/g, ""))) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (value < MIN_LEVEL) next[name] = MIN_LEVEL;
  }
  if (typeof next.Threshold === "number" && next.Threshold > MAX_GATE_THRESHOLD) {
    next.Threshold = MAX_GATE_THRESHOLD;
  }
  return next;
}

function clampGateBlock(block: StompBlock): StompBlock {
  if (!GATES.has(block.modelId)) return block;
  const t = block.params.Threshold;
  if (typeof t !== "number" || t <= MAX_GATE_THRESHOLD) return block;
  return { ...block, params: { ...block.params, Threshold: MAX_GATE_THRESHOLD } };
}

/**
 * Snapshot 2+ going silent is almost always: amp/cab bypassed, a gate after
 * the speaker, or a snapshot controller with no @value (HX treats that as 0).
 */
export function sanitizeSnapshots(preset: Preset): Preset {
  const blocks = arrangeSignal(preset.blocks).map(clampGateBlock);
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
    if (!enabled.length) enabled.push(...(fallback.length ? fallback : dry));
    const paramOverrides = snap.paramOverrides
      ? Object.fromEntries(
          Object.entries(snap.paramOverrides).map(([id, params]) => [id, clampLevelParams(params) ?? {}]),
        )
      : undefined;
    return { ...snap, enabledBlocks: enabled, paramOverrides };
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
    if (!amp && !cab && snap.enabledBlocks.length === 0) {
      issues.push({ presetId: healed.id, snapshot: snap.name, reason: "no blocks on" });
    }
    const over = snap.paramOverrides ?? {};
    for (const [id, params] of Object.entries(over)) {
      if (!on.has(id)) continue;
      for (const [name, value] of Object.entries(params)) {
        if (!LEVEL_PARAMS.has(name) && !LEVEL_PARAMS.has(name.replace(/\s+/g, ""))) continue;
        if (typeof value === "number" && value < MIN_LEVEL) {
          issues.push({ presetId: healed.id, snapshot: snap.name, reason: `${name} is muted` });
        }
      }
    }
  }
  return issues;
}
