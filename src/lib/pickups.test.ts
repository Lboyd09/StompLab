import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEATURED } from "@/data/featured";
import type { Preset, UserGear } from "@/data/types";
import { classifyPickup, pickupOffset, playerPickup } from "./pickups";
import { finishTone } from "./tone-finish";

const strat: UserGear = { id: "g1", kind: "guitar", name: "Fender Stratocaster", notes: "" };
const lesPaul: UserGear = { id: "g2", kind: "guitar", name: "Gibson Les Paul Standard", notes: "" };

function generated(recordGuitar: string): Preset {
  const base = FEATURED.find((p) => p.id === "featured-sandman")!;
  return {
    ...base,
    source: "song",
    tips: ["Tune down a half step (Eb standard), like the record."],
    originalGear: [
      { role: "Guitar", name: recordGuitar, notes: "bridge pickup" },
      { role: "Amp", name: "Marshall JCM800", notes: "" },
    ],
    blocks: [
      { id: "amp", modelId: "brit-2204", enabled: true, path: "main", position: 0, params: { Drive: 5, Treble: 6, "Ch Vol": 6 } },
      { id: "cab", modelId: "4x12-greenback-25", enabled: true, path: "main", position: 1, params: {} },
    ],
    snapshots: [
      { id: "s1", name: "Clean Intro", color: "blue", enabledBlocks: ["amp", "cab"], notes: "", paramOverrides: { amp: { Drive: 1.8 } } },
      { id: "s2", name: "Verse", color: "red", enabledBlocks: ["amp", "cab"], notes: "", paramOverrides: { amp: { Drive: 5.4 } } },
    ],
    footswitches: [],
  };
}

const amp = (p: Preset) => p.blocks.find((b) => b.id === "amp")!;

describe("SL-65 pickup classes", () => {
  it("names only the obvious ones", () => {
    assert.equal(classifyPickup("Fender Stratocaster"), "single-coil");
    assert.equal(classifyPickup("Squier Classic Vibe Telecaster"), "single-coil");
    assert.equal(classifyPickup("Fender Stratocaster HSS"), null);
    assert.equal(classifyPickup("Fender Telecaster Deluxe"), "humbucker");
    assert.equal(classifyPickup("Fender Telecaster Thinline"), null);
    assert.equal(classifyPickup("Gibson Les Paul Standard"), "humbucker");
    assert.equal(classifyPickup("Gibson Les Paul Junior"), "p90");
    assert.equal(classifyPickup("ESP LTD EC-1000 (EMG 81/60)"), "active");
    assert.equal(classifyPickup("Fender Acoustasonic Stratocaster"), null);
    assert.equal(classifyPickup("Marshall JCM800"), null);
  });

  it("offsets: single coils on a humbucker record +0.6 drive / -0.4 treble; actives -0.8 drive", () => {
    assert.deepEqual(pickupOffset("single-coil", "humbucker"), { drive: 0.6, treble: -0.4 });
    assert.deepEqual(pickupOffset("humbucker", "single-coil"), { drive: -0.6, treble: 0.4 });
    assert.equal(pickupOffset("active", "humbucker").drive, -0.8);
  });

  it("a pickup in the locker wins; guitars that disagree are skipped unless one matches the record", () => {
    const emg: UserGear = { id: "p", kind: "pickup", name: "EMG 81", notes: "" };
    assert.equal(playerPickup([strat, emg])?.kind, "active");
    assert.equal(playerPickup([strat, lesPaul]), null);
    assert.equal(playerPickup([strat, lesPaul], "humbucker")?.name, "Gibson Les Paul Standard");
  });
});

describe("SL-65 finishTone", () => {
  it("Strat on a Les Paul record: amp drive up, treble down, clean intro stays clean, one tip after the tuning tip", () => {
    const out = finishTone(generated("Gibson Les Paul Standard"), null, { userGear: [strat] });
    assert.equal(amp(out).params.Drive, 5.6);
    assert.equal(amp(out).params.Treble, 5.6);
    assert.equal(out.snapshots[1].paramOverrides?.amp?.Drive, 6);
    assert.ok((out.snapshots[0].paramOverrides?.amp?.Drive ?? 0) <= 2.2);
    assert.match(out.tips[0], /Tune down/);
    const tip = out.tips.find((t) => /single coils/.test(t));
    assert.ok(tip);
    assert.match(tip!, /Fender Stratocaster has single coils; the record used humbuckers\. Amp drive \+0\.6, treble -0\.4/);
  });

  it("leaves the preset alone when the guitars match, the record guitar is unknown, or it is a demo", () => {
    const same = finishTone(generated("Gibson Les Paul Standard"), null, { userGear: [lesPaul] });
    assert.equal(amp(same).params.Drive, 5);
    const unknown = finishTone(generated("a guitar"), null, { userGear: [strat] });
    assert.equal(amp(unknown).params.Drive, 5);
    const demo = FEATURED.find((p) => p.id === "featured-sandman")!;
    const out = finishTone(demo, null, { userGear: [strat] });
    assert.deepEqual(out.blocks, demo.blocks);
    assert.deepEqual(out.tips, demo.tips);
  });

  it("actives on a humbucker record come down but a dirty part does not turn clean", () => {
    const emg: UserGear = { id: "p", kind: "guitar", name: "Schecter Hellraiser (EMG)", notes: "" };
    const p = generated("Gibson Les Paul Standard");
    p.snapshots[1].paramOverrides = { amp: { Drive: 2.8 } };
    const out = finishTone(p, null, { userGear: [emg] });
    assert.equal(amp(out).params.Drive, 4.2);
    assert.equal(out.snapshots[1].paramOverrides?.amp?.Drive, 2.5);
  });
});
