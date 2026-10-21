import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Preset } from "@/data/types.ts";
import { finishTone, snapshotLoudness } from "./tone-finish.ts";
import { fitSnapshotName } from "./snapshot-sanitize.ts";

function preset(partial: Partial<Preset>): Preset {
  return {
    id: "p",
    createdAt: 1,
    source: "song",
    song: "Test",
    artist: "Band",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Test",
    tempo: 120,
    summary: "",
    originalGear: [{ role: "Pedal", name: "BOSS CE-2", notes: "the chorus" }],
    recommendedGear: [],
    blocks: [],
    snapshots: [],
    footswitches: [],
    programming: [],
    tips: [],
    ...partial,
  };
}

describe("finishTone", () => {
  it("sets tempo from the researched BPM and adds a gate in front of a drive", () => {
    const out = finishTone(
      preset({
        blocks: [
          { id: "d", modelId: "deez-one-vintage", enabled: true, path: "main", position: 0, params: { Drive: 5, Output: 6 } },
          { id: "a", modelId: "cali-rectifire", enabled: true, path: "main", position: 1, params: { Drive: 5, Master: 5, "Ch Vol": 5 } },
          { id: "c", modelId: "4x12-cali-v30", enabled: true, path: "main", position: 2, params: { Mic: 0 } },
          {
            id: "e",
            modelId: "simple-delay",
            enabled: true,
            path: "main",
            position: 3,
            params: { Time: 10, Feedback: 8, Mix: 6, Scale: 0 },
          },
        ],
        snapshots: [
          { id: "s1", name: "Clean Intro", color: "#fff", enabledBlocks: ["a", "c"], notes: "" },
          { id: "s2", name: "RHYTHM CRUNCH", color: "#f00", enabledBlocks: ["d", "a", "c", "e"], notes: "" },
          { id: "s3", name: "Lead", color: "#ff0", enabledBlocks: ["d", "a", "c", "e"], notes: "" },
        ],
      }),
      73,
    );
    assert.equal(out.tempo, 73);
    const gate = out.blocks.find((b) => b.modelId === "noise-gate");
    const amp = out.blocks.find((b) => b.modelId === "cali-rectifire");
    assert.ok(gate && amp && gate.position < amp.position);
    const intro = out.snapshots.find((s) => /intro/i.test(s.name));
    const lead = out.snapshots.find((s) => /lead/i.test(s.name));
    assert.equal(intro?.enabledBlocks.includes(gate!.id), false);
    assert.ok((intro?.paramOverrides?.[amp!.id]?.Drive ?? 10) <= 2.2);
    const delay = out.blocks.find((b) => b.modelId === "simple-delay");
    assert.ok(delay);
    assert.ok((delay!.params.Time ?? 10) < 9);
    assert.equal(lead?.enabledBlocks.some((id) => out.blocks.find((b) => b.id === id)?.modelId === "kinky-boost"), true);
    assert.ok((lead?.paramOverrides?.[delay!.id]?.Mix ?? 10) <= 2.5);
    assert.ok((lead?.paramOverrides?.[delay!.id]?.Feedback ?? 10) <= 3.5);
    assert.equal(out.snapshots.some((s) => s.name === "RHYTHM CRUNC"), false);
    assert.ok(out.snapshots.some((s) => s.name.length <= 12));
  });

  const chain = (): Preset["blocks"] => [
    { id: "d", modelId: "scream-808", enabled: false, path: "main" as const, position: 0, params: { Gain: 2, Level: 8 } },
    { id: "a", modelId: "brit-2204", enabled: true, path: "main" as const, position: 1, params: { Drive: 5, Master: 5, "Ch Vol": 6 } },
    { id: "c", modelId: "4x12-greenback-25", enabled: true, path: "main" as const, position: 2, params: { Mic: 0 } },
  ];
  const boostOn = (out: Preset, name: string) => {
    const snap = out.snapshots.find((s) => s.name === name)!;
    return snap.enabledBlocks.some((id) => out.blocks.find((b) => b.id === id)?.modelId === "kinky-boost");
  };

  it("boosts only the solo when snapshots are named by section", () => {
    const out = finishTone(
      preset({
        originalGear: [],
        blocks: chain(),
        snapshots: [
          { id: "s1", name: "Verse", color: "#fff", enabledBlocks: ["a", "c"], notes: "" },
          { id: "s2", name: "Chorus", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "" },
          { id: "s3", name: "Solo", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "" },
        ],
      }),
    );
    assert.equal(boostOn(out, "Verse"), false);
    assert.equal(boostOn(out, "Chorus"), false);
    assert.equal(boostOn(out, "Solo"), true);
  });

  it("does not boost every snapshot when every name says lead", () => {
    const out = finishTone(
      preset({
        originalGear: [],
        blocks: chain(),
        snapshots: [
          { id: "s1", name: "Lead Verse", color: "#fff", enabledBlocks: ["a", "c"], notes: "" },
          { id: "s2", name: "Lead Chorus", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "" },
        ],
      }),
    );
    assert.equal(out.blocks.some((b) => b.modelId === "kinky-boost"), false);
  });

  it("leaves a dirty intro dirty: only a snapshot named clean is cleaned up", () => {
    const out = finishTone(
      preset({
        originalGear: [],
        blocks: chain(),
        snapshots: [
          { id: "s1", name: "Intro", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "" },
          { id: "s2", name: "Clean Verse", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "" },
        ],
      }),
    );
    const intro = out.snapshots.find((s) => s.name === "Intro")!;
    const verse = out.snapshots.find((s) => s.name === "Clean Verse")!;
    assert.ok(intro.enabledBlocks.includes("d"));
    assert.equal(verse.enabledBlocks.includes("d"), false);
    assert.ok((verse.paramOverrides?.a?.Drive ?? 10) <= 2.2);
  });

  it("level-matches snapshots: clean comes up, a solo is a small lift, not a jump", () => {
    const out = finishTone(
      preset({
        originalGear: [],
        blocks: chain(),
        snapshots: [
          { id: "s1", name: "Clean Intro", color: "#fff", enabledBlocks: ["a", "c"], notes: "", paramOverrides: { a: { Drive: 1.5 } } },
          { id: "s2", name: "Riff", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "" },
          // The model turned the solo up 2.5 on Ch Vol on top of the boost: that is a 6+ dB jump.
          { id: "s3", name: "Solo", color: "#fff", enabledBlocks: ["d", "a", "c"], notes: "", paramOverrides: { a: { "Ch Vol": 8.5 } } },
        ],
      }),
    );
    const loud = (name: string) => snapshotLoudness(out.blocks, out.snapshots.find((s) => s.name === name)!)!;
    const riff = loud("Riff");
    // Clean is lifted toward the riff (capped move), solo sits a few dB over it.
    assert.ok((out.snapshots[0].paramOverrides?.a?.["Ch Vol"] ?? 0) > 6);
    assert.ok(Math.abs(loud("Clean Intro") - riff) < Math.abs(2 * 6 + 0.4 * 1.5 - riff));
    const lift = loud("Solo") - riff;
    assert.ok(lift > 1.5 && lift < 4.5, `solo lift ${lift}`);
    for (const s of out.snapshots) assert.ok((s.paramOverrides?.a?.["Ch Vol"] ?? 6) >= 3.2);
  });

  it("treats a quiet intro as clean by its gain, whatever it is called", () => {
    const out = finishTone(
      preset({
        originalGear: [],
        blocks: [
          { id: "a", modelId: "cali-rectifire", enabled: true, path: "main", position: 0, params: { Drive: 5.4, Master: 5, "Ch Vol": 6 } },
          { id: "c", modelId: "4x12-cali-v30", enabled: true, path: "main", position: 1, params: { Mic: 0 } },
        ],
        snapshots: [
          { id: "s1", name: "Intro", color: "#fff", enabledBlocks: ["a", "c"], notes: "", paramOverrides: { a: { Drive: 1.5 } } },
          { id: "s2", name: "Riff", color: "#fff", enabledBlocks: ["a", "c"], notes: "" },
          { id: "s3", name: "Solo", color: "#fff", enabledBlocks: ["a", "c"], notes: "" },
        ],
      }),
    );
    const gate = out.blocks.find((b) => b.modelId === "noise-gate")!;
    assert.ok(gate, "a high-gain amp gets a gate");
    const [intro, riff] = out.snapshots;
    assert.equal(intro.enabledBlocks.includes(gate.id), false, "no gate on the quiet intro");
    assert.ok(riff.enabledBlocks.includes(gate.id));
    assert.ok((riff.paramOverrides?.a?.["Ch Vol"] ?? 6) >= 6, "the riff is the reference, not pulled down to the intro");
    const loud = (i: number) => snapshotLoudness(out.blocks, out.snapshots[i])!;
    const lift = loud(2) - loud(1);
    assert.ok(lift > 1.5 && lift < 4.5, `solo lift ${lift}`);
  });

  it("does not reshape a featured demo besides tempo", () => {
    const out = finishTone(preset({ source: "featured", tempo: 100, blocks: [], snapshots: [] }), 90);
    assert.equal(out.tempo, 90);
    assert.equal(out.blocks.length, 0);
  });
});

