import type { CategoryId, CategoryInfo, StompDevice } from "./types";

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "distortion",
    label: "Distortion",
    short: "Drive",
    description:
      "Boosts, overdrives, distortions, and fuzzes. Park these in front of an amp to push it, or after for pedal-platform tones.",
    color: "var(--cat-distortion)",
    lcd: "#ff7a18",
  },
  {
    id: "dynamics",
    label: "Dynamics",
    short: "Dyn",
    description:
      "Compressors, gates, and swells. Glue a clean tone, squash funk, or choke high-gain noise between notes.",
    color: "var(--cat-dynamics)",
    lcd: "#f5d000",
  },
  {
    id: "eq",
    label: "EQ",
    short: "EQ",
    description:
      "Tone-shaping filters: cuts, shelves, graphic, and acoustic sim. Fix a boxy cab or carve a bass DI.",
    color: "var(--cat-eq)",
    lcd: "#c6e800",
  },
  {
    id: "modulation",
    label: "Modulation",
    short: "Mod",
    description:
      "Chorus, phaser, flanger, tremolo, rotary, vibe, and ring mod. Movement and width.",
    color: "var(--cat-modulation)",
    lcd: "#2ec8ff",
  },
  {
    id: "delay",
    label: "Delay",
    short: "Dly",
    description:
      "Tape, analog, digital, multi-head, reverse, and glitch echoes. Time-based repeats from slapback to ambient.",
    color: "var(--cat-delay)",
    lcd: "#22e07a",
  },
  {
    id: "reverb",
    label: "Reverb",
    short: "Rvb",
    description:
      "Rooms, halls, plates, springs, shimmer, and Line 6 original spaces. Places the amp in a room — or in orbit.",
    color: "var(--cat-reverb)",
    lcd: "#b48cff",
  },
  {
    id: "pitch",
    label: "Pitch / Synth",
    short: "Pit",
    description:
      "Whammy, harmony, octave, poly capo, 12-string, and synth generators. Heavy on DSP — budget blocks around them.",
    color: "var(--cat-pitch)",
    lcd: "#ff5a9a",
  },
  {
    id: "filter",
    label: "Filter",
    short: "Flt",
    description:
      "Envelope filters, Mu-Tron, sample-and-hold, and auto-wah. Funk, synth, and experimental movement.",
    color: "var(--cat-filter)",
    lcd: "#e050f0",
  },
  {
    id: "wah",
    label: "Wah",
    short: "Wah",
    description:
      "Expression-controlled wahs modeled on Cry Baby, Vox, and boutique circuits. Assign to EXP 1.",
    color: "var(--cat-wah)",
    lcd: "#ffb020",
  },
  {
    id: "volume",
    label: "Volume / Pan",
    short: "Vol",
    description:
      "Volume pedals, gain, pan, and stereo width. Swells, level matching, and image control.",
    color: "var(--cat-volume)",
    lcd: "#9aa3ad",
  },
  {
    id: "looper",
    label: "Looper",
    short: "Loop",
    description:
      "1-switch looper on HX Stomp, 6-switch on HX Stomp XL. Record, overdub, and undo from the footswitches.",
    color: "var(--cat-looper)",
    lcd: "#e8ecef",
  },
  {
    id: "amp-guitar",
    label: "Guitar Amps",
    short: "Amp",
    description:
      "Full guitar amp models including preamp and power amp. Pair with a Cab or IR. Counts as one block.",
    color: "var(--cat-amp)",
    lcd: "#ff5a4a",
  },
  {
    id: "amp-bass",
    label: "Bass Amps",
    short: "Bass",
    description:
      "Bass amp models from vintage Portaflex to modern high-gain. Pair with a bass cab or blend a DI.",
    color: "var(--cat-amp-bass)",
    lcd: "#ff7a4a",
  },
  {
    id: "preamp",
    label: "Preamps",
    short: "Pre",
    description:
      "Amp preamp sections without the power amp — use into a real power amp, or the Studio Tube mic pre.",
    color: "var(--cat-preamp)",
    lcd: "#ff8a78",
  },
  {
    id: "cab",
    label: "Cabs",
    short: "Cab",
    description:
      "Speaker cabinets with mic choice, distance, and early reflections. Single or dual cab. One block.",
    color: "var(--cat-cab)",
    lcd: "#c4a07a",
  },
  {
    id: "mic",
    label: "Mics",
    short: "Mic",
    description:
      "Microphone models used on cabs: dynamics, ribbons, and condensers. Chosen inside the Cab block.",
    color: "var(--cat-mic)",
    lcd: "#8aa0b0",
  },
  {
    id: "ir",
    label: "Impulse Responses",
    short: "IR",
    description:
      "Load third-party or captured IRs in place of a Cab block. 1024 or 2048 samples. One block each.",
    color: "var(--cat-ir)",
    lcd: "#a88870",
  },
  {
    id: "send-return",
    label: "Send / Return",
    short: "I/O",
    description:
      "Insert real pedals with FX loop blocks, split paths, or send a dry DI. Essential for four-cable method.",
    color: "var(--cat-io)",
    lcd: "#7a8a96",
  },
];

