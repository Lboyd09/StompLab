import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Preset } from "@/data/types.ts";
import { finishTone } from "./tone-finish.ts";
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
          { id: "s1", name: "Intro", color: "#fff", enabledBlocks: ["a", "c"], notes: "" },
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
