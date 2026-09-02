export type CategoryId =
  | "distortion"
  | "dynamics"
  | "eq"
  | "modulation"
  | "delay"
  | "reverb"
  | "pitch"
  | "filter"
  | "wah"
  | "volume"
  | "looper"
  | "amp-guitar"
  | "amp-bass"
  | "preamp"
  | "cab"
  | "mic"
  | "ir"
  | "send-return";

export type IoType = "mono" | "stereo" | "mono-stereo" | "legacy";
export type Instrument = "guitar" | "bass" | "both";
export type DspWeight = "light" | "medium" | "heavy";

export const STOMP_MODEL_IDS = [
  "hx-stomp",
  "hx-stomp-xl",
  "helix-floor",
  "helix-lt",
  "hx-effects",
  "pod-go",
] as const;

export type StompModelId = (typeof STOMP_MODEL_IDS)[number];

export function isStompModelId(value: string): value is StompModelId {
  return (STOMP_MODEL_IDS as readonly string[]).includes(value);
}

export function parseStompModelId(value: string | null | undefined, fallback: StompModelId = "hx-stomp"): StompModelId {
  return value && isStompModelId(value) ? value : fallback;
}

export type PlaybackTarget = "frfr" | "guitar-amp" | "headphones" | "pa" | "monitors";

export const PLAYBACK_TARGET_IDS = ["frfr", "guitar-amp", "headphones", "pa", "monitors"] as const;

export function parsePlaybackTarget(value: string | null | undefined): PlaybackTarget {
  return value && (PLAYBACK_TARGET_IDS as readonly string[]).includes(value)
    ? (value as PlaybackTarget)
    : "frfr";
}

export type HxModel = {
  id: string;
  name: string;
  category: CategoryId;
  basedOn: string;
  description: string;
  tags: string[];
  io: IoType;
  instrument: Instrument;
  dsp: DspWeight;
  abbrev: string;
  params: string[];
};

export type CategoryInfo = {
  id: CategoryId;
  label: string;
  short: string;
  description: string;
  color: string;
  lcd: string;
};

export type DeviceFamily = "stomp" | "helix" | "effects" | "pod";
export type ExportFormat = "hlx" | "none";
export type DeviceLayout = "stomp" | "xl" | "floor" | "lt" | "effects" | "podgo";

export type StompDevice = {
  id: StompModelId;
  name: string;
  short: string;
  family: DeviceFamily;
  layout: DeviceLayout;
  footswitches: number;
  snapshots: number;
  maxBlocks: number;
  looper: string;
  presets: number;
  hasAmpCab: boolean;
  exportFormat: ExportFormat;
  hlxDeviceId?: number;
  inputModel?: string;
  outputModel?: string;
  outputSend?: string;
  notes: string[];
};

export type StompBlock = {
  id: string;
  modelId: string;
  enabled: boolean;
  path: "main" | "A" | "B";
  position: number;
  params: Record<string, number>;
};

export type Snapshot = {
  id: string;
  name: string;
  color: string;
  enabledBlocks: string[];
  notes: string;
  /** Per-block 0–10 values recalled with this snapshot (HX snapshot controllers). */
  paramOverrides?: Record<string, Record<string, number>>;
};

export type FootswitchAssign = {
  index: number;
  label: string;
  color: string;
  action:
    | "bypass"
    | "snapshot"
    | "tap"
    | "tuner"
    | "looper"
    | "preset-up"
    | "preset-down"
    | "mode";
  targetBlockId?: string;
  snapshotId?: string;
  notes: string;
};

export type OriginalGear = {
  role: string;
  name: string;
  notes: string;
};

export type GearRecommendation = {
  item: string;
  why: string;
};

export type Preset = {
  id: string;
  createdAt: number;
  source: "song" | "custom" | "featured";
  song?: string;
  artist?: string;
  instrument: Exclude<Instrument, "both">;
  stompModel: StompModelId;
  name: string;
  tempo: number;
  summary: string;
  originalGear: OriginalGear[];
  recommendedGear: GearRecommendation[];
  blocks: StompBlock[];
  snapshots: Snapshot[];
  footswitches: FootswitchAssign[];
  programming: string[];
  tips: string[];
  /** How the .hlx should come up on the unit. Snapshot = verse/chorus, Stomp = effects on/off. */
  exportFsMode?: "stomp" | "snapshot";
  playbackTarget?: PlaybackTarget;
};

export type UserGear = {
  id: string;
  kind: "guitar" | "bass" | "amp" | "cab" | "pedal" | "pickup";
  name: string;
  notes: string;
};

export type EquivalentHit = {
  modelId: string;
  score: number;
  reason: string;
};
