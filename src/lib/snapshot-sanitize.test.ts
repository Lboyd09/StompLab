import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Preset } from "../data/types.ts";
import { DEMO_IDS, FEATURED } from "../data/featured.ts";
import { focusGuitarRole } from "./guitar-role.ts";
import { isAmpOrCab, playableIssues, sanitizeSnapshots } from "./snapshot-sanitize.ts";

function preset(partial: Partial<Preset> = {}): Preset {
  return {
    id: "t",
    createdAt: 0,
    source: "custom",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Test",
    tempo: 120,
    summary: "",
    originalGear: [],
    recommendedGear: [],
    blocks: [
      { id: "dirt", modelId: "scream-808", enabled: true, path: "main", position: 0, params: { Drive: 5, Output: 6 } },
      { id: "amp", modelId: "cali-iv-rhythm-1", enabled: true, path: "main", position: 1, params: { Drive: 4, "Ch Vol": 5 } },
      { id: "cab", modelId: "4x12-1960-t75", enabled: true, path: "main", position: 2, params: { Mic: 0 } },
    ],
    snapshots: [
      { id: "s1", name: "A", color: "#111", enabledBlocks: ["dirt"], notes: "", paramOverrides: { amp: { "Ch Vol": 0 } } },
      { id: "s2", name: "B", color: "#222", enabledBlocks: [], notes: "" },
    ],
    footswitches: [],
    programming: [],
    tips: [],
    ...partial,
  };
}

describe("sanitizeSnapshots", () => {
  it("keeps amp and cab on every snapshot and lifts mute levels", () => {
    const out = sanitizeSnapshots(preset());
    for (const snap of out.snapshots) {
      assert.ok(snap.enabledBlocks.includes("amp"), snap.name);
      assert.ok(snap.enabledBlocks.includes("cab"), snap.name);
    }
    assert.ok((out.snapshots[0].paramOverrides?.amp?.["Ch Vol"] ?? 0) >= 1.5);
  });

  it("puts the gate in front of the amp and the session EQ before the cab", () => {
    const teen = sanitizeSnapshots(FEATURED.find((p) => p.id === "featured-teen-spirit")!);
    const teenIds = teen.blocks.map((b) => b.modelId);
    assert.deepEqual(teenIds, [
      "deez-one-vintage",
      "70s-chorus",
      "cali-iv-rhythm-1",
      "cali-q-graphic",
      "4x12-1960-t75",
    ]);
    const sand = sanitizeSnapshots(FEATURED.find((p) => p.id === "featured-sandman")!);
    assert.deepEqual(
      sand.blocks.map((b) => b.modelId),
      ["scream-808", "cali-rectifire", "cali-q-graphic", "4x12-cali-v30"],
    );
    assert.equal(sand.blocks.some((b) => b.modelId === "hard-gate"), false);
  });

  it("has no blank or mismatched demo snapshot", () => {
    for (const src of FEATURED) {
      const issues = playableIssues(src);
      assert.deepEqual(issues, [], `${src.id} ${issues.map((i) => `${i.snapshot}: ${i.reason}`).join("; ")}`);
    }
  });

  it("lifts a silent custom snapshot: mute level, heel volume, hot gate, bypassed amp", () => {
    const out = sanitizeSnapshots(
      preset({
        blocks: [
          { id: "vol", modelId: "volume-pedal", enabled: true, path: "main", position: 0, params: { Level: 0 } },
          { id: "gate", modelId: "hard-gate", enabled: true, path: "main", position: 1, params: { Threshold: 9, Decay: 2 } },
          { id: "dirt", modelId: "scream-808", enabled: true, path: "main", position: 2, params: { Drive: 4, Output: 0 } },
          { id: "amp", modelId: "cali-rectifire", enabled: true, path: "main", position: 3, params: { Drive: 4, "Ch Vol": 0, Master: 0 } },
          { id: "cab", modelId: "4x12-cali-v30", enabled: true, path: "main", position: 4, params: { Mic: 0 } },
        ],
        snapshots: [
          { id: "s1", name: "Dead", color: "#111", enabledBlocks: ["vol", "gate"], notes: "", paramOverrides: { dirt: { Output: 0 } } },
          { id: "s2", name: "Lead", color: "#222", enabledBlocks: ["dirt", "amp", "cab"], notes: "" },
        ],
      }),
    );
    assert.ok((out.blocks.find((b) => b.id === "vol")?.params.Level ?? 0) >= 7);
    assert.ok((out.blocks.find((b) => b.id === "gate")?.params.Threshold ?? 10) <= 2.2);
    assert.ok((out.blocks.find((b) => b.id === "dirt")?.params.Output ?? 0) >= 3.2);
    assert.ok((out.blocks.find((b) => b.id === "amp")?.params["Ch Vol"] ?? 0) >= 3.2);
    for (const snap of out.snapshots) {
      assert.ok(snap.enabledBlocks.includes("amp"));
      assert.ok(snap.enabledBlocks.includes("cab"));
    }
    assert.deepEqual(playableIssues(out), []);
  });

  it("keeps intro when the player picks rhythm or lead, and drops the other part", () => {
    const sand = FEATURED.find((p) => p.id === "featured-sandman")!;
    const rhythm = focusGuitarRole(sand, "rhythm");
    assert.deepEqual(rhythm.snapshots.map((s) => s.name), ["Intro", "Rhythm"]);
    const lead = focusGuitarRole(sand, "lead");
    assert.deepEqual(lead.snapshots.map((s) => s.name), ["Intro", "Lead"]);
    const both = focusGuitarRole(sand, "both");
    assert.equal(both.snapshots.length, 3);
    const teen = focusGuitarRole(FEATURED.find((p) => p.id === "featured-teen-spirit")!, "rhythm");
    assert.deepEqual(teen.snapshots.map((s) => s.name), ["Clean", "Verse", "Hello"]);
  });

  it("keeps amp/cab on every demo snapshot", () => {
    for (const id of DEMO_IDS) {
      const src = FEATURED.find((p) => p.id === id);
      assert.ok(src, id);
      const out = sanitizeSnapshots(src);
      const essentials = out.blocks.filter((b) => isAmpOrCab(b.modelId)).map((b) => b.id);
      assert.ok(essentials.length, id);
      for (const snap of out.snapshots) {
        for (const eid of essentials) {
          assert.ok(snap.enabledBlocks.includes(eid), `${id} ${snap.name} missing ${eid}`);
        }
      }
    }
  });
});
