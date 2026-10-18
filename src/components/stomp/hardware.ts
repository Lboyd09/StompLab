/**
 * What each Line 6 unit puts on its footswitches, per footswitch mode.
 * Source: the owner's manuals, summarised in docs/replica-controls.md. Change both together.
 *
 * Switch numbers are the silkscreen / HX Edit numbers. For HX Stomp XL, HX Effects and POD Go,
 * 7 is MODE and 8 is TAP (the replica's long-standing numbering for those two switches).
 */
import { CATEGORY_MAP } from "@/data/categories";
import type { DeviceLayout, Preset } from "@/data/types";
import { blockModel } from "@/lib/preset-utils";

export type FsMode = "stomp" | "snapshot" | "preset";
export type LcdView = "play" | "edit" | "tuner" | "assign";

export type UnitSpec = {
  layout: DeviceLayout;
  /** Switch numbers row by row, top row (farthest from the player) first. */
  rows: number[][];
  mode?: number;
  tap?: number;
  up?: number;
  down?: number;
  /** Switch that recalls snapshot 1, 2, 3… in Snapshot mode. */
  snapshotFs: number[];
  /** Preset mode: switch → slot. `bank` 0 is the current bank, 1 the next one. */
  presetFs: Record<number, { bank: number; letter: string }>;
  /** Switches that carry stomp assignments in Stomp mode. */
  stompFs: number[];
  /** Knobs under the screen; also the parameter page size. */
  knobs: number;
  /** Silkscreen under each switch. */
  silk: Record<number, string>;
  scribbles: "lcd" | "strips" | "performance";
  pedal: boolean;
};

const QUAD_SILK = { 1: "Bank ▲", 2: "C", 3: "D", 4: "Bank ▼", 5: "A", 6: "B", 7: "Mode · Edit/Exit", 8: "Tap · Tuner" };

const quad = (layout: DeviceLayout, knobs: number, pedal: boolean, scribbles: UnitSpec["scribbles"]): UnitSpec => ({
  layout,
  rows: [
    [1, 2, 3, 7],
    [4, 5, 6, 8],
  ],
  mode: 7,
  tap: 8,
  up: 1,
  down: 4,
  snapshotFs: [5, 6, 2, 3],
  presetFs: {
    5: { bank: 0, letter: "A" },
    6: { bank: 0, letter: "B" },
    2: { bank: 0, letter: "C" },
    3: { bank: 0, letter: "D" },
  },
  stompFs: [1, 2, 3, 4, 5, 6],
  knobs,
  silk: QUAD_SILK,
  scribbles,
  pedal,
});

const helix = (layout: DeviceLayout, scribbles: UnitSpec["scribbles"]): UnitSpec => ({
  layout,
  rows: [
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
  ],
  mode: 6,
  tap: 12,
  up: 1,
  down: 7,
  snapshotFs: [8, 9, 10, 11, 2, 3, 4, 5],
  presetFs: {
    8: { bank: 0, letter: "A" },
    9: { bank: 0, letter: "B" },
    10: { bank: 0, letter: "C" },
    11: { bank: 0, letter: "D" },
    2: { bank: 1, letter: "A" },
    3: { bank: 1, letter: "B" },
    4: { bank: 1, letter: "C" },
    5: { bank: 1, letter: "D" },
  },
  stompFs: [2, 3, 4, 5, 8, 9, 10, 11],
  knobs: 6,
  silk:
    layout === "lt"
      ? { 1: "Bank ▲", 6: "Mode", 7: "Bank ▼", 8: "A", 9: "B", 10: "C", 11: "D", 12: "Tap · Tuner" }
      : { 1: "Bank ▲", 6: "Preset / Stomp", 7: "Bank ▼", 12: "Tap" },
  scribbles,
  pedal: true,
});

export const UNIT_SPECS: Record<DeviceLayout, UnitSpec> = {
  stomp: {
    layout: "stomp",
    rows: [[1, 2, 3]],
    tap: 3,
    snapshotFs: [1, 2, 3],
    presetFs: { 1: { bank: 0, letter: "A" }, 2: { bank: 0, letter: "B" }, 3: { bank: 0, letter: "C" } },
    stompFs: [1, 2],
    knobs: 3,
    silk: { 3: "Tap / Tuner" },
    scribbles: "lcd",
    pedal: false,
  },
  xl: quad("xl", 3, false, "lcd"),
  effects: quad("effects", 3, false, "strips"),
  podgo: quad("podgo", 5, true, "lcd"),
  floor: helix("floor", "strips"),
  lt: helix("lt", "performance"),
};

export function unitSpec(layout: DeviceLayout): UnitSpec {
  return UNIT_SPECS[layout] ?? UNIT_SPECS.stomp;
}

export type FaceKind = "stomp" | "snapshot" | "preset" | "up" | "down" | "mode" | "tap" | "empty";

export type SwitchFace = {
  index: number;
  kind: FaceKind;
  label: string;
  color: string;
  /** LED ring: lit (bright), dim (assigned but off / not active), off. */
  led: "lit" | "dim" | "off";
  blockId?: string;
  snapshotIndex?: number;
};

const DIM = "#5a5e62";
const TAP_RED = "#e24a3a";
const PRESET_RED = "#e24a3a";

const ABBREV: [RegExp, string][] = [
  [/^rhythm$/i, "Rhy"],
  [/^crunch$/i, "Crnch"],
  [/^chorus$/i, "Chors"],
  [/^bridge$/i, "Brdg"],
  [/^distortion$/i, "Dist"],
  [/^overdrive$/i, "OD"],
  [/^introduction$/i, "Intro"],
  [/^breakdown$/i, "Brkdn"],
  [/^pre-?chorus$/i, "PreChr"],
  [/^interlude$/i, "Intrld"],
  [/^ambient$/i, "Amb"],
  [/^delay$/i, "Dly"],
  [/^reverb$/i, "Verb"],
  [/^boost$/i, "Bst"],
];

