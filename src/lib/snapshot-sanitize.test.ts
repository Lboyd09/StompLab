import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Preset } from "../data/types.ts";
import { DEMO_IDS, FEATURED } from "../data/featured.ts";
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
      ["scream-808", "hard-gate", "cali-rectifire", "cali-q-graphic", "4x12-cali-v30"],
    );
    const gate = sand.blocks.find((b) => b.modelId === "hard-gate");
    assert.ok((gate?.params.Threshold ?? 10) <= 4.2);
  });

  it("has no blank or mismatched demo snapshot", () => {
    for (const src of FEATURED) {
      const issues = playableIssues(src);
      assert.deepEqual(issues, [], `${src.id} ${issues.map((i) => `${i.snapshot}: ${i.reason}`).join("; ")}`);
    }
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
