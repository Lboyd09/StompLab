import type { Preset, StompBlock } from "./types";

function block(
  id: string,
  modelId: string,
  params: Record<string, number>,
  position: number,
  enabled = true,
): StompBlock {
  return { id, modelId, enabled, path: "main", position, params };
}

/** Lab demos — always free, always downloadable. */
export const DEMO_IDS = ["featured-sandman", "featured-teen-spirit", "featured-numb"] as const;

export const FEATURED: Preset[] = [
  {
    id: "featured-teen-spirit",
    createdAt: 0,
    source: "featured",
    song: "Smells Like Teen Spirit",
    artist: "Nirvana",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Teen Spirit",
    tempo: 117,
    summary:
      "Nevermind (1991). Guitar Chalk + Butch Vig: the INTRO is a clean Twin Reverb with the EHX Small Clone — no DS-1. Dirt is a BOSS DS-1 into the Mesa Studio .22 for verse/chorus. The watery swirl is the pre-chorus ('hello, hello'), not the loud HELLO. Snapshot 1 is that clean intro.",
    originalGear: [
      { role: "Guitar", name: "1969 Fender Mustang (L) / 1965 Jaguar (R)", notes: "Single coils, doubled left/right. Kurt also used Strats with a bridge humbucker on some takes." },
      { role: "Amp (intro)", name: "Fender Twin Reverb", notes: "Guitar Chalk: the opening riff is a clean Twin platform + Small Clone. Headroom, spring tank, no pedal dirt." },
      { role: "Pedal", name: "EHX Small Clone", notes: "Depth switch ON. Intro and pre-chorus. Bypassed for the dry verse and the loud chorus." },
      { role: "Pedal", name: "BOSS DS-1", notes: "Nevermind dirt, gain ~1 o'clock — not dime'd. Off for the clean intro. Helix has no DS-1; Stupor OD (SD-1 family) is the stand-in." },
      { role: "Amp (dirt)", name: "Mesa/Boogie Studio .22 Preamp + Crown", notes: "Nevermind rack. One HX amp (Cali IV Rhythm 2) with intro Drive ~1.6 stands in for the Twin so we don't load two amps." },
      { role: "Cab", name: "Marshall 1960 4×12, SM57 / 414 / U87", notes: "Close, dry. SM57 is the Stomp default." },
    ],
    recommendedGear: [
      { item: "Offset or Strat-style single coil", why: "The icepick and clack are the riff. Roll the guitar tone back a hair." },
      { item: "Bridge pickup, guitar volume at 7 for verses", why: "Kurt didn't switch channels — he turned the guitar down." },
    ],
    blocks: [
      block("b1", "stupor-od", { Drive: 7.0, Bass: 5.0, Mid: 6.6, Treble: 5.6, Output: 6.0 }, 0, false),
      block("b2", "70s-chorus", { Rate: 3.4, Depth: 7.2, Mix: 6.5, Tone: 5.4 }, 1),
      block("b3", "cali-iv-rhythm-2", { Drive: 1.6, Bass: 5.0, Mid: 6.0, Treble: 5.6, Presence: 4.2, Master: 5.6, "Ch Vol": 5.2, Sag: 3.4 }, 2),
      block("b4", "4x12-cali-v30", { Mic: 0, Distance: 2.0, "Low Cut": 2.4, "High Cut": 7.0, "Early Refl": 2.4 }, 3),
      block("b5", "hot-springs", { Decay: 3.6, Predelay: 1.4, Mix: 3.2, "Low Cut": 3.0, "High Cut": 7.4 }, 4),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Intro",
        color: "#7d9a6a",
        enabledBlocks: ["b2", "b3", "b4", "b5"],
        notes: "CLEAN Twin-style intro. DS-1 OFF, Small Clone ON, Drive 1.6, spring tank up. This is the opening riff.",
        paramOverrides: {
          b3: { Drive: 1.6, "Ch Vol": 5.2, Presence: 4.2, Treble: 5.8 },
          b5: { Mix: 3.2, Decay: 3.6 },
        },
      },
      {
        id: "s2",
        name: "Verse",
        color: "#c5c9c2",
        enabledBlocks: ["b1", "b3", "b4"],
        notes: "DS-1 on, Small Clone OFF — the dry muted verse riff. Play lighter; guitar volume ~7.",
        paramOverrides: {
          b3: { Drive: 4.2, "Ch Vol": 5.4, Presence: 4.4, Treble: 5.4 },
        },
      },
      {
        id: "s3",
        name: "Chorus",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b3", "b4"],
        notes: "Small Clone OFF — the loud HELLO chorus. Amp slammed. Use this for the solo too.",
        paramOverrides: {
          b3: { Drive: 6.8, "Ch Vol": 6.8, Presence: 5.4, Treble: 5.6 },
        },
      },
      {
        id: "s4",
        name: "Pre",
        color: "#2ec8ff",
        enabledBlocks: ["b1", "b2", "b3", "b4"],
        notes: "XL snapshot 4. Small Clone ON — the watery 'hello, hello, hello' pre-chorus.",
        paramOverrides: {
          b2: { Mix: 6.5, Depth: 7.2 },
          b3: { Drive: 4.6, "Ch Vol": 5.8, Presence: 4.6 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "INTRO", color: "#7d9a6a", action: "snapshot", snapshotId: "s1", notes: "Clean Twin + Small Clone. No DS-1." },
      { index: 2, label: "VERSE", color: "#c5c9c2", action: "snapshot", snapshotId: "s2", notes: "Dry verse, clone off." },
      { index: 3, label: "CHORUS", color: "#e24a3a", action: "snapshot", snapshotId: "s3", notes: "Loud chorus, clone off." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: PAGE until the scribbles say INTRO / VERSE / CHORUS.",
      "Path: Stupor OD → 70s Chorus → Cali IV Rhythm 2 → 4x12 Cali V30 → Hot Springs.",
      "Intro (FS1): DS-1 OFF, Small Clone ON, Drive 1.6, spring Mix 3.2. Guitar Chalk Twin + Clone.",
      "Verse (FS2): DS-1 ON, clone OFF, Drive 4.2. Chorus (FS3): clone OFF, Drive 6.8.",
      "On HX Stomp XL, snapshot 4 (PRE) is the watery hello — Small Clone + DS-1. Replica switch 4 (bottom-left).",
      "One amp on purpose. A real Twin + Mesa would blow the Stomp DSP; intro Drive is the Twin stand-in.",
      "Download the .hlx. HX Edit: File → Import. PAGE enters Snapshot mode.",
    ],
    tips: [
      "If the opening riff is dirty, you're on Verse — hit FS1. The intro should shimmer, not crunch.",
      "Play the loud chorus with the guitar wide open and pick near the bridge. Leave the Small Clone off.",
    ],
  },
  {
    id: "featured-sandman",
    createdAt: 0,
    source: "featured",
    song: "Enter Sandman",
    artist: "Metallica",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Sandman",
    tempo: 123,
    summary:
      "Metallica Black Album (1991). Three parts, three snapshots — this is the whole song. INTRO: wah on, TS off, Recto almost clean (Kirk's arpeggio). RHYTHM: wah off, TS-9 tightener, Dual Rectifier slammed, gate on (James). LEAD: same as rhythm, Channel Volume up. After import, put the Stomp in Snapshot mode so FS1–FS3 actually switch sections.",
    originalGear: [
      { role: "Guitar", name: "ESP Explorer, EMG 81", notes: "James rhythm. Kirk's intro is the wah lick." },
      { role: "Pedal", name: "Ibanez TS-9 Tube Screamer", notes: "Drive low, Level high — tightens the Recto. Off for the clean intro." },
      { role: "Pedal", name: "Dunlop Cry Baby", notes: "Kirk intro. Assign EXP 1 to Wah Position." },
      { role: "Amp", name: "Mesa Dual Rectifier + Marshall JCM-800", notes: "Bob Rock blended a Recto and a Marshall. This patch is the Recto body." },
      { role: "Cab", name: "Mesa / Marshall 4×12 V30, SM57", notes: "Tight, close." },
    ],
    recommendedGear: [
      { item: "Humbucker bridge (EMG or hot passive)", why: "Single coils will be thin and noisy on this riff." },
      { item: "Expression pedal", why: "The intro is a wah part. Without EXP 1 you can still park Position." },
    ],
    blocks: [
      block("b1", "uk-wah-846", { Position: 3.5, Mix: 10, "Dc Bias": 5, Level: 5 }, 0, true),
      block("b2", "scream-808", { Drive: 2.0, Bass: 4.5, Mid: 6.6, Treble: 5.4, Output: 7.6 }, 1, false),
      block("b3", "cali-rectifire", { Drive: 1.8, Bass: 5.0, Mid: 6.0, Treble: 5.8, Presence: 3.8, Master: 5.4, "Ch Vol": 5.4, Sag: 3.2 }, 2),
      block("b4", "4x12-cali-v30", { Mic: 0, Distance: 1.6, "Low Cut": 2.8, "High Cut": 6.8, "Early Refl": 2.2 }, 3),
      block("b5", "hard-gate", { Threshold: 5.8, Decay: 2.0 }, 4, false),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Intro",
        color: "#c5c9c2",
        enabledBlocks: ["b1", "b3", "b4"],
        notes: "CLEAN intro. Wah on EXP 1, Tube Screamer off, gate off, Recto Drive 1.8 so the arpeggio rings.",
        paramOverrides: {
          b1: { Position: 4.0 },
          b3: { Drive: 1.8, "Ch Vol": 5.4, Presence: 3.8, Treble: 5.8 },
        },
      },
      {
        id: "s2",
        name: "Rhythm",
        color: "#e24a3a",
        enabledBlocks: ["b2", "b3", "b4", "b5"],
        notes: "Main chug. Wah off, TS-9 on, gate on, Recto Drive 5.8.",
        paramOverrides: {
          b3: { Drive: 5.8, "Ch Vol": 6.2, Presence: 4.8, Treble: 5.4 },
        },
      },
      {
        id: "s3",
        name: "Lead",
        color: "#f5d000",
        enabledBlocks: ["b2", "b3", "b4", "b5"],
        notes: "Kirk solo bump — same chain, louder.",
        paramOverrides: {
          b3: { Drive: 6.2, "Ch Vol": 7.2, Presence: 6.0, Treble: 5.8 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "INTRO", color: "#c5c9c2", action: "snapshot", snapshotId: "s1", notes: "Clean wah intro." },
      { index: 2, label: "RHYTHM", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "James chug." },
      { index: 3, label: "LEAD", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Kirk solo." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: press the Stomp PAGE button until the scribble strips say INTRO / RHYTHM / LEAD. FS1–FS3 recall those snapshots.",
      "Path: UK Wah 846 → Scream 808 → Cali Rectifire → 4x12 Cali V30 → Hard Gate.",
      "Intro snapshot: wah ON, TS OFF, gate OFF, Drive 1.8. That is the clean arpeggio.",
      "Rhythm snapshot: wah OFF, TS ON (Drive 2 / Level 7.6), gate ON, Recto Drive 5.8.",
      "Assign EXP 1 to Wah Position for the intro lick.",
    ],
    tips: [
      "If the intro isn't clean, you're on the Rhythm snapshot. Hit FS1.",
      "Palm mute harder than you think. The gate only works if your right hand is tight.",
    ],
  },
  {
    id: "featured-numb",
    createdAt: 0,
    source: "featured",
    song: "Comfortably Numb",
    artist: "Pink Floyd",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Numb Solo",
    tempo: 64,
    summary:
      "The Wall (1979). Gilmour's solos are a Ram's Head Big Muff into a Hiwatt DR-103, with a Binson Echorec in front of the amp. Verses are the Hiwatt almost clean. Snapshots: verse / solo 1 / solo 2. The vibrato is in his hands — keep modulation off.",
    originalGear: [
      { role: "Guitar", name: "Fender Stratocaster", notes: "Neck pickup for the first solo, bridge-leaning for the second. Tone rolled back." },
      { role: "Pedal", name: "Electro-Harmonix Big Muff (Ram's Head)", notes: "Sustain up, tone around 11–12 o'clock. Off for verses." },
      { role: "Delay", name: "Binson Echorec", notes: "Multi-head platter echo BEFORE the amp so repeats saturate with the muff." },
      { role: "Amp", name: "Hiwatt DR-103 + WEM/Fane 4×12", notes: "Loud clean headroom. The muff is the dirt, not the amp." },
    ],
    recommendedGear: [
      { item: "Strat, neck or neck+middle", why: "The vocal quality of the first solo is a neck pickup into a muff." },
      { item: "Roll the guitar tone to 6–7", why: "Tames muff fizz the same way Gilmour's secret sauce does." },
    ],
    blocks: [
      block("b1", "bighorn-fuzz", { Drive: 6.8, Bass: 6.2, Mid: 4.4, Treble: 4.8, Output: 5.6, Mix: 10 }, 0),
      block("b2", "cosmos-echo", { Time: 3.6, Feedback: 3.0, Mix: 2.6, Mod: 1.8, Scale: 5 }, 1),
      block("b3", "whowatt-100", { Drive: 3.0, Bass: 5.4, Mid: 6.0, Treble: 5.8, Presence: 5.0, Master: 6.2, "Ch Vol": 6.0, Sag: 2.8 }, 2),
      block("b4", "4x12-whowatt-100", { Mic: 0, Distance: 3.4, "Low Cut": 2.0, "High Cut": 7.6, "Early Refl": 4.2 }, 3),
      block("b5", "plate", { Decay: 3.4, Predelay: 2.0, Mix: 2.2, "Low Cut": 3.4, "High Cut": 7.0 }, 4),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Verse",
        color: "#7d9a6a",
        enabledBlocks: ["b2", "b3", "b4", "b5"],
        notes: "Muff off. Hiwatt almost clean, short echo.",
        paramOverrides: {
          b2: { Mix: 1.8, Feedback: 2.4 },
          b3: { Drive: 2.6, "Ch Vol": 5.6 },
        },
      },
      {
        id: "s2",
        name: "Solo 1",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Muff on, Echorec mix 2.6. Neck pickup.",
        paramOverrides: {
          b2: { Mix: 2.6, Feedback: 3.0 },
          b3: { Drive: 3.0, "Ch Vol": 6.0 },
        },
      },
      {
        id: "s3",
        name: "Solo 2",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "More delay, a little more Hiwatt. Play more aggressively.",
        paramOverrides: {
          b2: { Mix: 3.4, Feedback: 3.6 },
          b3: { Drive: 3.8, "Ch Vol": 6.6 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "VERSE", color: "#7d9a6a", action: "snapshot", snapshotId: "s1", notes: "Clean verses / fills." },
      { index: 2, label: "SOLO1", color: "#f5d000", action: "snapshot", snapshotId: "s2", notes: "First solo." },
      { index: 3, label: "SOLO2", color: "#e24a3a", action: "snapshot", snapshotId: "s3", notes: "Second solo. Hold for tuner." },
    ],
    programming: [
      "Path: Bighorn Fuzz → Cosmos Echo → WhoWatt 100 → 4x12 WhoWatt 100 → Plate. Delay BEFORE the amp.",
      "Cosmos Echo is the Binson Echorec. Mix 1.8 verse / 2.6 solo 1 / 3.4 solo 2 via snapshot parameter recall.",
      "WhoWatt Drive stays low — 2.6 / 3.0 / 3.8. The muff is the gain.",
      "Tempo 64. Optional: assign FS3 hold to tuner. EXP 1 can be a Volume Pedal in front of the muff for violin swells.",
    ],
    tips: [
      "Play behind the beat. The delay should feel like a second guitar, not a dotted-eighth U2 part.",
      "If the muff scoops too hard, raise Mid to 5.2. Don't stack another overdrive unless you want a different song.",
    ],
  },
  {
    id: "featured-streets",
    createdAt: 0,
    source: "featured",
    song: "Where the Streets Have No Name",
    artist: "U2",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Streets",
    tempo: 126,
    summary:
      "The Joshua Tree (1987). Guitar Chalk: Vox AC30, Korg SDD-3000 dotted-eighth, Deluxe Memory Man for analog bloom. The guitar is almost clean — the delay IS the riff. Three snapshots (Intro cascade / Verse SDD / Chorus both), same layout as Sandman.",
    originalGear: [
      { role: "Guitar", name: "Fender Stratocaster / Explorer", notes: "Bright pickup, lots of pick attack, near the bridge." },
      { role: "Delay", name: "Korg SDD-3000", notes: "Dotted 8th digital. The Joshua Tree sound." },
      { role: "Delay", name: "EHX Deluxe Memory Man", notes: "Shorter analog, modulation on, mix lower than the SDD." },
      { role: "Amp", name: "Vox AC-30 Top Boost", notes: "Chime, not cranked to crunch. Guitar Chalk: Brilliant channel, Treble ~2 o'clock." },
    ],
    recommendedGear: [
      { item: "Strat or other bright single coil", why: "Dark humbuckers smear the dotted-eighth pattern." },
      { item: "A pick, near the bridge", why: "The riff is all attack. Play it like a sequencer." },
    ],
    blocks: [
      block("b1", "deluxe-comp", { Threshold: 4.2, Gain: 5.2, Attack: 3.6, Release: 4.4, Mix: 5.5 }, 0),
      block("b2", "vintage-digital", { Time: 4.2, Feedback: 3.6, Mix: 4.6, Mod: 1.0, Scale: 5 }, 1),
      block("b3", "elephant-man", { Time: 2.6, Feedback: 2.4, Mix: 2.0, Mod: 4.2, Scale: 5 }, 2),
      block("b4", "essex-a30", { Drive: 3.2, Bass: 4.8, Mid: 6.2, Treble: 6.6, Presence: 5.4, Master: 5.8, "Ch Vol": 6.0, Sag: 2.8 }, 3),
      block("b5", "2x12-blue-bell", { Mic: 0, Distance: 2.8, "Low Cut": 2.4, "High Cut": 8.0, "Early Refl": 3.6 }, 4),
      block("b6", "plateaux", { Decay: 3.0, Predelay: 1.8, Mix: 1.8, "Low Cut": 3.2, "High Cut": 7.2 }, 5),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Intro",
        color: "#2ec8ff",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5", "b6"],
        notes: "Opening cascade — both delays. This is the famous intro.",
        paramOverrides: {
          b2: { Mix: 4.8, Feedback: 3.8 },
          b3: { Mix: 2.4, Feedback: 2.6 },
        },
      },
      {
        id: "s2",
        name: "Verse",
        color: "#7d9a6a",
        enabledBlocks: ["b1", "b2", "b4", "b5", "b6"],
        notes: "SDD-3000 only. Thinner dotted-eighth for the verse figure.",
        paramOverrides: {
          b2: { Mix: 4.2, Feedback: 3.4 },
        },
      },
      {
        id: "s3",
        name: "Chorus",
        color: "#c5c9c2",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5", "b6"],
        notes: "Both delays, a little more mix and bloom for the lift.",
        paramOverrides: {
          b2: { Mix: 5.0, Feedback: 4.0 },
          b3: { Mix: 2.8, Feedback: 2.8 },
          b6: { Mix: 2.4 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "INTRO", color: "#2ec8ff", action: "snapshot", snapshotId: "s1", notes: "Both delays — the cascade." },
      { index: 2, label: "VERSE", color: "#7d9a6a", action: "snapshot", snapshotId: "s2", notes: "SDD only." },
      { index: 3, label: "CHORUS", color: "#c5c9c2", action: "snapshot", snapshotId: "s3", notes: "Both delays, more mix." },
    ],
    programming: [
      "SNAPSHOT MODE. PAGE until INTRO / VERSE / CHORUS. Same layout as Sandman / Teen Spirit.",
      "Path: Deluxe Comp → Vintage Digital → Elephant Man → Essex A30 → 2x12 Blue Bell → Plateaux.",
      "Vintage Digital: dotted 8th at 126 BPM, Feedback 3.6, Mix 4.6. This is the riff.",
      "Elephant Man: shorter analog, Mix 2.0–2.8, Mod 4.2 for Memory Man chorus.",
      "Tempo 126. Comp Mix 5.5 — just enough to even the 16ths. No gate.",
    ],
    tips: [
      "Play sixteenth notes dead even. If your timing is off, the delay will expose it immediately.",
      "Kill the guitar between phrases so the delay can finish the sentence.",
    ],
  },
  {
    id: "featured-give-it-away",
    createdAt: 0,
    source: "featured",
    song: "Give It Away",
    artist: "Red Hot Chili Peppers",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Give It Away",
    tempo: 92,
    summary:
      "Blood Sugar Sex Magik (1991). Frusciante's quack is a Mu-Tron III into a Marshall Silver Jubilee — not a Super Lead. Helix has no Jubilee, so Placater Dirty (Friedman BE, Jubilee-derived) is the right family. Three snapshots: Quack / Crunch / Solo — same layout as Sandman.",
    originalGear: [
      { role: "Guitar", name: "Fender Stratocaster", notes: "Worn Strat, single coils, often bridge or middle." },
      { role: "Pedal", name: "Mu-Tron III", notes: "Up position. Sensitivity follows pick attack — play it like percussion." },
      { role: "Amp", name: "Marshall 2555 Silver Jubilee", notes: "John's BSSM head. JCM800 cousin with a unique mid. Friedman BE is the Helix-adjacent circuit." },
    ],
    recommendedGear: [
      { item: "Strat bridge or middle", why: "The filter needs treble content to quack." },
      { item: "A pick, or fingers with nails", why: "Envelope filters track attack. Soft fingers = no quack." },
    ],
    blocks: [
      block("b1", "mutant-filter", { Freq: 5.6, Q: 6.4, Mix: 10, Speed: 6.8 }, 0),
      block("b2", "placater-dirty", { Drive: 5.0, Bass: 4.8, Mid: 6.4, Treble: 5.8, Presence: 5.0, Master: 5.6, "Ch Vol": 6.0, Sag: 4.2 }, 1),
      block("b3", "4x12-greenback-25", { Mic: 0, Distance: 2.2, "Low Cut": 2.6, "High Cut": 7.4, "Early Refl": 2.8 }, 2),
      block("b4", "room", { Decay: 1.8, Predelay: 0.8, Mix: 1.4, "Low Cut": 3.6, "High Cut": 6.4 }, 3),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Quack",
        color: "#e050f0",
        enabledBlocks: ["b1", "b2", "b3", "b4"],
        notes: "Filter on — the riff. Mute between hits so the envelope retriggers.",
      },
      {
        id: "s2",
        name: "Crunch",
        color: "#e24a3a",
        enabledBlocks: ["b2", "b3", "b4"],
        notes: "Filter off for dry chorus stabs.",
        paramOverrides: {
          b2: { Drive: 5.0, "Ch Vol": 6.0 },
        },
      },
      {
        id: "s3",
        name: "Solo",
        color: "#f5d000",
        enabledBlocks: ["b2", "b3", "b4"],
        notes: "Drive up, filter off.",
        paramOverrides: {
          b2: { Drive: 6.2, "Ch Vol": 6.8 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "QUACK", color: "#e050f0", action: "snapshot", snapshotId: "s1", notes: "Mu-Tron riff." },
      { index: 2, label: "CRUNCH", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "Dry Jubilee." },
      { index: 3, label: "SOLO", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Drive bump." },
    ],
    programming: [
      "SNAPSHOT MODE. PAGE until QUACK / CRUNCH / SOLO. Same layout as Sandman.",
      "Path: Mutant Filter → Placater Dirty → 4x12 Greenback 25 → Room. No gate, no compressor.",
      "Mutant Filter: Mix 10, Q 6.4. Raise Speed/sensitivity until muted 16ths quack.",
      "Placater Dirty (Jubilee family): Drive 5.0 — crunch, not a Recto. Snap 3 Drive 6.2.",
    ],
    tips: [
      "Mute with the left hand between hits so the envelope retriggers every note.",
      "If it honks, drop Q. If it's lifeless, pick harder before you touch the knob.",
    ],
  },
  {
    id: "featured-yyz",
    createdAt: 0,
    source: "featured",
    song: "YYZ",
    artist: "Rush",
    instrument: "bass",
    stompModel: "hx-stomp",
    name: "YYZ Bass",
    tempo: 126,
    summary:
      "Moving Pictures (1981). Geddy's bass is a bright Jazz Bass (Ric on other eras) split between a DI and an Ampeg SVT / Hiwatt stack. Light compression so the picked 16ths stay percussive. Three snapshots: Riff / Fill / Lead — same layout as Sandman.",
    originalGear: [
      { role: "Bass", name: "Fender Jazz Bass", notes: "Moving Pictures era. Both pickups, a little bridge-heavy. Rickenbacker 4001 on earlier Rush." },
      { role: "Amp", name: "Ampeg SVT + Hiwatt, blended with DI", notes: "The record is amp + direct. Punch, clack, and a mid bump." },
      { role: "Studio", name: "Light compression on the way in", notes: "Leveling, not a Dyna Comp tick." },
    ],
    recommendedGear: [
      { item: "Jazz Bass or similar dual-single", why: "The clack of a J-bass bridge pickup is the riff." },
      { item: "Roundwounds, pick", why: "Fingers will be too round for YYZ." },
    ],
    blocks: [
      block("b1", "kinky-comp", { Threshold: 3.8, Gain: 5.0, Attack: 5.2, Release: 4.0, Mix: 4.5 }, 0),
      block("b2", "ampeg-svt-brt", { Drive: 4.0, Bass: 5.4, Mid: 6.6, Treble: 6.4, Presence: 5.8, Master: 5.4, "Ch Vol": 6.0 }, 1),
      block("b3", "8x10-ampeg-svt", { Mic: 4, Distance: 2.4, "Low Cut": 1.8, "High Cut": 7.2, "Early Refl": 3.0 }, 2),
      block("b4", "simple-eq", { Bass: 4.4, Mid: 6.6, Treble: 6.2, Level: 5.4 }, 3),
      block("b5", "room", { Decay: 1.6, Predelay: 0.8, Mix: 1.0, "Low Cut": 4.2, "High Cut": 6.0 }, 4),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Riff",
        color: "#c5c9c2",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Main ostinato. This is the patch.",
        paramOverrides: {
          b2: { Drive: 4.0, Treble: 6.4 },
        },
      },
      {
        id: "s2",
        name: "Fill",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Slightly more Drive and Treble for busier sections.",
        paramOverrides: {
          b2: { Drive: 4.8, Treble: 7.0 },
        },
      },
      {
        id: "s3",
        name: "Lead",
        color: "#2ec8ff",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Busier / solo-ish — Drive and Treble up, still the SVT in the chain.",
        paramOverrides: {
          b2: { Drive: 5.2, Treble: 7.2, "Ch Vol": 6.4 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "RIFF", color: "#c5c9c2", action: "snapshot", snapshotId: "s1", notes: "Main ostinato." },
      { index: 2, label: "FILL", color: "#f5d000", action: "snapshot", snapshotId: "s2", notes: "Busier sections." },
      { index: 3, label: "LEAD", color: "#2ec8ff", action: "snapshot", snapshotId: "s3", notes: "Drive and treble bump." },
    ],
    programming: [
      "SNAPSHOT MODE. PAGE until RIFF / FILL / LEAD. Same layout as Sandman.",
      "Path: Kinky Comp → Ampeg SVT Brt → 8x10 Ampeg SVT → Simple EQ → Room.",
      "Comp Mix 4.5, Attack 5.2 — leveling, not squash. The pick has to stay.",
      "SVT Bright, Drive 4.0. If it farts, drop Bass and raise cab Low Cut.",
      "Simple EQ Mid 6.6 is the clack. Tempo 126.",
    ],
    tips: [
      "Mute unused strings. The ostinato falls apart if the low E rings.",
      "If you own an SVT, run the Stomp as a preamp into it via Send and skip the cab.",
    ],
  },
  {
    id: "featured-schism",
    createdAt: 0,
    source: "featured",
    song: "Schism",
    artist: "Tool",
    instrument: "bass",
    stompModel: "hx-stomp",
    name: "Schism",
    tempo: 82,
    summary:
      "Lateralus (2001). Justin Chancellor is a Wal MKII into Diezel/Mesa with analog chorus on the unison lines. Period dirt is a SansAmp-style blend, not a 2010s Darkglass. Snapshots: Line / Unison / Heavy / Lead — same snapshot layout as the guitar rigs.",
    originalGear: [
      { role: "Bass", name: "Wal MKII", notes: "Active, dense mids, very articulate. The part is the tone." },
      { role: "Amp", name: "Diezel VH4 / Mesa / GK", notes: "High-headroom grind. Wet/dry in the live rig." },
      { role: "Pedal", name: "Tech 21 SansAmp + analog chorus", notes: "Mild grit and a chorus that makes the unison lines huge. B7K is anachronistic for 2001." },
    ],
    recommendedGear: [
      { item: "Active bass with a mid bump", why: "A dark P-bass will disappear under the guitar." },
      { item: "Pick", why: "The attack is the riff. Fingers for the outro if you want." },
    ],
    blocks: [
      block("b1", "3-band-comp", { "Thr Low": 4.0, "Thr Mid": 4.8, "Thr High": 4.4, Gain: 5.4, Mix: 5.5 }, 0),
      block("b2", "zeroamp-bass-di", { Drive: 4.2, Bass: 5.0, Mid: 6.4, Treble: 5.2, Output: 5.4, Mix: 4.2 }, 1),
      block("b3", "das-benzin-lead", { Drive: 4.2, Bass: 5.0, Mid: 6.4, Treble: 5.4, Presence: 4.8, Master: 5.4, "Ch Vol": 6.0, Sag: 3.0 }, 2),
      block("b4", "8x10-ampeg-svt", { Mic: 4, Distance: 2.0, "Low Cut": 2.0, "High Cut": 6.8, "Early Refl": 2.6 }, 3),
      block("b5", "70s-chorus", { Rate: 2.2, Depth: 3.6, Mix: 3.4, Tone: 5.4 }, 4),
      block("b6", "hall", { Decay: 2.6, Predelay: 1.6, Mix: 1.4, "Low Cut": 4.0, "High Cut": 6.2 }, 5),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Line",
        color: "#c5c9c2",
        enabledBlocks: ["b1", "b3", "b4", "b6"],
        notes: "Dirt and chorus off — the dry Wal line.",
      },
      {
        id: "s2",
        name: "Unison",
        color: "#2ec8ff",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5", "b6"],
        notes: "Chorus + SansAmp blend. The famous line.",
      },
      {
        id: "s3",
        name: "Heavy",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b6"],
        notes: "Chorus off, grit on.",
        paramOverrides: {
          b2: { Mix: 5.5, Drive: 5.2 },
          b3: { Drive: 5.2 },
        },
      },
      {
        id: "s4",
        name: "Lead",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5", "b6"],
        notes: "Everything on, dirt mix higher.",
        paramOverrides: {
          b2: { Mix: 6.0, Drive: 5.4 },
          b3: { Drive: 5.0, "Ch Vol": 6.6 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "LINE", color: "#c5c9c2", action: "snapshot", snapshotId: "s1", notes: "Dry line." },
      { index: 2, label: "UNISON", color: "#2ec8ff", action: "snapshot", snapshotId: "s2", notes: "The famous chorus line." },
      { index: 3, label: "HEAVY", color: "#e24a3a", action: "snapshot", snapshotId: "s3", notes: "Drop-chorus grind." },
    ],
    programming: [
      "SNAPSHOT MODE. PAGE until LINE / UNISON / HEAVY. XL adds LEAD on visual switch 1 (snapshot 4).",
      "Path: 3-Band Comp → ZeroAmp Bass DI (SansAmp, Mix 4.2) → Das Benzin Lead (Diezel) → 8x10 SVT → 70s Chorus → Hall.",
      "Keep the SansAmp blended. This is not a wall of fuzz.",
      "Chorus after the cab so it doesn't get fizzy inside the distortion.",
    ],
    tips: [
      "If you only have an HX Stomp, use Snap 1–3 and put chorus on an external FS4.",
      "A real Wal isn't required — boost ~800 Hz on Simple EQ if your bass is dark.",
    ],
  },
  {
    id: "featured-paranoid",
    createdAt: 0,
    source: "featured",
    song: "Paranoid Android",
    artist: "Radiohead",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Paranoid",
    tempo: 82,
    summary:
      "OK Computer (1997). Three songs in one: a nasal Tele into a clean Fender Eighty-Five, a Marshall Shredmaster for the heavy section, and a Space Echo + Small Stone for the 6/8 weep. Snapshots are mandatory. Helix has no Shredmaster — Knuckle Dragon (Suhr Riot) is a high-gain pedal into a clean amp, which is how Jonny used it. No gate.",
    originalGear: [
      { role: "Guitar", name: "Fender Telecaster Plus (Lace Sensor)", notes: "Jonny's nasal, mid-forward dry core." },
      { role: "Pedal", name: "Marshall Shredmaster", notes: "The heavy-section dirt, into a clean amp. Not an amp channel." },
      { role: "Pedal", name: "EHX Small Stone + Roland RE-201 Space Echo", notes: "Phaser and tape echo for the 6/8 section. Not all on at once." },
      { role: "Amp", name: "Fender Eighty-Five (solid state)", notes: "Clean platform. Modeled here as a US Deluxe — a JC-120 would chorus the whole patch." },
    ],
    recommendedGear: [
      { item: "Tele or Strat, bridge for the heavy section", why: "The nasal Tele mid is the clean arpeggio." },
      { item: "Volume knob", why: "Jonny rides it. Map EXP to Volume Pedal if you don't want to touch the guitar." },
    ],
    blocks: [
      block("b1", "pebble-phaser", { Rate: 2.6, Depth: 4.4, Mix: 4.2, Tone: 5.4 }, 0, false),
      block("b2", "knuckle-dragon", { Drive: 6.4, Bass: 5.6, Mid: 4.2, Treble: 5.4, Output: 5.6, Mix: 10 }, 1, false),
      block("b3", "us-deluxe-nrm", { Drive: 3.2, Bass: 5.0, Mid: 5.8, Treble: 6.2, Presence: 4.8, Master: 5.6, "Ch Vol": 6.0, Sag: 3.2 }, 2),
      block("b4", "1x12-us-deluxe", { Mic: 0, Distance: 2.4, "Low Cut": 2.2, "High Cut": 7.8, "Early Refl": 3.0 }, 3),
      block("b5", "cosmos-echo", { Time: 3.4, Feedback: 3.2, Mix: 2.4, Mod: 2.0, Scale: 5 }, 4),
      block("b6", "hall", { Decay: 2.8, Predelay: 1.6, Mix: 1.8, "Low Cut": 3.2, "High Cut": 7.0 }, 5),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Arp",
        color: "#c5c9c2",
        enabledBlocks: ["b3", "b4", "b5", "b6"],
        notes: "Clean Tele, short Space Echo. Phaser and Shredmaster off.",
        paramOverrides: {
          b5: { Mix: 2.4, Feedback: 3.0 },
          b3: { Drive: 3.2, "Ch Vol": 6.0 },
        },
      },
      {
        id: "s2",
        name: "Fuzz",
        color: "#e24a3a",
        enabledBlocks: ["b2", "b3", "b4", "b6"],
        notes: "Shredmaster on, delay off so it doesn't smear the chugs.",
        paramOverrides: {
          b3: { Drive: 3.0, "Ch Vol": 5.8 },
        },
      },
      {
        id: "s3",
        name: "Weep",
        color: "#22e07a",
        enabledBlocks: ["b1", "b3", "b4", "b5", "b6"],
        notes: "Small Stone + longer Space Echo for the 6/8 section.",
        paramOverrides: {
          b5: { Mix: 4.0, Feedback: 4.0 },
          b3: { Drive: 3.4, "Ch Vol": 6.2 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "ARP", color: "#c5c9c2", action: "snapshot", snapshotId: "s1", notes: "Opening arpeggio." },
      { index: 2, label: "FUZZ", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "Heavy section." },
      { index: 3, label: "WEEP", color: "#22e07a", action: "snapshot", snapshotId: "s3", notes: "6/8 breakdown / solo." },
    ],
    programming: [
      "Path: Pebble Phaser → Knuckle Dragon → US Deluxe Nrm → 1x12 US Deluxe → Cosmos Echo → Hall.",
      "Snapshots turn fuzz/phaser/delay on and off AND recall delay mix. Don't try to stomp them individually on a 3-switch unit.",
      "Pebble Phaser is the Small Stone. Knuckle Dragon stands in for the Shredmaster (high-gain pedal into a clean amp).",
      "Cosmos Echo Mix 2.4 in Snap 1, off in Snap 2, Mix 4.0 in Snap 3.",
      "In Snapshot edit, check that delay mix and amp Channel Volume are snapshot-controlled.",
    ],
    tips: [
      "The heavy section is a different guitar energy — pick near the bridge and don't be polite.",
      "If DSP complains, drop Hall. The Space Echo is non-negotiable for the weep section.",
    ],
  },
  {
    id: "featured-come-as-you-are",
    createdAt: 0,
    source: "featured",
    song: "Come As You Are",
    artist: "Nirvana",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Come As You Are",
    tempo: 120,
    summary:
      "Nevermind (1991). This song IS the Small Clone — chorus stays on the whole way. DS-1 for the louder sections. Verse is chorus + quieter amp; chorus/solo slam the Mesa. No gate.",
    originalGear: [
      { role: "Guitar", name: "Fender Jaguar / Mustang", notes: "Single coil, slightly dark." },
      { role: "Pedal", name: "EHX Small Clone", notes: "Always on. The watery line is the riff." },
      { role: "Pedal", name: "BOSS DS-1", notes: "On for the louder hits. Stupor OD stand-in." },
      { role: "Amp", name: "Mesa Studio Pre / Fender Bassman", notes: "Same Nevermind rack as Teen Spirit." },
    ],
    recommendedGear: [
      { item: "Jaguar / Mustang / Strat", why: "The riff is a single-coil line, not a Les Paul." },
    ],
    blocks: [
      block("b1", "stupor-od", { Drive: 6.4, Bass: 5.0, Mid: 6.2, Treble: 5.4, Output: 5.8 }, 0, false),
      block("b2", "70s-chorus", { Rate: 3.2, Depth: 7.4, Mix: 6.2, Tone: 5.2 }, 1),
      block("b3", "cali-iv-rhythm-2", { Drive: 3.6, Bass: 5.0, Mid: 6.0, Treble: 5.6, Presence: 4.4, Master: 5.4, "Ch Vol": 5.6, Sag: 4.0 }, 2),
      block("b4", "4x12-cali-v30", { Mic: 0, Distance: 2.2, "Low Cut": 2.2, "High Cut": 7.2, "Early Refl": 2.6 }, 3),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Verse",
        color: "#2ec8ff",
        enabledBlocks: ["b2", "b3", "b4"],
        notes: "DS-1 off. Small Clone is the riff. Amp almost clean.",
        paramOverrides: {
          b3: { Drive: 3.2, "Ch Vol": 5.4 },
        },
      },
      {
        id: "s2",
        name: "Chorus",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3", "b4"],
        notes: "DS-1 on, clone still on.",
        paramOverrides: {
          b3: { Drive: 5.4, "Ch Vol": 6.4 },
        },
      },
      {
        id: "s3",
        name: "Solo",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3", "b4"],
        notes: "A little more Drive.",
        paramOverrides: {
          b3: { Drive: 6.0, "Ch Vol": 6.8, Presence: 5.2 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "VERSE", color: "#2ec8ff", action: "snapshot", snapshotId: "s1", notes: "Clone only." },
      { index: 2, label: "CHORUS", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "DS-1 in." },
      { index: 3, label: "SOLO", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Solo bump." },
    ],
    programming: [
      "Snapshot mode. Path: Stupor OD (off in verse) → 70s Chorus (always on) → Cali IV Rhythm 2 → 4x12 Cali V30.",
      "70s Chorus Rate 3.2 Depth 7.4 Mix 6.2. Depth switch ON. Do not bypass it — the song disappears.",
    ],
    tips: [
      "Play the verse line behind the beat. The chorus pedal is doing half the work.",
    ],
  },
  {
    id: "featured-killing-name",
    createdAt: 0,
    source: "featured",
    song: "Killing in the Name",
    artist: "Rage Against the Machine",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Killing Name",
    tempo: 84,
    summary:
      "Rage Against the Machine (1992). Tom Morello's verse is a Cry Baby into a relatively tight Marshall; the chorus is the same amp wide open, wah off. Snapshots: wah verse / open chorus / solo (wah parked + extra Drive). No gate — the groove has to breathe.",
    originalGear: [
      { role: "Guitar", name: "Fender Telecaster (custom)", notes: "Often the 'Arm the Homeless' Tele. Bridge pickup." },
      { role: "Pedal", name: "Dunlop Cry Baby", notes: "The verse riff is a wah part. EXP 1." },
      { role: "Amp", name: "Marshall JCM-800 / 50-watt", notes: "Crunch, not a Recto. Mid-forward." },
    ],
    recommendedGear: [
      { item: "Tele or other bright humbucker/single", why: "The riff needs attack. A dark LP will get swallowed." },
      { item: "Expression pedal", why: "Verse is unplayable as a parked wah." },
    ],
    blocks: [
      block("b1", "uk-wah-846", { Position: 4.0, Mix: 10, "Dc Bias": 5, Level: 5 }, 0, false),
      block("b2", "scream-808", { Drive: 1.8, Bass: 4.6, Mid: 6.4, Treble: 5.2, Output: 6.8 }, 1),
      block("b3", "brit-2204", { Drive: 5.4, Bass: 4.8, Mid: 6.6, Treble: 5.6, Presence: 5.0, Master: 5.6, "Ch Vol": 6.0, Sag: 4.0 }, 2),
      block("b4", "4x12-greenback-25", { Mic: 0, Distance: 2.0, "Low Cut": 2.4, "High Cut": 7.2, "Early Refl": 2.4 }, 3),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Verse",
        color: "#e050f0",
        enabledBlocks: ["b1", "b2", "b3", "b4"],
        notes: "Wah on. Ride EXP 1 with the riff.",
        paramOverrides: {
          b3: { Drive: 4.6, "Ch Vol": 5.6 },
        },
      },
      {
        id: "s2",
        name: "Chorus",
        color: "#e24a3a",
        enabledBlocks: ["b2", "b3", "b4"],
        notes: "Wah off, Marshall open. Those 'now you do what they told ya' hits.",
        paramOverrides: {
          b3: { Drive: 6.2, "Ch Vol": 6.6 },
        },
      },
      {
        id: "s3",
        name: "Solo",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3", "b4"],
        notes: "Wah back for the toggle-style solo. Park or ride it.",
        paramOverrides: {
          b3: { Drive: 6.4, "Ch Vol": 7.0, Presence: 5.8 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "VERSE", color: "#e050f0", action: "snapshot", snapshotId: "s1", notes: "Wah riff." },
      { index: 2, label: "CHORUS", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "Open Marshall." },
      { index: 3, label: "SOLO", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Wah solo." },
    ],
    programming: [
      "Snapshot mode. Path: UK Wah 846 → Scream 808 → Brit 2204 → 4x12 Greenback 25.",
      "EXP 1 = Wah Position. Verse snapshot has wah enabled.",
    ],
    tips: [
      "The verse only works if you play the wah. A parked wah is a different song.",
    ],
  },
];
