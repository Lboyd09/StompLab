import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Preset } from "../data/types.ts";
import { DEMO_IDS, FEATURED } from "../data/featured.ts";
import { isAmpOrCab, sanitizeSnapshots } from "./snapshot-sanitize.ts";

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