describe("fitSnapshotName", () => {
  it("abbreviates before slicing a word", () => {
    assert.equal(fitSnapshotName("RHYTHM CRUNCH"), "Rhy Crnch");
    assert.notEqual(fitSnapshotName("RHYTHM CRUNCH"), "RHYTHM CRUNC");
    assert.ok(fitSnapshotName("RHYTHM CRUNCH").length <= 12);
  });
});

describe("delay time to note", () => {
  it("turns a time that is an eighth at the song tempo into a tempo-synced eighth", async () => {
    const { noteForTime } = await import("./tone-finish.ts");
    assert.equal(noteForTime(2.4, 124), 9);
    assert.equal(noteForTime(6.7, 67), 8);
    assert.equal(noteForTime(1.1, 120), null);
    assert.equal(noteForTime(5.5, 126), null);
  });
});

describe("keepDirtyIntro", () => {
  it("gives a 'Clean Intro' the riff's tone when the notes say the intro is driven", async () => {
    const { keepDirtyIntro } = await import("./tone-finish.ts");
    const preset = {
      snapshots: [
        { id: "s1", name: "Clean Intro", color: "", enabledBlocks: ["amp", "cab"], notes: "", paramOverrides: { amp: { Drive: 1.8 } } },
        { id: "s2", name: "Main Riff", color: "", enabledBlocks: ["gate", "amp", "cab"], notes: "", paramOverrides: { amp: { Drive: 5.5 } } },
      ],
      footswitches: [{ index: 1, label: "CLEAN INTRO", color: "", action: "snapshot", snapshotId: "s1", notes: "" }],
    } as never;
    const notes = '{"sections":[{"section":"Intro","tone":"driven Rectifier riff, full distortion"}]}';
    const out = keepDirtyIntro(preset, notes) as { snapshots: { name: string; paramOverrides: { amp: { Drive: number } } }[] };
    assert.equal(out.snapshots[0].name, "Intro");
    assert.equal(out.snapshots[0].paramOverrides.amp.Drive, 5.5);
    const clean = keepDirtyIntro(preset, '{"sections":[{"section":"Intro","tone":"clean arpeggio, neck pickup"}]}') as { snapshots: { name: string }[] };
    assert.equal(clean.snapshots[0].name, "Clean Intro");
  });
});
