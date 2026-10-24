/**
 * Illustrative setlists for the paywall preview and /setlist/demo.
 * These are samples, not built presets: they never export or download.
 * Model ids are real catalog ids so anything that resolves a model works.
 */
import { MODEL_MAP } from "./catalog";

export type SampleKnobs = Record<string, number | string>;

export type SampleBlock = {
  modelId: string;
  /** What the block does in the chain, in player words. */
  role: string;
  knobs: SampleKnobs;
};

export type SamplePart = {
  /** Footswitch 1-3 in Snapshot mode. */
  fs: 1 | 2 | 3;
  name: string;
  note: string;
};

export type SampleSong = {
  id: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  tuning: string;
  unit: "HX Stomp";
  parts: SamplePart[];
  chain: SampleBlock[];
};

export type SampleSetlist = {
  id: "worship" | "cover";
  name: string;
  blurb: string;
  songs: SampleSong[];
};

const UNIT = "HX Stomp" as const;

const drive = (modelId: string, role: string, Drive: number, Output = 5.5): SampleBlock => ({
  modelId,
  role,
  knobs: { Drive, Tone: 5, Output },
});
const amp = (modelId: string, role: string, knobs: SampleKnobs): SampleBlock => ({ modelId, role, knobs });
const cab = (modelId: string, lowCut = 80, highCut = 7.5): SampleBlock => ({
  modelId,
  role: "Cab",
  knobs: { Mic: "57 Dynamic", "Low Cut": `${lowCut} Hz`, "High Cut": `${highCut} kHz` },
});
const dotted = (modelId: string, mix: number, feedback: number): SampleBlock => ({
  modelId,
  role: "Dotted eighth delay",
  knobs: { Time: "1/8.", Feedback: feedback, Mix: mix },
});
const verb = (modelId: string, role: string, mix: number, decay = 4): SampleBlock => ({
  modelId,
  role,
  knobs: { Decay: decay, Mix: mix },
});