/**
 * Footswitch label that fits a small strip in up to two lines: whole words only.
 * Long words are abbreviated (Rhythm → Rhy); words that still don't fit are dropped from the end.
 * Never cuts a word in half.
 */
export function fitSwitchLabel(raw: string, perLine = 7, lines = 2): string {
  const words = raw
    .replace(/[^\w\s+\-.'&▲▼]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const short = words.map((w) => {
    if (w.length <= perLine) return w;
    for (const [re, rep] of ABBREV) if (re.test(w)) return rep;
    return w;
  });
  // Greedy line fill; stop at the last whole word that fits in `lines` lines.
  const out: string[] = [];
  let line = "";
  let used = 1;
  for (const w of short) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= perLine || !line) {
      line = next;
      continue;
    }
    if (used >= lines) break;
    out.push(line);
    line = w;
    used++;
  }
  if (line) out.push(line);
  return out.join(" ");
}

function blockName(preset: Preset, blockId: string | undefined) {
  const b = preset.blocks.find((x) => x.id === blockId);
  return b ? blockModel(b) : undefined;
}

function presetSlotLabel(bank: number, letter: string) {
  return `${String(bank + 1).padStart(2, "0")}${letter}`;
}

/** Every switch on the unit with what the hardware shows on it in this footswitch mode. */
export function switchFaces(preset: Preset, layout: DeviceLayout, fsMode: FsMode, activeSnapshot: number): SwitchFace[] {
  const spec = unitSpec(layout);
  const all = spec.rows.flat();
  return all.map((index) => faceFor(preset, spec, fsMode, activeSnapshot, index));
}

function faceFor(preset: Preset, spec: UnitSpec, fsMode: FsMode, activeSnapshot: number, index: number): SwitchFace {
  const base = { index, color: DIM, led: "off" as const };
  if (index === spec.mode) {
    if (fsMode === "snapshot") return { ...base, kind: "mode", label: spec.layout === "floor" || spec.layout === "lt" ? "Cancel" : "Exit", led: "dim" };
    return { ...base, kind: "mode", label: fsMode === "stomp" ? "Stomp" : "Preset", led: "dim" };
  }

  if (fsMode === "snapshot") {
    const n = spec.snapshotFs.indexOf(index);
    if (n >= 0) {
      const snap = preset.snapshots[n];
      if (!snap) return { ...base, kind: "empty", label: "" };
      return {
        index,
        kind: "snapshot",
        label: snap.name || `Snapshot ${n + 1}`,
        color: snap.color || "#e8e6df",
        led: n === activeSnapshot ? "lit" : "dim",
        snapshotIndex: n,
      };
    }
    if (index === spec.up) return { ...base, kind: "up", label: "Bank ▲", led: "dim" };
    if (index === spec.down) return { ...base, kind: "down", label: "Bank ▼", led: "dim" };
    if (index === spec.tap) return tapFace(index);
    return { ...base, kind: "empty", label: "" };
  }

  if (fsMode === "preset") {
    const slot = spec.presetFs[index];
    if (slot) {
      const current = slot.bank === 0 && slot.letter === "A";
      return {
        index,
        kind: "preset",
        label: current ? preset.name : presetSlotLabel(slot.bank, slot.letter),
        color: current ? PRESET_RED : DIM,
        led: current ? "lit" : "off",
      };
    }
    if (index === spec.up) return { ...base, kind: "up", label: "Bank ▲", led: "dim" };
    if (index === spec.down) return { ...base, kind: "down", label: "Bank ▼", led: "dim" };
    if (index === spec.tap) return tapFace(index);
    return { ...base, kind: "empty", label: "" };
  }

  // Stomp mode: only bypass assignments, at the switch the exported file names.
  const assign = preset.footswitches.find((f) => f.index === index && f.action === "bypass" && f.targetBlockId);
  const canStomp = spec.stompFs.includes(index) || (spec.layout === "stomp" && index === 3 && assign);
  if (canStomp && assign) {
    const block = preset.blocks.find((b) => b.id === assign.targetBlockId);
    const model = blockName(preset, assign.targetBlockId);
    const color = assign.color || (model ? CATEGORY_MAP[model.category].lcd : "#e8e6df");
    return {
      index,
      kind: "stomp",
      label: assign.label || model?.name || "FX",
      color,
      led: block?.enabled === false ? "dim" : "lit",
      blockId: assign.targetBlockId,
    };
  }
  if (index === spec.tap) return tapFace(index);
  if (spec.stompFs.includes(index)) return { ...base, kind: "empty", label: "" };
  if (index === spec.up) return { ...base, kind: "up", label: "Bank ▲", led: "dim" };
  if (index === spec.down) return { ...base, kind: "down", label: "Bank ▼", led: "dim" };
  return { ...base, kind: "empty", label: "" };
}

function tapFace(index: number): SwitchFace {
  return { index, kind: "tap", label: "Tap", color: TAP_RED, led: "lit" };
}

/** Wah / pitch blocks the built-in pedal's toe switch turns on (EXP 1), and the volume/pan it rides (EXP 2). */
export function pedalTargets(preset: Preset) {
  const wah = preset.blocks.find((b) => {
    const c = blockModel(b)?.category;
    return c === "wah";
  });
  const vol = preset.blocks.find((b) => blockModel(b)?.category === "volume");
  return { wah, vol };
}
