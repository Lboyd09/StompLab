import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { overlayUserGear, gearNamesMatch } from "./preset-schema.ts";
import type { Preset, UserGear } from "../data/types.ts";

function basePreset(): Preset {
  return {
    id: "t1",
    createdAt: 1,
    source: "song",
    song: "Enter Sandman",
    artist: "Metallica",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Sandman",
    tempo: 123,
    summary: "test",
    originalGear: [
      { role: "Guitar", name: "ESP Explorer", notes: "E standard" },
      { role: "Amp", name: "Mesa Dual Rectifier", notes: "modern" },
    ],
    recommendedGear: [{ item: "Bridge humbucker", why: "icepick" }],
    blocks: [],
    snapshots: [],
    footswitches: [],
    programming: [],
    tips: [],
  };
}

describe("overlayUserGear", () => {
  it("maps every locker guitar, amp, and pedal — not just the first of each", () => {
    const gear: UserGear[] = [
      { id: "1", kind: "guitar", name: "ESP Explorer", notes: "EMG 81" },
      { id: "2", kind: "guitar", name: "Fender Stratocaster", notes: "" },
      { id: "3", kind: "amp", name: "Mesa Dual Rectifier", notes: "" },
      { id: "4", kind: "amp", name: "Marshall JCM800", notes: "" },
      { id: "5", kind: "pedal", name: "BOSS NS-2", notes: "" },
      { id: "6", kind: "pedal", name: "Ibanez TS9", notes: "" },
    ];
    const next = overlayUserGear(basePreset(), gear);
    const items = next.recommendedGear.map((r) => r.item);
    assert.ok(items.includes("ESP Explorer"));
    assert.ok(items.includes("Fender Stratocaster"));
    assert.ok(items.includes("Mesa Dual Rectifier"));
    assert.ok(items.includes("Marshall JCM800"));
    assert.ok(items.includes("BOSS NS-2"));
    assert.ok(items.includes("Ibanez TS9"));
    assert.ok(next.recommendedGear.some((r) => r.fromLocker && r.item === "ESP Explorer"));
  });
  it("matches locker names to the record rig", () => {
    assert.equal(gearNamesMatch("Mesa Dual Rectifier", "Mesa/Boogie Dual Rectifier"), true);
    assert.equal(gearNamesMatch("Fender Stratocaster", "Gibson Les Paul"), false);
  });
});
