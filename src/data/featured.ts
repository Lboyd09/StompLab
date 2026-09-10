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
      "Nevermind (1991, Sound City / Butch Vig). Kurt tracked a Mesa/Boogie Studio preamp on the CLEAN rhythm channel and used a BOSS DS-1 as the dirty channel. Intro and verses are the same tone: Small Clone, DS-1 off. The watery 'hello, hello' is DS-1 + Clone. The loud HELLO is DS-1, Clone off. Mesa 5-band graphic in. No gate. Reverb 0.",
    originalGear: [
      { role: "Guitar", name: "Early-'90s MIJ Strat with Seymour Duncan JB (bridge)", notes: "Guitar World: volume 10, standard tuning. Bridge pickup, pick near the bridge. Live he also used Mustangs/Jaguars." },
      { role: "Amp", name: "Mesa/Boogie Studio preamp + Crown Power Base 2", notes: "Rhythm channel, Volume 6, Master 5, Treble 6, Bass 3, Middle 8, Reverb 0, Rhythm Bright on. He did not switch channels — the DS-1 is the dirty channel." },
      { role: "EQ", name: "Mesa 5-band graphic (in)", notes: "80 +3, 240 −2, 750 0, 2200 +5, 6600 +3. Andy Wallace also boosted ~2.5–3 kHz on the mix." },
      { role: "Pedal", name: "BOSS DS-1", notes: "Guitar World: Distortion 7, Tone 4, Level 10. Off for intro and verses. On for pre-chorus, chorus, and solo." },
      { role: "Pedal", name: "EHX Small Clone", notes: "Rate 5, Depth switch UP. On for verses and the watery pre-chorus. Off for the loud chorus. The solo is the same chain as the watery hello — not its own snapshot." },
      { role: "Cab", name: "Marshall 1960B 4×12, Celestion G12T-75, SM57", notes: "Close, dry. Doubled L/R on the record." },
    ],
    recommendedGear: [
      { item: "Bridge humbucker or hot Strat/Jaguar", why: "The icepick is the riff. Roll guitar tone back a hair if it gets brittle." },
      { item: "Guitar volume at 10 for chorus, ~7 if you want the verse even thinner", why: "Kurt did not switch amp channels." },
    ],
    blocks: [
      block("b1", "deez-one-vintage", { Drive: 7.0, Treble: 4.0, Output: 10.0 }, 0, false),
      block("b2", "70s-chorus", { Rate: 5.0, Depth: 8.0, Mix: 6.8, Tone: 5.4 }, 1),
      block("b3", "cali-iv-rhythm-2", { Drive: 3.0, Bass: 3.0, Mid: 8.0, Treble: 6.0, Presence: 4.8, Master: 5.0, "Ch Vol": 5.5, Sag: 3.2 }, 2),
      block("b4", "4x12-1960-t75", { Mic: 0, Distance: 2.0, "Low Cut": 2.2, "High Cut": 7.2, "Early Refl": 2.4 }, 3),
      block("b5", "cali-q-graphic", { "80Hz": 6.5, "240Hz": 4.0, "750Hz": 5.0, "2200Hz": 7.5, "6600Hz": 6.5 }, 4),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Clean",
        color: "#7d9a6a",
        enabledBlocks: ["b2", "b3", "b4", "b5"],
        notes: "Intro AND verse — they are the same recorded tone. DS-1 off, Small Clone on, Mesa graphic on.",
        paramOverrides: {
          b3: { Drive: 3.0, "Ch Vol": 5.5, Presence: 4.8, Treble: 6.0 },
        },
      },
      {
        id: "s2",
        name: "Hello",
        color: "#2ec8ff",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Watery pre-chorus AND the solo — same chain. DS-1 + Small Clone.",
        paramOverrides: {
          b2: { Mix: 6.8, Depth: 8.0 },
          b3: { Drive: 3.2, "Ch Vol": 5.8, Presence: 5.0 },
        },
      },
      {
        id: "s3",
        name: "Chorus",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b3", "b4", "b5"],
        notes: "Loud HELLO. DS-1 on, Small Clone off. Play harder, guitar wide open.",
        paramOverrides: {
          b3: { Drive: 3.4, "Ch Vol": 6.4, Presence: 5.2, Treble: 6.0 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "CLEAN", color: "#7d9a6a", action: "snapshot", snapshotId: "s1", notes: "Intro + verse. Clone on, DS-1 off." },
      { index: 2, label: "HELLO", color: "#2ec8ff", action: "snapshot", snapshotId: "s2", notes: "Watery pre-chorus and the solo." },
      { index: 3, label: "CHORUS", color: "#e24a3a", action: "snapshot", snapshotId: "s3", notes: "Loud HELLO, clone off." },
    ],
    programming: [
      "SNAPSHOT MODE. After import the scribbles should say CLEAN / HELLO / CHORUS on FS1–FS3. That assignment is in the file.",
      "Path: Deez One Vintage (DS-1) → 70s Chorus (Small Clone) → Cali IV Rhythm 2 (Studio pre) → 4x12 1960 T75 → Cali Q Graphic.",
      "Clean (FS1): DS-1 OFF, Clone ON. Covers the opening riff and the verses — they are the same recorded tone.",
      "Hello (FS2): DS-1 ON (Drive 7 / Tone 4 / Level 10), Clone ON. Use this for the watery hello AND the solo.",
      "Chorus (FS3): DS-1 ON, Clone OFF. EQ stays on — kick it from the EQ switch on XL if you want the raw preamp.",
      "Download the .hlx. HX Edit: File → Import. The unit should open in Snapshot mode.",
    ],
    tips: [
      "If the opening riff is dirty, you're on Chorus — hit FS1. The intro should shimmer, not crunch.",
      "Play the loud chorus with the guitar wide open and pick near the bridge. Leave the Small Clone off.",
      "The Mesa graphic is the session EQ. Leave it on unless you want a flatter amp.",
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
      "Metallica (The Black Album, 1991, One on One / Bob Rock). James: ESP Explorer, EMG 81, Ibanez TS-9 into a Mesa Dual Rectifier (blended with a Marshall on the session), Mesa 5-band V-scoop, tight gate. Kirk's intro is a wah arpeggio into a nearly clean Recto — plug your wah in front; there is no wah block in this patch. Three tones: clean intro / rhythm chug / lead bump.",
    originalGear: [
      { role: "Guitar", name: "ESP Explorer, EMG 81", notes: "James rhythm. Bridge. Kirk's intro is the wah lick on a wah in front of the amp." },
      { role: "Pedal", name: "Ibanez TS-9 Tube Screamer", notes: "Drive low, Level high — tightens the Recto. Off for the clean intro." },
      { role: "Pedal", name: "Dunlop Cry Baby", notes: "Kirk intro only. Use your real wah in front of the unit. Turn on Helix wah in Settings if you want the modeler wah on EXP 1." },
      { role: "Amp", name: "Mesa Dual Rectifier + Marshall JCM-800 blend", notes: "Bob Rock blended a Recto and a Marshall. This patch is the Recto body. Mesa 5-band graphic = the V-scoop on the rhythm." },
      { role: "Cab", name: "Mesa / Marshall 4×12 V30, SM57", notes: "Tight, close." },
      { role: "Gate", name: "Studio noise gate", notes: "Tight palm mutes on the record. Off for the clean wah intro." },
    ],
    recommendedGear: [
      { item: "Humbucker bridge (EMG or hot passive)", why: "Single coils will be thin and noisy on this riff." },
      { item: "Your wah pedal, in front of the Stomp", why: "The intro is a wah part. We left the Helix wah out on purpose." },
    ],
    blocks: [
      block("b1", "scream-808", { Drive: 2.0, Treble: 5.5, Output: 8.0 }, 0, false),
      block("b2", "cali-rectifire", { Drive: 1.8, Bass: 5.5, Mid: 4.2, Treble: 5.4, Presence: 3.8, Master: 5.5, "Ch Vol": 5.6, Sag: 3.4 }, 1),
      block("b3", "4x12-cali-v30", { Mic: 0, Distance: 1.6, "Low Cut": 2.8, "High Cut": 6.8, "Early Refl": 2.2 }, 2),
      block("b4", "hard-gate", { Threshold: 5.8, Decay: 2.0 }, 3, false),
      block("b5", "cali-q-graphic", { "80Hz": 6.5, "240Hz": 3.5, "750Hz": 3.0, "2200Hz": 6.5, "6600Hz": 6.0 }, 4, false),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Intro",
        color: "#c5c9c2",
        enabledBlocks: ["b2", "b3"],
        notes: "CLEAN intro. TS off, gate off, Mesa graphic off, Recto Drive 1.8. Sweep your wah in front.",
        paramOverrides: {
          b2: { Drive: 1.8, "Ch Vol": 5.6, Presence: 3.8, Treble: 5.8 },
        },
      },
      {
        id: "s2",
        name: "Rhythm",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Main chug. TS on, gate on, Mesa V-scoop on, Recto Drive 4.2.",
        paramOverrides: {
          b2: { Drive: 4.2, "Ch Vol": 6.0, Presence: 4.6, Treble: 5.4 },
        },
      },
      {
        id: "s3",
        name: "Lead",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Kirk solo bump — same chain, louder, not more gain. Gate and EQ stay on.",
        paramOverrides: {
          b2: { Drive: 4.6, "Ch Vol": 6.8, Presence: 5.4, Treble: 5.6 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "INTRO", color: "#c5c9c2", action: "snapshot", snapshotId: "s1", notes: "Clean intro. Wah in front of the unit." },
      { index: 2, label: "RHYTHM", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "James chug." },
      { index: 3, label: "LEAD", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Kirk solo." },
      { index: 4, label: "GATE", color: "#f5d000", action: "bypass", targetBlockId: "b4", notes: "On/off the hard gate." },
      { index: 5, label: "EQ", color: "#c6e800", action: "bypass", targetBlockId: "b5", notes: "On/off the Mesa 5-band graphic." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: FS1–FS3 are INTRO / RHYTHM / LEAD. That assignment is in the file — you do not re-assign it on the unit.",
      "Path: Scream 808 → Cali Rectifire → 4x12 Cali V30 → Hard Gate → Cali Q Graphic. No wah block.",
      "Intro: TS OFF, gate OFF, EQ OFF, Drive 1.8. Sweep a real wah in front for Kirk's arpeggio.",
      "Rhythm: TS ON (Drive 2 / Level 8), gate ON, Mesa graphic ON (scooped V), Recto Drive 4.2 — tight, not a wall.",
      "On XL / POD Go / Helix, FS4 = GATE and FS5 = EQ. HX Stomp uses the snapshot on/off plus the Gate / EQ buttons on the page.",
    ],
    tips: [
      "If the intro isn't clean, you're on the Rhythm snapshot. Hit FS1.",
      "Palm mute harder than you think. The gate only works if your right hand is tight.",
      "Want the Helix wah instead? Settings → Wah → Use Helix wah with expression pedal, then re-open the demo.",
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
      "The Wall (1979, Super Bear / Bob Ezrin, James Guthrie). Gilmour's solos are a Ram's Head Big Muff into a Hiwatt DR-103, with a Binson Echorec in front of the amp so repeats saturate. Verses are the Hiwatt almost clean. Three tones: verse / solo 1 / solo 2. The vibrato is in his hands. No gate, no extra EQ, no wah.",
    originalGear: [
      { role: "Guitar", name: "Fender Stratocaster", notes: "Neck pickup for the first solo, bridge-leaning for the second. Tone rolled back to ~6–7." },
      { role: "Pedal", name: "Electro-Harmonix Big Muff (Ram's Head)", notes: "Sustain up, tone around 11–12 o'clock. Off for verses." },
      { role: "Delay", name: "Binson Echorec", notes: "Multi-head platter echo BEFORE the amp so repeats saturate with the muff." },
      { role: "Amp", name: "Hiwatt DR-103 + WEM/Fane 4×12", notes: "Loud clean headroom. The muff is the dirt, not the amp." },
    ],
    recommendedGear: [
      { item: "Strat, neck or neck+middle", why: "The vocal quality of the first solo is a neck pickup into a muff." },
      { item: "Roll the guitar tone to 6–7", why: "Tames muff fizz the same way Gilmour's secret sauce does." },
    ],
    blocks: [
      block("b1", "bighorn-fuzz", { Drive: 7.0, Bass: 6.2, Mid: 4.6, Treble: 4.8, Output: 5.8, Mix: 10 }, 0, false),
      block("b2", "cosmos-echo", { Time: 3.6, Feedback: 3.0, Mix: 2.6, Mod: 1.8, Scale: 5 }, 1),
      block("b3", "whowatt-100", { Drive: 2.8, Bass: 5.4, Mid: 6.2, Treble: 5.8, Presence: 5.0, Master: 6.2, "Ch Vol": 6.0, Sag: 2.8 }, 2),
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
          b3: { Drive: 2.8, "Ch Vol": 6.0 },
        },
      },
      {
        id: "s3",
        name: "Solo 2",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "More delay, a little more Hiwatt. Play more aggressively. Bridge-leaning pickup.",
        paramOverrides: {
          b2: { Mix: 3.4, Feedback: 3.6 },
          b3: { Drive: 3.4, "Ch Vol": 6.6 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "VERSE", color: "#7d9a6a", action: "snapshot", snapshotId: "s1", notes: "Clean verses / fills." },
      { index: 2, label: "SOLO1", color: "#f5d000", action: "snapshot", snapshotId: "s2", notes: "First solo." },
      { index: 3, label: "SOLO2", color: "#e24a3a", action: "snapshot", snapshotId: "s3", notes: "Second solo." },
    ],
    programming: [
      "SNAPSHOT MODE. FS1–FS3 = VERSE / SOLO1 / SOLO2. Assigned in the file.",
      "Path: Bighorn Fuzz (Ram's Head) → Cosmos Echo (Echorec) → WhoWatt 100 → 4x12 WhoWatt 100 → Plate. Delay BEFORE the amp.",
      "Cosmos Echo Mix 1.8 verse / 2.6 solo 1 / 3.4 solo 2 via snapshot parameter recall.",
      "WhoWatt Drive stays low — 2.6 / 2.8 / 3.4. The muff is the gain.",
      "Tempo 64. EXP 1 can be a Volume Pedal in front of the muff for violin swells.",
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
      "The Joshua Tree (1987, Windmill Lane / Brian Eno, Daniel Lanois). Edge: Strat into a Vox AC30, Korg SDD-3000 dotted-eighth plus a shorter analog Memory Man. The guitar stays almost clean — the delay IS the riff. Three tones: intro cascade / verse SDD / chorus both.",
    originalGear: [
      { role: "Guitar", name: "Fender Stratocaster / Explorer", notes: "Bright pickup, lots of pick attack, near the bridge. Edge scrapes a textured pick." },
      { role: "Delay", name: "Korg SDD-3000", notes: "Dotted 8th digital (~357 ms at 126 BPM). The Joshua Tree sound. Also used as a preamp boost." },
      { role: "Delay", name: "EHX Deluxe Memory Man", notes: "Shorter analog, modulation on, mix lower than the SDD. Studio also used dual 3/16 and 9/32 times." },
      { role: "Amp", name: "Vox AC-30 Top Boost (1964)", notes: "Chime, not cranked to crunch. Brilliant / Top Boost, Treble up." },
    ],
    recommendedGear: [
      { item: "Strat or other bright single coil", why: "Dark humbuckers smear the dotted-eighth pattern." },
      { item: "A pick, near the bridge", why: "The riff is all attack. Play it like a sequencer." },
    ],
    blocks: [
      block("b1", "deluxe-comp", { Threshold: 4.2, Gain: 5.2, Attack: 3.6, Release: 4.4, Mix: 5.5 }, 0),
      block("b2", "vintage-digital", { Time: 4.2, Feedback: 3.6, Mix: 4.6, Mod: 1.0, Scale: 5 }, 1),
      block("b3", "elephant-man", { Time: 2.6, Feedback: 2.4, Mix: 2.0, Mod: 4.2, Scale: 5 }, 2),
      block("b4", "essex-a30", { Drive: 3.2, Bass: 4.8, Treble: 6.6, Presence: 5.4, Master: 5.8, "Ch Vol": 6.0, Sag: 2.8 }, 3),
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
      "SNAPSHOT MODE. After import: FS1–FS3 are INTRO / VERSE / CHORUS.",
      "Path: Deluxe Comp → Vintage Digital (SDD-3000) → Elephant Man (Memory Man) → Essex A30 → 2x12 Blue Bell → Plateaux.",
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
      "Blood Sugar Sex Magik (1991, The Mansion / Rick Rubin). Frusciante tracked a '58 Strat into two Marshalls (guitar head for edge, bass head for punch) split with a DOD chorus. Give It Away's quack is a Mu-Tron III. Three tones: filter riff / dry crunch / solo bump.",
    originalGear: [
      { role: "Guitar", name: "1958 Fender Stratocaster", notes: "Worn Strat, single coils, often bridge or middle. He also DI'd some overdubs into the board." },
      { role: "Pedal", name: "Mu-Tron III", notes: "Up position. Sensitivity follows pick attack — play it like percussion." },
      { role: "Amp", name: "Marshall guitar head + Marshall bass head, split", notes: "Guitar Player 1991: two Marshalls, DOD stereo chorus as the split. Helix runs one amp — Brit Plexi Bright is the edge." },
    ],
    recommendedGear: [
      { item: "Strat bridge or middle", why: "The filter needs treble content to quack." },
      { item: "A pick, or fingers with nails", why: "Envelope filters track attack. Soft fingers = no quack." },
    ],
    blocks: [
      block("b1", "mutant-filter", { Freq: 5.6, Q: 6.4, Mix: 10, Speed: 6.8 }, 0),
      block("b2", "brit-plexi-brt", { Drive: 5.0, Bass: 4.8, Mid: 6.4, Treble: 5.8, Presence: 5.0, Master: 5.6, "Ch Vol": 6.0, Sag: 4.2 }, 1),
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
        notes: "Drive up, filter off. The record's reverse solo is a studio trick — this is the live bump.",
        paramOverrides: {
          b2: { Drive: 6.2, "Ch Vol": 6.8 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "QUACK", color: "#e050f0", action: "snapshot", snapshotId: "s1", notes: "Mu-Tron riff." },
      { index: 2, label: "CRUNCH", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "Dry Marshall." },
      { index: 3, label: "SOLO", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Drive bump." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: FS1–FS3 are QUACK / CRUNCH / SOLO.",
      "Path: Mutant Filter → Brit Plexi Brt → 4x12 Greenback 25 → Room. No gate, no compressor.",
      "Mutant Filter: Mix 10, Q 6.4. Raise Speed/sensitivity until muted 16ths quack.",
      "Brit Plexi Bright: Drive 5.0 — crunch, not a Recto. Snap 3 Drive 6.2.",
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
      "Moving Pictures (1981, Le Studio / Terry Brown). Geddy's bass is a bright Jazz Bass split between a DI and an Ampeg SVT / Hiwatt stack. Light compression so the picked 16ths stay percussive. The record is one bass tone — Riff is the patch. Lead is a small Drive/Treble bump for the busier figure, not a different amp.",
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
        name: "Lead",
        color: "#2ec8ff",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "Busier figure — Drive and Treble up, still the same SVT chain. Not a third amp.",
        paramOverrides: {
          b2: { Drive: 5.2, Treble: 7.2, "Ch Vol": 6.4 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "RIFF", color: "#c5c9c2", action: "snapshot", snapshotId: "s1", notes: "Main ostinato." },
      { index: 2, label: "LEAD", color: "#2ec8ff", action: "snapshot", snapshotId: "s2", notes: "Drive and treble bump." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: FS1–FS2 are RIFF / LEAD. There is no third snapshot — the record is one bass tone.",
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
      "Lateralus (2001, Cello / David Bottrill). Justin Chancellor is a Wal MKII into Diezel/Mesa with analog chorus on the unison lines. Period dirt is a SansAmp-style blend, not a 2010s Darkglass. Three tones on a 3-switch unit: dry line / unison chorus / heavy. XL adds Lead.",
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
        notes: "XL only. Everything on, dirt mix higher.",
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
      "SNAPSHOT MODE. After import: FS1–FS3 are LINE / UNISON / HEAVY. XL adds LEAD on snapshot 4.",
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
      "OK Computer (1997, Canned Applause / Nigel Godrich). Three songs in one: a nasal Tele into a clean Fender Eighty-Five, a Marshall Shredmaster for the heavy section, and a Space Echo + Small Stone for the 6/8 weep. Helix has no Shredmaster — KWB is the high-gain pedal into a clean amp, which is how Jonny used it. No gate.",
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
      block("b2", "kwb", { Drive: 6.4, Bass: 5.6, Treble: 5.4, Output: 5.6 }, 1, false),
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
      "SNAPSHOT MODE. After import: FS1–FS3 are ARP / FUZZ / WEEP.",
      "Path: Pebble Phaser → KWB → US Deluxe Nrm → 1x12 US Deluxe → Cosmos Echo → Hall.",
      "Snapshots turn fuzz/phaser/delay on and off AND recall delay mix. Don't try to stomp them individually on a 3-switch unit.",
      "Pebble Phaser is the Small Stone. KWB stands in for the Shredmaster (high-gain pedal into a clean amp).",
      "Cosmos Echo Mix 2.4 in Snap 1, off in Snap 2, Mix 4.0 in Snap 3.",
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
      "Nevermind (1991, Sound City / Butch Vig). This song IS the Small Clone — chorus stays on the whole way. DS-1 for the louder sections. Same Mesa Studio Pre + Marshall 1960 T75 rack as Teen Spirit, including the Mesa 5-band graphic. Two tones: verse (clone, DS-1 off) and chorus (DS-1 in). The solo is the chorus chain — not its own snapshot.",
    originalGear: [
      { role: "Guitar", name: "Fender Jaguar / Mustang", notes: "Single coil, slightly dark." },
      { role: "Pedal", name: "EHX Small Clone", notes: "Always on. The watery line is the riff." },
      { role: "Pedal", name: "BOSS DS-1", notes: "On for the louder hits. Deez One Vintage (MIJ DS-1)." },
      { role: "Amp", name: "Mesa/Boogie Studio preamp + Crown + Marshall 1960 T75", notes: "Same Nevermind rack as Teen Spirit." },
      { role: "EQ", name: "Mesa 5-band graphic (in)", notes: "Same session graphic as Teen Spirit. Milder than the icepick slam — this riff is woolier." },
    ],
    recommendedGear: [
      { item: "Jaguar / Mustang / Strat", why: "The riff is a single-coil line, not a Les Paul." },
    ],
    blocks: [
      block("b1", "deez-one-vintage", { Drive: 5.0, Treble: 5.2, Output: 5.8 }, 0, false),
      block("b2", "70s-chorus", { Rate: 3.2, Depth: 7.4, Mix: 6.2, Tone: 5.2 }, 1),
      block("b3", "cali-iv-rhythm-2", { Drive: 2.8, Bass: 5.0, Mid: 6.0, Treble: 5.6, Presence: 4.4, Master: 5.4, "Ch Vol": 5.6, Sag: 4.0 }, 2),
      block("b4", "4x12-1960-t75", { Mic: 0, Distance: 2.2, "Low Cut": 2.2, "High Cut": 7.2, "Early Refl": 2.6 }, 3),
      block("b5", "cali-q-graphic", { "80Hz": 6.0, "240Hz": 4.5, "750Hz": 5.0, "2200Hz": 6.5, "6600Hz": 5.8 }, 4),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Verse",
        color: "#2ec8ff",
        enabledBlocks: ["b2", "b3", "b4", "b5"],
        notes: "DS-1 off. Small Clone is the riff. Amp almost clean. Same recorded tone as the intro.",
        paramOverrides: {
          b3: { Drive: 2.6, "Ch Vol": 5.4 },
        },
      },
      {
        id: "s2",
        name: "Chorus",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3", "b4", "b5"],
        notes: "DS-1 on, clone still on. The solo uses this same chain — pick harder, don't switch snapshots.",
        paramOverrides: {
          b3: { Drive: 4.0, "Ch Vol": 6.2 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "VERSE", color: "#2ec8ff", action: "snapshot", snapshotId: "s1", notes: "Clone only." },
      { index: 2, label: "CHORUS", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "DS-1 in. Solo stays here." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: FS1–FS2 are VERSE / CHORUS. The solo is the chorus tone — we did not invent a third snapshot.",
      "Path: Deez One Vintage (off in verse) → 70s Chorus (always on) → Cali IV Rhythm 2 → 4x12 1960 T75 → Cali Q Graphic.",
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
      "Rage Against the Machine (1992, Sound City / GGGarth). Tom Morello's verse is a Cry Baby into a relatively tight Marshall JCM-800 2205; the chorus is the same amp wide open, wah off. The solo uses a DigiTech Whammy. No wah block in this patch — plug yours (and the Whammy) in front. No gate — the groove has to breathe.",
    originalGear: [
      { role: "Guitar", name: "Custom 'Arm the Homeless' (EMG humbuckers, kill switch)", notes: "Drop D. Bridge. The kill switch is the stutter, not a Helix block." },
      { role: "Pedal", name: "Dunlop Cry Baby", notes: "The verse riff is a wah part. Plug yours in front of the unit." },
      { role: "Pedal", name: "DigiTech Whammy", notes: "Solo. Pitch up. Also lives in front of the unit, not in this chain." },
      { role: "Amp", name: "Marshall JCM-800 2205 50-watt + Peavey 4×12 G12K-85", notes: "Crunch, not a Recto. Mid-forward." },
    ],
    recommendedGear: [
      { item: "Tele or other bright humbucker/single", why: "The riff needs attack. A dark LP will get swallowed." },
      { item: "Your wah (and Whammy if you have one), in front of the Stomp", why: "Verse is unplayable as a parked wah. We left Helix wah out on purpose." },
    ],
    blocks: [
      block("b1", "scream-808", { Drive: 1.8, Treble: 5.2, Output: 6.8 }, 0),
      block("b2", "brit-2204", { Drive: 5.4, Bass: 4.8, Mid: 6.6, Treble: 5.6, Presence: 5.0, Master: 5.6, "Ch Vol": 6.0, Sag: 4.0 }, 1),
      block("b3", "4x12-greenback-25", { Mic: 0, Distance: 2.0, "Low Cut": 2.4, "High Cut": 7.2, "Early Refl": 2.4 }, 2),
    ],
    snapshots: [
      {
        id: "s1",
        name: "Verse",
        color: "#e050f0",
        enabledBlocks: ["b1", "b2", "b3"],
        notes: "Wah in front. Ride it with the riff. Marshall a little tighter.",
        paramOverrides: {
          b2: { Drive: 4.6, "Ch Vol": 5.6 },
        },
      },
      {
        id: "s2",
        name: "Chorus",
        color: "#e24a3a",
        enabledBlocks: ["b1", "b2", "b3"],
        notes: "Wah off (lift your foot). Marshall open. Those 'now you do what they told ya' hits.",
        paramOverrides: {
          b2: { Drive: 6.2, "Ch Vol": 6.6 },
        },
      },
      {
        id: "s3",
        name: "Solo",
        color: "#f5d000",
        enabledBlocks: ["b1", "b2", "b3"],
        notes: "Whammy in front for the toggle-style solo. Louder Marshall.",
        paramOverrides: {
          b2: { Drive: 6.4, "Ch Vol": 7.0, Presence: 5.8 },
        },
      },
    ],
    footswitches: [
      { index: 1, label: "VERSE", color: "#e050f0", action: "snapshot", snapshotId: "s1", notes: "Wah riff — wah in front of the unit." },
      { index: 2, label: "CHORUS", color: "#e24a3a", action: "snapshot", snapshotId: "s2", notes: "Open Marshall." },
      { index: 3, label: "SOLO", color: "#f5d000", action: "snapshot", snapshotId: "s3", notes: "Whammy solo." },
    ],
    programming: [
      "SNAPSHOT MODE. After import: FS1–FS3 are VERSE / CHORUS / SOLO.",
      "Path: Scream 808 → Brit 2204 → 4x12 Greenback 25. No wah block.",
      "Verse snapshot has the Marshall a little tighter. Sweep a real wah in front.",
      "Want Helix wah instead? Settings → Wah → expression pedal, then re-open.",
    ],
    tips: [
      "The verse only works if you play the wah. A parked wah is a different song.",
      "Drop D. The kill switch on the guitar is the stutter — not a Helix block.",
    ],
  },
];
