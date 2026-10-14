import { MODEL_MAP } from "@/data/catalog";
import type { CategoryId, Preset, Snapshot, StompBlock } from "@/data/types";
import { newId } from "./preset-utils";
import { fitSnapshotName } from "./snapshot-sanitize";

const BOOSTS = new Set(["kinky-boost", "deranged-master"]);
const HIGH_GAIN_AMP = /rect|uber|soldano|diezel|engl|revv|badonk|archetype|panama|vitriol|placater|german-x|citrus-rv|anglo-heavy|pv-/;

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

function isCleanName(name: string): boolean {
  return /\b(clean|intro|arp|dry)\b/i.test(name) && !/\b(lead|solo|crunch|dist|dirty|heavy)\b/i.test(name);
}

function needsGate(blocks: StompBlock[]): boolean {
  if (blocks.some((b) => b.modelId === "noise-gate" || b.modelId === "hard-gate" || b.modelId === "horizon-gate")) {
    return false;
  }
  const amp = blocks.find((b) => isAmp(b.modelId));
  if (amp && ((amp.params.Drive ?? 0) >= 4.5 || HIGH_GAIN_AMP.test(amp.modelId))) return true;
  return blocks.some((b) => isDrive(b.modelId));
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
  let next = alignGear(markLikely(preset));
  let blocks = next.blocks.map((b) => ({ ...b, params: { ...b.params } }));

  for (const block of blocks) {
    if (!isDelay(block.modelId)) continue;
    if ((block.params.Time ?? 0) >= 9) block.params.Time = 4.2;
    if ((block.params.Scale ?? 0) <= 0) block.params.Scale = 5;
  }

  if (needsGate(blocks) && blocks.length < 8 && MODEL_MAP["noise-gate"]) {
    const ampAt = blocks.findIndex((b) => isAmp(b.modelId));
    const gate: StompBlock = {
      id: newId("blk"),
      modelId: "noise-gate",
      enabled: true,
      path: "main",
      position: ampAt < 0 ? blocks.length : ampAt,
      params: { Threshold: 1.8, Decay: 2.4, Level: 5 },
    };
    blocks = [...blocks.slice(0, gate.position), gate, ...blocks.slice(gate.position)].map((b, i) => ({
      ...b,
      position: i,
    }));
  }

  const leadSnaps = next.snapshots.filter((s) => isLeadName(s.name));
  let boost = blocks.find((b) => b.modelId === "kinky-boost");
  if (leadSnaps.length && !boost && blocks.length < 8 && MODEL_MAP["kinky-boost"]) {
    const ampAt = blocks.findIndex((b) => isAmp(b.modelId));
    const at = ampAt < 0 ? blocks.length : ampAt;
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
    const clean = isCleanName(snap.name);
    if (clean) {
      enabled = enabled.filter((id) => !dirt.some((d) => d.id === id) && id !== gate?.id);
      if (amp && !enabled.includes(amp.id)) enabled.push(amp.id);
    } else if (gate && !enabled.includes(gate.id) && (dirt.some((d) => enabled.includes(d.id)) || (amp && (amp.params.Drive ?? 0) >= 4.5))) {
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
    if (isLeadName(snap.name)) {
      if (boost) {
        if (!shaped.enabledBlocks.includes(boost.id)) shaped = { ...shaped, enabledBlocks: [...shaped.enabledBlocks, boost.id] };
        shaped = withOverrides(shaped, boost.id, { Drive: 1.2, Output: 7 });
      } else if (amp) {
        const vol = shaped.paramOverrides?.[amp.id]?.["Ch Vol"] ?? amp.params["Ch Vol"] ?? 5;
        shaped = withOverrides(shaped, amp.id, { "Ch Vol": Math.min(10, vol + 1.5) });
      }
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

  return { ...next, blocks, snapshots, footswitches };
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