const worship: SampleSong[] = [
  {
    id: "w-goodness",
    title: "Goodness of God",
    artist: "Bethel Music",
    key: "Ab",
    bpm: 63,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean, light delay, low reverb" },
      { fs: 2, name: "Chorus", note: "Light drive on, dotted eighth up" },
      { fs: 3, name: "Swell", note: "Reverb and delay bloom for the bridge" },
    ],
    chain: [
      drive("minotaur", "Light push for chorus", 3, 5.5),
      amp("us-deluxe-nrm", "Clean, a little edge", { Drive: 3.5, Bass: 4.5, Mid: 5, Treble: 6, "Ch Vol": 6 }),
      cab("1x12-us-deluxe"),
      dotted("adriatic-delay", 3.5, 3.5),
      verb("plateaux", "Plate for space", 3),
    ],
  },
  {
    id: "w-waymaker",
    title: "Way Maker",
    artist: "Leeland",
    key: "E",
    bpm: 68,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean, delay under the chords" },
      { fs: 2, name: "Chorus", note: "Drive up a notch, wider reverb" },
      { fs: 3, name: "Lead", note: "Boost and longer delay for the line" },
    ],
    chain: [
      drive("teemah", "Boost and grit", 3.5, 6),
      amp("essex-a30", "Chimey clean to crunch", { Drive: 4, Bass: 5, Mid: 5, Treble: 6, "Ch Vol": 6 }),
      cab("2x12-double-c12n"),
      dotted("transistor-tape", 4, 4),
      verb("ganymede", "Big room", 3.5, 5),
    ],
  },
  {
    id: "w-buildmylife",
    title: "Build My Life",
    artist: "Housefires",
    key: "G",
    bpm: 68,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Quiet and clean" },
      { fs: 2, name: "Chorus", note: "Strummed, drive and delay on" },
      { fs: 3, name: "Bridge", note: "Swell pad under the build" },
    ],
    chain: [
      drive("heir-apparent", "Low-gain grit", 3, 5.5),
      amp("us-double-nrm", "Open, glassy clean", { Drive: 3, Bass: 5, Mid: 4.5, Treble: 6.5, "Ch Vol": 6 }),
      cab("2x12-double-c12n"),
      dotted("adriatic-delay", 4, 4),
      verb("shimmer", "Pad under the bridge", 3, 6),
    ],
  },
  {
    id: "w-gratitude",
    title: "Gratitude",
    artist: "Brandon Lake",
    key: "Bb",
    bpm: 69,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean, close delay" },
      { fs: 2, name: "Chorus", note: "Drive and dotted eighth on" },
      { fs: 3, name: "Build", note: "More gain and reverb for the last chorus" },
    ],
    chain: [
      drive("compulsive-drive", "Mid-gain drive", 3.5, 5.5),
      amp("us-deluxe-nrm", "Clean platform", { Drive: 4, Bass: 4.5, Mid: 5, Treble: 6, "Ch Vol": 6 }),
      cab("1x12-us-deluxe"),
      dotted("transistor-tape", 3.5, 3.5),
      verb("hot-springs", "Spring shimmer", 3),
    ],
  },
  {
    id: "w-firm",
    title: "Firm Foundation",
    artist: "Cody Carnes",
    key: "D",
    bpm: 72,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean and tight" },
      { fs: 2, name: "Chorus", note: "Crunch on, dotted eighth up" },
      { fs: 3, name: "Lead", note: "Boost for the melody line" },
    ],
    chain: [
      drive("kinky-boost", "Lead boost", 4, 6.5),
      amp("brit-plexi-brt", "Edge of breakup", { Drive: 4.5, Bass: 4.5, Mid: 6, Treble: 6, Master: 5 }),
      cab("4x12-greenback-25", 90, 7),
      dotted("adriatic-delay", 4, 4),
      verb("plate", "Short plate", 2.5),
    ],
  },
  {
    id: "w-samegod",
    title: "Same God",
    artist: "Elevation Worship",
    key: "Eb",
    bpm: 70,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean with a slow swell" },
      { fs: 2, name: "Chorus", note: "Drive on, wide reverb" },
      { fs: 3, name: "Swell", note: "Reverb pad for the tag" },
    ],
    chain: [
      drive("minotaur", "Always-on warmth", 2.5, 5.5),
      amp("essex-a30", "Chime", { Drive: 4, Bass: 5, Mid: 5, Treble: 6.5, "Ch Vol": 6 }),
      cab("2x12-double-c12n"),
      dotted("cosmos-echo", 4, 4),
      verb("glitz", "Shimmer tail", 3.5, 5),
    ],
  },
];

