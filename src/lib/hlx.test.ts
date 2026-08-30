import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODELS } from "../data/catalog.ts";
import { FEATURED } from "../data/featured.ts";
import { HELIX_IDS } from "../data/helix-ids.ts";
import { buildHlx } from "./hlx.ts";

function featured(id: string) {
  const p = FEATURED.find((x) => x.id === id);
  assert.ok(p, id);
  return p;
}

describe("HELIX_IDS", () => {
  it("uses factory Stomp IDs, not invented or Stadium names", () => {
    assert.equal(HELIX_IDS["cali-iv-rhythm-2"], "HD2_AmpCaliIVR2");
    assert.equal(HELIX_IDS["cali-iv-rhythm-1"], "HD2_AmpCaliIVR1");
    assert.equal(HELIX_IDS["ampeg-svt-brt"], "HD2_AmpSVBeastBrt");
    assert.equal(HELIX_IDS["ampeg-svt-nrm"], "HD2_AmpSVBeastNrm");
    assert.equal(HELIX_IDS["ampeg-b-15nf"], "HD2_AmpTucknGo");
    assert.equal(HELIX_IDS["bighorn-fuzz"], "HD2_DistRamsHead");
    assert.equal(HELIX_IDS["4x12-cali-v30"], "HD2_Cab4X12CaliV30");
    assert.equal(HELIX_IDS["70s-chorus"], "HD2_Chorus70sChorus");
    assert.equal(HELIX_IDS["stupor-od"], "HD2_DistStuporOD");
    assert.equal(HELIX_IDS["scream-808"], "HD2_DistScream808");
    for (const id of Object.values(HELIX_IDS)) {
      assert.equal(/Agoura_|VIC_|HX2_|CabMicIr_/.test(id), false, id);
    }
  });

  it("covers every non-legacy non-mic catalog model", () => {
    const skip = new Set(["split-y", "split-a-b", "crossover-split", "merge"]);
    for (const m of ALL_MODELS) {
      if (m.io === "legacy" || m.category === "mic") continue;
      if (skip.has(m.id)) continue;
      assert.ok(HELIX_IDS[m.id], `missing factory id for ${m.id}`);
    }
  });
});

describe("buildHlx Teen Spirit", () => {
  const hlx = buildHlx(featured("featured-teen-spirit"));
  const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
  const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;

  it("emits factory Cali IV R2 + 70s Chorus + Stupor OD + Cali V30 cab", () => {
    assert.equal(dsp0.block2["@model"], "HD2_AmpCaliIVR2");
    assert.equal(dsp0.block2["@type"], 3);
    assert.equal(dsp0.block2["@cab"], "cab0");
    assert.equal(dsp0.block1["@model"], "HD2_Chorus70sChorus");
    assert.equal(dsp0.block0["@model"], "HD2_DistStuporOD");
    assert.equal(dsp0.cab0["@model"], "HD2_Cab4X12CaliV30");
  });

  it("remaps 70s Chorus and Stupor OD to real param names", () => {
    assert.equal(typeof dsp0.block1.ChorusIntensity, "number");
    assert.equal(dsp0.block1.Rate, undefined);
    assert.equal(dsp0.block1.Depth, undefined);
    assert.equal(dsp0.block1.Mode, false);
    assert.equal(typeof dsp0.block0.Tone, "number");
    assert.equal(typeof dsp0.block0.Level, "number");
    assert.equal(dsp0.block0.Treble, undefined);
    assert.equal(dsp0.block0.Output, undefined);
    assert.equal(dsp0.block0.Bass, undefined);
  });

  it("Pre snapshot enables Small Clone; Chorus snapshot bypasses it", () => {
    const snap1 = tone.snapshot1 as { "@name": string; blocks: { dsp0: Record<string, boolean> } };
    const snap2 = tone.snapshot2 as { "@name": string; blocks: { dsp0: Record<string, boolean> } };
    assert.equal(snap1["@name"], "PRE");
    assert.equal(snap1.blocks.dsp0.block1, true);
    assert.equal(snap2["@name"], "CHORUS");
    assert.equal(snap2.blocks.dsp0.block1, false);
    const snap0 = tone.snapshot0 as { "@name": string; "@pedalstate": number };
    assert.equal(snap0["@name"], "VERSE");
    assert.equal(snap0["@pedalstate"], 0);
  });

  it("uses snapshot mode globally and 1-based join position", () => {
    const global = tone.global as { "@pedalstate": number };
    assert.equal(global["@pedalstate"], 2);
    assert.equal(dsp0.join["@position"], 3);
    assert.equal(dsp0.block0["@no_snapshot_bypass"], false);
    assert.equal((hlx.data as { device: number }).device, 2162694);
    assert.equal(hlx.schema, "L6Preset");
  });

  it("stomp export still uses factory models and pedalstate 0", () => {
    const stomp = buildHlx(featured("featured-teen-spirit"), { fsMode: "stomp" });
    const stompTone = (stomp.data as { tone: Record<string, unknown> }).tone;
    const global = stompTone.global as { "@pedalstate": number };
    assert.equal(global["@pedalstate"], 0);
    const fs = stompTone.footswitch as { dsp0: Record<string, { "@fs_index": number }> };
    assert.equal(Object.keys(fs.dsp0).length, 0);
  });
});

describe("buildHlx Enter Sandman", () => {
  const hlx = buildHlx(featured("featured-sandman"));
  const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
  const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;

  it("starts on a clean wah intro snapshot", () => {
    const snap0 = tone.snapshot0 as {
      "@name": string;
      "@pedalstate": number;
      "@valid": boolean;
      blocks: { dsp0: Record<string, boolean> };
    };
    assert.equal(snap0["@name"], "INTRO");
    assert.equal(snap0["@valid"], true);
    assert.equal(snap0["@pedalstate"], 0);
    assert.equal(dsp0.block0["@model"], "HD2_WahUKWah846");
    assert.equal(dsp0.block1["@model"], "HD2_DistScream808");
    assert.equal(dsp0.block2["@model"], "HD2_AmpCaliRectifire");
    assert.equal(snap0.blocks.dsp0.block0, true);
    assert.equal(snap0.blocks.dsp0.block1, false);
    assert.equal(snap0.blocks.dsp0.block3, false);
  });

  it("rhythm snapshot enables TS and gate", () => {
    const snap1 = tone.snapshot1 as {
      "@name": string;
      blocks: { dsp0: Record<string, boolean> };
    };
    assert.equal(snap1["@name"], "RHYTHM");
    assert.equal(snap1.blocks.dsp0.block0, false);
    assert.equal(snap1.blocks.dsp0.block1, true);
    assert.equal(snap1.blocks.dsp0.block3, true);
  });
});
