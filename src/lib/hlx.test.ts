import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODELS } from "../data/catalog.ts";
import { FEATURED } from "../data/featured.ts";
import { HELIX_IDS } from "../data/helix-ids.ts";
import { buildHlx } from "./hlx.ts";
import { canDownloadPreset, featuredBaseId, resolveNamedPreset, visualToHardwareFs, withStompModel } from "./preset-utils.ts";

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
    const snap0 = tone.snapshot0 as { "@name": string; blocks: { dsp0: Record<string, boolean> } };
    const snap1 = tone.snapshot1 as { "@name": string; blocks: { dsp0: Record<string, boolean> } };
    const snap2 = tone.snapshot2 as { "@name": string; "@pedalstate": number; blocks: { dsp0: Record<string, boolean> } };
    assert.equal(snap0["@name"], "INTRO");
    assert.equal(snap0.blocks.dsp0.block0, false);
    assert.equal(snap0.blocks.dsp0.block1, true);
    assert.equal(snap1["@name"], "VERSE");
    assert.equal(snap1.blocks.dsp0.block0, true);
    assert.equal(snap1.blocks.dsp0.block1, false);
    assert.equal(snap2["@name"], "CHORUS");
    assert.equal(snap2.blocks.dsp0.block1, false);
    assert.equal(snap2["@pedalstate"], 0);
  });

  it("uses snapshot mode globally and 1-based join position", () => {
    const global = tone.global as { "@pedalstate": number };
    assert.equal(global["@pedalstate"], 2);
    assert.equal(dsp0.join["@position"], 4);
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

describe("visual FS map", () => {
  it("leaves Stomp 1–3 alone and remaps XL top row to hardware 4–6", () => {
    assert.equal(visualToHardwareFs(1, false), 1);
    assert.equal(visualToHardwareFs(3, false), 3);
    assert.equal(visualToHardwareFs(1, true), 4);
    assert.equal(visualToHardwareFs(2, true), 5);
    assert.equal(visualToHardwareFs(3, true), 6);
    assert.equal(visualToHardwareFs(4, true), 1);
    assert.equal(visualToHardwareFs(5, true), 2);
    assert.equal(visualToHardwareFs(6, true), 3);
    assert.equal(visualToHardwareFs(7, true), 7);
    assert.equal(visualToHardwareFs(8, true), 8);
  });

  it("never 404s an XL featured slug", () => {
    assert.equal(featuredBaseId("featured-sandman-hx-stomp-xl"), "featured-sandman");
    assert.equal(featuredBaseId("featured-sandman-hx-stomp"), "featured-sandman");
    const xl = resolveNamedPreset("featured-sandman-hx-stomp-xl", "hx-stomp-xl", []);
    assert.ok(xl);
    assert.equal(xl?.stompModel, "hx-stomp-xl");
    assert.equal(xl?.id, "featured-sandman-hx-stomp-xl");
    const stomp = resolveNamedPreset("featured-sandman-hx-stomp-xl", "hx-stomp", []);
    assert.equal(stomp?.stompModel, "hx-stomp");
    assert.equal(stomp?.id, "featured-sandman-hx-stomp");
  });

  it("keeps featured snapshots on replica 1–3 (top). File maps those to hardware FS4–6 (XL far row)", () => {
    const xl = withStompModel(featured("featured-sandman"), "hx-stomp-xl");
    const snaps = xl.footswitches.filter((f) => f.action === "snapshot");
    assert.deepEqual(
      snaps.map((f) => f.index),
      [1, 2, 3],
    );
    const back = withStompModel(xl, "hx-stomp");
    assert.deepEqual(
      back.footswitches.filter((f) => f.action === "snapshot").map((f) => f.index),
      [1, 2, 3],
    );
  });

  it("puts Teen Spirit intro first and XL pre on visual 4 (bottom-left = hardware FS1)", () => {
    const src = featured("featured-teen-spirit");
    assert.equal(src.snapshots[0]?.name, "Intro");
    assert.equal(src.footswitches[0]?.action, "snapshot");
    const stomp = withStompModel(src, "hx-stomp");
    assert.equal(stomp.snapshots.length, 3);
    assert.equal(stomp.snapshots[0]?.name, "Intro");
    const xl = withStompModel(src, "hx-stomp-xl");
    assert.equal(xl.snapshots.length, 4);
    assert.equal(xl.snapshots[3]?.name, "Pre");
    const pre = xl.footswitches.find((f) => f.snapshotId === "s4");
    assert.equal(pre?.index, 4);
    const intro = xl.footswitches.find((f) => f.snapshotId === "s1");
    assert.equal(intro?.index, 1);
  });

  it("exports only factory HD2 ids for every featured rig", () => {
    for (const p of FEATURED) {
      const hlx = buildHlx(p);
      const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
      const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;
      for (const [k, block] of Object.entries(dsp0)) {
        if (!k.startsWith("block") && k !== "cab0") continue;
        const model = String(block["@model"] ?? "");
        if (!model) continue;
        assert.match(model, /^HD2_/, `${p.id} ${k} ${model}`);
        assert.equal(/Agoura_|VIC_|HX2_|CabMicIr_/.test(model), false, model);
      }
      const primary = p.footswitches.filter((f) => f.index <= 3);
      assert.ok(primary.length >= 3, p.id);
      assert.ok(
        primary.every((f) => f.action === "snapshot"),
        `${p.id} FS1–3 must be snapshots`,
      );
    }
  });

  it("writes XL snapshot 1 to hardware FS4 (far/top row)", () => {
    const xl = withStompModel(featured("featured-teen-spirit"), "hx-stomp-xl");
    const hlx = buildHlx(xl);
    const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
    const snap0 = tone.snapshot0 as { "@fs_index": number; "@name": string };
    const snap3 = tone.snapshot3 as { "@fs_index": number };
    assert.equal(snap0["@name"], "INTRO");
    assert.equal(snap0["@fs_index"], 4);
    assert.equal(snap3["@fs_index"], 1);
  });

  it("writes XL bypass assigns to the hardware index for that visual switch", () => {
    const src = featured("featured-teen-spirit");
    const xl = withStompModel(
      {
        ...src,
        footswitches: [
          { index: 1, label: "OD", color: "#e24a3a", action: "bypass", targetBlockId: "b1", notes: "" },
        ],
      },
      "hx-stomp-xl",
    );
    const hlx = buildHlx(xl, { fsMode: "stomp" });
    const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
    const fs = tone.footswitch as { dsp0: Record<string, { "@fs_index": number }> };
    assert.equal(fs.dsp0.block0["@fs_index"], 4);
    assert.equal((hlx.data as { device: number }).device, 2162699);
  });
});

describe("free vs paid download gates", () => {
  const free = { paid: false, admin: false };
  const paid = { paid: true, admin: false };
  it("lets free users download demos and custom builds, not other known rigs", () => {
    assert.equal(canDownloadPreset("featured-sandman", free), true);
    assert.equal(canDownloadPreset("featured-sandman-hx-stomp", free), true);
    assert.equal(canDownloadPreset("featured-teen-spirit-hx-stomp-xl", free), true);
    assert.equal(canDownloadPreset("featured-numb", free), true);
    assert.equal(canDownloadPreset("featured-yyz", free), false);
    assert.equal(canDownloadPreset("featured-schism-hx-stomp", free), false);
    assert.equal(canDownloadPreset("custom-abc123", free), true);
  });
  it("lets paid and admin download everything", () => {
    assert.equal(canDownloadPreset("featured-yyz", paid), true);
    assert.equal(canDownloadPreset("featured-schism", { paid: false, admin: true }), true);
  });
});