const cover: SampleSong[] = [
  {
    id: "c-brightside",
    title: "Mr. Brightside",
    artist: "The Killers",
    key: "Db",
    bpm: 148,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean arpeggio, light chorus" },
      { fs: 2, name: "Chorus", note: "Crunch on" },
      { fs: 3, name: "Lead", note: "Boost for the riff" },
    ],
    chain: [
      drive("scream-808", "Riff boost", 3.5, 6.5),
      amp("us-double-nrm", "Bright clean to edge", { Drive: 4, Bass: 5, Mid: 5, Treble: 6.5, "Ch Vol": 6 }),
      cab("2x12-double-c12n"),
      verb("room", "Small room", 2),
    ],
  },
  {
    id: "c-scom",
    title: "Sweet Child O' Mine",
    artist: "Guns N' Roses",
    key: "D",
    bpm: 125,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Intro", note: "Clean riff, a touch of delay" },
      { fs: 2, name: "Chorus", note: "Plexi crunch" },
      { fs: 3, name: "Solo", note: "More gain, longer delay" },
    ],
    chain: [
      drive("scream-808", "Tighten and push", 3, 6.5),
      amp("brit-plexi-brt", "Marshall crunch", { Drive: 6, Bass: 5, Mid: 6.5, Treble: 6, Master: 5.5 }),
      cab("4x12-greenback-25", 90, 7),
      dotted("simple-delay", 3, 3),
    ],
  },
  {
    id: "c-sna",
    title: "Seven Nation Army",
    artist: "The White Stripes",
    key: "E",
    bpm: 124,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Riff", note: "Octave down, clean-ish" },
      { fs: 2, name: "Chorus", note: "Fuzz and octave on" },
      { fs: 3, name: "Solo", note: "Fuzz up, delay on" },
    ],
    chain: [
      drive("triangle-fuzz", "Fuzz for the chorus", 5, 5),
      amp("us-deluxe-nrm", "Loud clean amp", { Drive: 5, Bass: 5, Mid: 5, Treble: 6, "Ch Vol": 6.5 }),
      cab("1x12-us-deluxe"),
      dotted("simple-delay", 3, 3),
    ],
  },
  {
    id: "c-basket",
    title: "Basket Case",
    artist: "Green Day",
    key: "Eb",
    bpm: 168,
    tuning: "Half step down",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Palm-muted crunch" },
      { fs: 2, name: "Chorus", note: "Open chords, drive up" },
      { fs: 3, name: "Lead", note: "Boost for the break" },
    ],
    chain: [
      drive("stupor-od", "Boost into the amp", 3, 6),
      amp("brit-2204", "Punk crunch", { Drive: 6.5, Bass: 5, Mid: 6.5, Treble: 6, Master: 5 }),
      cab("4x12-greenback-25", 90, 7),
      verb("room", "Tight room", 1.5),
    ],
  },
  {
    id: "c-dont-stop",
    title: "Don't Stop Believin'",
    artist: "Journey",
    key: "E",
    bpm: 119,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Verse", note: "Clean, light chorus" },
      { fs: 2, name: "Chorus", note: "Crunch up" },
      { fs: 3, name: "Lead", note: "Lead boost, singing sustain" },
    ],
    chain: [
      drive("teemah", "Lead boost", 3.5, 6),
      amp("essex-a30", "Clean to crunch", { Drive: 4.5, Bass: 5, Mid: 5.5, Treble: 6, "Ch Vol": 6 }),
      cab("2x12-double-c12n"),
      dotted("simple-delay", 3, 3),
      verb("plate", "Plate", 2.5),
    ],
  },
  {
    id: "c-back-in-black",
    title: "Back in Black",
    artist: "AC/DC",
    key: "E",
    bpm: 94,
    tuning: "Standard",
    unit: UNIT,
    parts: [
      { fs: 1, name: "Intro", note: "Plexi on the edge, riff" },
      { fs: 2, name: "Verse", note: "Same amp, a little lower gain" },
      { fs: 3, name: "Solo", note: "Gain up, boost on" },
    ],
    chain: [
      drive("scream-808", "Solo boost", 2.5, 6.5),
      amp("brit-plexi-brt", "Plexi, cranked", { Drive: 6.5, Bass: 5, Mid: 6.5, Treble: 6, Master: 6 }),
      cab("4x12-greenback-25", 90, 7),
    ],
  },
];

export const SAMPLE_SETLISTS: SampleSetlist[] = [
  {
    id: "worship",
    name: "Sunday worship set",
    blurb: "Ambient dotted-eighth delays, swells and a light push of drive.",
    songs: worship,
  },
  {
    id: "cover",
    name: "Friday cover gig",
    blurb: "Crunch, fuzz and a boost for the lead lines.",
    songs: cover,
  },
];

export function sampleSetlist(id: string | undefined | null): SampleSetlist {
  return SAMPLE_SETLISTS.find((s) => s.id === id) ?? SAMPLE_SETLISTS[0];
}

/** Catalog name for a block, falling back to the id so a bad id never blanks the row. */
export function sampleModelName(modelId: string): string {
  return MODEL_MAP[modelId]?.name ?? modelId;
}

export function sampleMeta(song: SampleSong): string {
  return `${song.key} · ${song.bpm} BPM · ${song.tuning}`;
}