export const CATEGORY_MAP: Record<CategoryId, CategoryInfo> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<CategoryId, CategoryInfo>;

export const STOMP_DEVICES: StompDevice[] = [
  {
    id: "hx-stomp",
    name: "HX Stomp",
    short: "Stomp",
    footswitches: 3,
    snapshots: 3,
    maxBlocks: 8,
    looper: "1-switch",
    presets: 126,
    notes: [
      "One DSP chip — 8 blocks max, poly pitch/whammy are expensive.",
      "Three capacitive-touch footswitches with color LED rings.",
      "Three snapshots per preset. Hold FS3 for tap tempo / tuner.",
      "EXP 1 on the expression jack; FS4/FS5 via TRS for two extra switches.",
      "320×240 color LCD. Three knobs under the screen edit the selected block.",
    ],
  },
  {
    id: "hx-stomp-xl",
    name: "HX Stomp XL",
    short: "Stomp XL",
    footswitches: 8,
    snapshots: 4,
    maxBlocks: 8,
    looper: "6-switch",
    presets: 128,
    notes: [
      "Same HX engine and 8-block / 1-DSP limit as HX Stomp.",
      "Eight capacitive-touch footswitches in two rows of four.",
      "Four snapshots per preset — enough for verse / chorus / bridge / solo.",
      "6-switch looper maps across the extra switches.",
      "Same 320×240 LCD and three edit knobs as HX Stomp.",
    ],
  },
];

export const DEVICE_MAP: Record<string, StompDevice> = Object.fromEntries(
  STOMP_DEVICES.map((d) => [d.id, d]),
);

export const DEFAULT_PARAMS: Record<CategoryId, string[]> = {
  distortion: ["Drive", "Bass", "Mid", "Treble", "Output", "Mix"],
  dynamics: ["Threshold", "Gain", "Attack", "Release", "Mix"],
  eq: ["Bass", "Mid", "Treble", "Level"],
  modulation: ["Rate", "Depth", "Mix", "Tone"],
  delay: ["Time", "Feedback", "Mix", "Mod", "Scale"],
  reverb: ["Decay", "Predelay", "Mix", "Low Cut", "High Cut"],
  pitch: ["Shift", "Mix", "Key", "Delay"],
  filter: ["Freq", "Q", "Mix", "Speed"],
  wah: ["Position", "Mix", "Dc Bias", "Level"],
  volume: ["Level", "Vol Min", "Vol Max"],
  looper: ["Play", "Rec", "Overdub"],
  "amp-guitar": ["Drive", "Bass", "Mid", "Treble", "Presence", "Master", "Ch Vol", "Sag"],
  "amp-bass": ["Drive", "Bass", "Mid", "Treble", "Presence", "Master", "Ch Vol"],
  preamp: ["Drive", "Bass", "Mid", "Treble", "Presence", "Level"],
  cab: ["Mic", "Distance", "Low Cut", "High Cut", "Early Refl"],
  mic: ["Distance", "Low Cut", "High Cut"],
  ir: ["Low Cut", "High Cut", "Mix", "Level"],
  "send-return": ["Send", "Return", "Mix"],
};
