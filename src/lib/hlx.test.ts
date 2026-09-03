import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODELS } from "../data/catalog.ts";
import { FEATURED } from "../data/featured.ts";
import { HELIX_IDS, UNEXPORTABLE_MODELS, helixIdFor, isHxStompModelId } from "../data/helix-ids.ts";
import { factoryParamsFor, FACTORY_HLX_PARAMS } from "../data/helix-params.ts";
import type { Preset } from "../data/types.ts";
import { buildHlx, canExportHlx, hlxFilename } from "./hlx.ts";
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
    assert.equal(HELIX_IDS["deez-one-vintage"], "HD2_DistDeezOneVintage");
    assert.equal(HELIX_IDS["deez-one-mod"], "HD2_DistDeezOneMod");
    assert.equal(HELIX_IDS["scream-808"], "HD2_DistScream808");
    assert.equal(HELIX_IDS["ampeg-scrambler"], "HD2_DistAmpegScramblerOD");
    assert.equal(HELIX_IDS["tape-echo-legacy"], "HD2_DL4TapeEchoStereo");
    assert.equal(HELIX_IDS["poly-pitch"], "L6SPB_PolyPitch");
    assert.equal(HELIX_IDS["acoustic-sim"], "L6SPB_AcousGtrSim");
    assert.equal(HELIX_IDS["german-mottled"], undefined);
    assert.equal(HELIX_IDS["knuckle-dragon"], undefined);
    assert.equal(helixIdFor("knuckle-dragon"), undefined);
    assert.equal(helixIdFor("german-mottled"), undefined);
    for (const id of Object.values(HELIX_IDS)) {
      assert.equal(/Agoura_|VIC_|HX2_|CabMicIr_/.test(id), false, id);
      assert.ok(isHxStompModelId(id), id);
    }
  });

  it("covers every exportable non-legacy non-mic catalog model", () => {
    for (const m of ALL_MODELS) {
      if (m.io === "legacy" || m.category === "mic") continue;
      if (UNEXPORTABLE_MODELS.has(m.id)) {
        assert.equal(helixIdFor(m.id), undefined, m.id);
        continue;
      }
      assert.ok(HELIX_IDS[m.id], `missing factory id for ${m.id}`);
      assert.ok(helixIdFor(m.id), m.id);
    }
  });
});

describe("buildHlx Teen Spirit", () => {
  const hlx = buildHlx(featured("featured-teen-spirit"));
  const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
  const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;

  it("emits factory Cali IV R2 + 70s Chorus + Deez One Vintage + Cali V30 cab", () => {
    assert.equal(dsp0.block2["@model"], "HD2_AmpCaliIVR2");
    assert.equal(dsp0.block2["@type"], 3);
    assert.equal(dsp0.block2["@cab"], "cab0");
    assert.equal(dsp0.block1["@model"], "HD2_Chorus70sChorus");
    assert.equal(dsp0.block0["@model"], "HD2_DistDeezOneVintage");
    assert.equal(dsp0.cab0["@model"], "HD2_Cab4X12CaliV30");
  });

  it("remaps 70s Chorus and Deez One to real param names", () => {
    assert.equal(typeof dsp0.block1.ChorusIntensity, "number");
    assert.equal(dsp0.block1.Rate, undefined);
    assert.equal(dsp0.block1.Depth, undefined);
    assert.equal(dsp0.block1.Mode, false);
    assert.equal(typeof dsp0.block0.Tone, "number");
    assert.equal(typeof dsp0.block0.Level, "number");
    assert.equal(dsp0.block0.Drive, 0.52);
    assert.equal(dsp0.block0.Treble, undefined);
    assert.equal(dsp0.block0.Output, undefined);
    assert.equal(dsp0.block0.Bass, undefined);
    assert.equal(dsp0.block0.Mid, undefined);
    assert.equal(dsp0.block0.Mix, undefined);
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

  it("exports only factory HD2/L6SPB ids for every featured rig", () => {
    for (const p of FEATURED) {
      const hlx = buildHlx(p);
      const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
      const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;
      for (const [k, block] of Object.entries(dsp0)) {
        if (!k.startsWith("block") && k !== "cab0") continue;
        const model = String(block["@model"] ?? "");
        if (!model) continue;
        assert.match(model, /^(HD2_|L6SPB_)/, `${p.id} ${k} ${model}`);
        assert.equal(/Agoura_|VIC_|HX2_|CabMicIr_/.test(model), false, model);
        assert.equal(model.includes("AmpegScrambler") && !model.endsWith("OD"), false, model);
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

  it("writes a POD Go .pgp with device 2162695 and factory HD2 models only", () => {
    const go = withStompModel(featured("featured-teen-spirit"), "pod-go");
    assert.equal(canExportHlx("pod-go"), true);
    const hlx = buildHlx(go);
    assert.equal((hlx.data as { device: number }).device, 2162695);
    const dsp = (hlx.data as { tone: { dsp0: Record<string, Record<string, unknown>> } }).tone.dsp0;
    for (const [k, b] of Object.entries(dsp)) {
      const model = String(b["@model"] ?? "");
      if (!model || model.startsWith("HD2_App") || model.startsWith("HelixStomp_")) continue;
      assert.equal(model.startsWith("L6SPB_"), false, `${k} ${model}`);
      assert.ok(FACTORY_HLX_PARAMS[model], `${k} ${model}`);
    }
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

describe("HLX import safety", () => {
  it("strips unknown knobs that would make HX Edit reject the preset", () => {
    const src = featured("featured-teen-spirit");
    const dirty = {
      ...src,
      blocks: src.blocks.map((b) =>
        b.modelId === "deez-one-vintage"
          ? { ...b, params: { ...b.params, Bass: 8, Mid: 9, Mix: 10, NotAKnob: 4 } }
          : b,
      ),
    };
    const hlx = buildHlx(dirty);
    const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
    const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;
    assert.equal(dsp0.block0["@model"], "HD2_DistDeezOneVintage");
    assert.equal(dsp0.block0.Bass, undefined);
    assert.equal(dsp0.block0.Mid, undefined);
    assert.equal(dsp0.block0.Mix, undefined);
    assert.equal(dsp0.block0.NotAKnob, undefined);
    assert.equal(typeof dsp0.block0.Drive, "number");
    assert.equal(typeof dsp0.block0.Tone, "number");
    assert.equal(typeof dsp0.block0.Level, "number");
  });

  it("keeps Sandman Recto Drive well below dime'd", () => {
    const hlx = buildHlx(featured("featured-sandman"));
    const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
    const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;
    assert.ok((dsp0.block2.Drive as number) <= 0.2);
    const snap1 = tone.snapshot1 as {
      controllers: { dsp0: Record<string, Record<string, { "@value": number }>> };
    };
    const drive = snap1.controllers.dsp0.block2?.Drive?.["@value"];
    assert.ok(typeof drive === "number" && drive <= 0.45);
  });

  it("never writes Mix on distortion or Level on delays for featured rigs", () => {
    for (const p of FEATURED) {
      const hlx = buildHlx(p);
      const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
      const dsp0 = tone.dsp0 as Record<string, Record<string, unknown>>;
      for (const [k, block] of Object.entries(dsp0)) {
        if (!k.startsWith("block")) continue;
        const model = String(block["@model"] ?? "");
        assert.match(model, /^(HD2_|L6SPB_)/, `${p.id} ${k} ${model}`);
        if (model.startsWith("HD2_Dist")) {
          assert.equal(block.Mix, undefined, `${p.id} ${k} Mix`);
        }
        if (model.startsWith("HD2_Delay")) {
          const factory = factoryParamsFor(model);
          if (block.Level !== undefined && factory) {
            assert.ok(factory.has("Level"), `${p.id} ${k} delay Level`);
          }
        }
      }
    }
  });
});

function miniPreset(modelId: string, extraParams: Record<string, number> = {}): Preset {
  const params: Record<string, number> = {
    Drive: 5,
    Treble: 5,
    Output: 6,
    Mix: 5,
    Bass: 5,
    Mid: 5,
    Master: 5,
    Presence: 5,
    "Ch Vol": 5,
    Time: 4,
    Feedback: 3,
    Decay: 3,
    Predelay: 2,
    Position: 5,
    Distance: 2,
    "Low Cut": 2,
    "High Cut": 7,
    Mic: 0,
    ...extraParams,
  };
  return {
    id: "t",
    createdAt: 0,
    source: "custom",
    song: "t",
    artist: "t",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: "Factory Check",
    tempo: 120,
    summary: "",
    originalGear: [],
    recommendedGear: [],
    blocks: [{ id: "b1", modelId, enabled: true, path: "main", position: 0, params }],
    snapshots: [],
    footswitches: [
      { index: 1, label: "A", color: "#c5c9c2", action: "snapshot", notes: "" },
      { index: 2, label: "B", color: "#c5c9c2", action: "snapshot", notes: "" },
      { index: 3, label: "C", color: "#c5c9c2", action: "snapshot", notes: "" },
    ],
    programming: [],
    tips: [],
  };
}

function dspBlocks(preset: Preset) {
  const hlx = buildHlx(preset);
  const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
  return tone.dsp0 as Record<string, Record<string, unknown>>;
}

describe("exhaustive HX Edit model export", () => {
  it("exports every catalog model with a factory @model or skips it", () => {
    const exported = new Set<string>();
    for (const m of ALL_MODELS) {
      if (m.category === "mic") continue;
      const hid = helixIdFor(m.id);
      const dsp = dspBlocks(miniPreset(m.id));
      const blocks = Object.entries(dsp).filter(([k]) => k.startsWith("block") || k.startsWith("cab"));
      if (!hid) {
        for (const [k, b] of blocks) {
          const model = String(b["@model"] ?? "");
          assert.ok(
            !model || model.startsWith("HD2_App") || model.startsWith("HelixStomp_"),
            `unexportable ${m.id} wrote ${k} ${model}`,
          );
        }
        continue;
      }
      const match = blocks.find(([, b]) => b["@model"] === hid);
      assert.ok(match, `${m.id} should export ${hid}`);
      const model = String(match[1]["@model"]);
      assert.ok(isHxStompModelId(model), `${m.id} ${model}`);
      assert.equal(/Agoura_|VIC_|HX2_|CabMicIr_/.test(model), false, model);
      assert.equal(/^HD2_DistAmpegScrambler$/.test(model), false, model);
      exported.add(model);
      const factory = factoryParamsFor(model);
      assert.ok(factory, `${m.id} exported ${model} with no factory knob list`);
      assert.ok(model in FACTORY_HLX_PARAMS, `${m.id} ${model} missing from FACTORY_HLX_PARAMS`);
      for (const key of Object.keys(match[1])) {
        if (key.startsWith("@")) continue;
        assert.ok(factory.has(key), `${m.id} wrote unknown knob ${key} on ${model}`);
      }
    }
    assert.ok(exported.has("HD2_DistDeezOneVintage"));
    assert.ok(exported.has("HD2_DistScream808"));
    assert.ok(exported.has("HD2_DistAmpegScramblerOD"));
    assert.ok(exported.has("HD2_DL4TapeEchoStereo"));
    assert.ok(exported.has("L6SPB_PolyPitch"));
    assert.equal(exported.has("HD2_DistGermanMottled"), false);
    assert.equal(exported.has("HD2_DistKnuckleDragon"), false);
    assert.equal(exported.has("HD2_PitchPolyPitch"), false);
    assert.equal(exported.has("HD2_DelayPolySustain"), false);
  });

  it("never writes an @model that is missing from FACTORY_HLX_PARAMS", () => {
    for (const id of ["featured-teen-spirit", "featured-sandman", "featured-numb"]) {
      const dsp = dspBlocks(featured(id));
      for (const [k, b] of Object.entries(dsp)) {
        const model = String(b["@model"] ?? "");
        if (!model || model.startsWith("HD2_App") || model.startsWith("HelixStomp_")) continue;
        assert.ok(FACTORY_HLX_PARAMS[model], `${id} ${k} wrote unverified ${model}`);
      }
    }
  });

  it("maps wah Position to Pedal and DS-1/RAT/AC30 to factory knobs", () => {
    const wah = dspBlocks(miniPreset("uk-wah-846")).block0;
    assert.equal(wah["@model"], "HD2_WahUKWah846");
    assert.equal(typeof wah.Pedal, "number");
    assert.equal(wah.Position, undefined);
    const rat = dspBlocks(miniPreset("vermin-dist")).block0;
    assert.equal(rat["@model"], "HD2_DistVerminDist");
    assert.equal(typeof rat.Gain, "number");
    assert.equal(typeof rat.Filter, "number");
    assert.equal(typeof rat.Level, "number");
    assert.equal(rat.Distortion, undefined);
    assert.equal(rat.Volume, undefined);
    const ac30 = dspBlocks(miniPreset("essex-a30")).block0;
    assert.equal(ac30["@model"], "HD2_AmpEssexA30");
    assert.equal(typeof ac30.Drive, "number");
    assert.equal(ac30.Mid, undefined);
    const spring = dspBlocks(miniPreset("hot-springs")).block0;
    assert.equal(spring["@model"], "HD2_ReverbHxSpring");
    assert.equal(typeof spring.Dwell, "number");
    assert.equal(spring.Decay, undefined);
    assert.equal(spring.Predelay, undefined);
    assert.equal(spring.PreDelay, undefined);
  });

  it("never emits a block for models HX Edit does not have", () => {
    for (const id of ["knuckle-dragon", "german-mottled", "glitch-delay", "poly-sustain", "shimmer"]) {
      const dsp = dspBlocks(miniPreset(id));
      for (const [k, block] of Object.entries(dsp)) {
        if (!k.startsWith("block") && !k.startsWith("cab")) continue;
        const model = String(block["@model"] ?? "");
        assert.ok(!model || model.startsWith("HD2_App") || model.startsWith("HelixStomp_"), `${id} ${k} ${model}`);
      }
    }
  });
});

describe("multi-device export", () => {
  it("writes documented Helix Floor and LT device ids", () => {
    const floor = buildHlx({ ...miniPreset("scream-808"), stompModel: "helix-floor" });
    assert.equal((floor.data as { device: number }).device, 2162689);
    const dsp = (floor.data as { tone: { dsp0: Record<string, Record<string, unknown>> } }).tone.dsp0;
    assert.equal(dsp.inputA["@model"], "HD2_AppDSPFlowInput");
    const lt = buildHlx({ ...miniPreset("scream-808"), stompModel: "helix-lt" });
    assert.equal((lt.data as { device: number }).device, 2162691);
  });

  it("strips amp and cab from HX Effects exports", () => {
    const preset = miniPreset("scream-808");
    preset.stompModel = "hx-effects";
    preset.blocks = [
      { id: "b1", modelId: "scream-808", enabled: true, path: "main", position: 0, params: { Drive: 5, Treble: 5, Output: 5 } },
      { id: "b2", modelId: "essex-a30", enabled: true, path: "main", position: 1, params: { Drive: 4, Bass: 5, Treble: 5 } },
      { id: "b3", modelId: "4x12-cali-v30", enabled: true, path: "main", position: 2, params: { Distance: 2 } },
    ];
    const hlx = buildHlx(preset);
    assert.equal((hlx.data as { device: number }).device, 2162692);
    const dsp = (hlx.data as { tone: { dsp0: Record<string, Record<string, unknown>> } }).tone.dsp0;
    const models = Object.entries(dsp)
      .filter(([k]) => k.startsWith("block") || k.startsWith("cab"))
      .map(([, b]) => String(b["@model"]));
    assert.ok(models.includes("HD2_DistScream808"));
    assert.equal(models.some((m) => m.startsWith("HD2_Amp") || m.startsWith("HD2_Cab")), false);
  });

  it("writes a POD Go .pgp, never a Helix .hlx", () => {
    assert.equal(canExportHlx("pod-go"), true);
    const preset = { ...miniPreset("scream-808"), stompModel: "pod-go" as const };
    const hlx = buildHlx(preset);
    assert.equal((hlx.data as { device: number }).device, 2162695);
    assert.equal(hlxFilename(preset).endsWith(".pgp"), true);
    assert.equal(hlxFilename(preset).endsWith(".hlx"), false);
  });

  it("writes 8 snapshot slots on Helix Floor and keeps HD2 I/O", () => {
    const src = featured("featured-teen-spirit");
    const floor = withStompModel(src, "helix-floor");
    assert.equal(floor.footswitches.some((f) => f.action === "mode"), false);
    const hlx = buildHlx(floor);
    const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
    assert.equal((hlx.data as { device: number }).device, 2162689);
    assert.ok(tone.snapshot7);
    assert.equal(tone.snapshot8, undefined);
    const dsp = tone.dsp0 as Record<string, Record<string, unknown>>;
    assert.equal(dsp.inputA["@model"], "HD2_AppDSPFlowInput");
    assert.equal(dsp.outputA["@model"], "HD2_AppDSPFlowOutput");
  });

  it("strips amp/cab when the replica is switched to HX Effects", () => {
    const fx = withStompModel(featured("featured-teen-spirit"), "hx-effects");
    assert.equal(
      fx.blocks.some((b) => {
        const cat = b.modelId.includes("cali") || b.modelId.includes("4x12") || b.modelId.includes("amp");
        return cat;
      }),
      false,
    );
    const hlx = buildHlx(fx);
    const dsp = (hlx.data as { tone: { dsp0: Record<string, Record<string, unknown>> } }).tone.dsp0;
    const models = Object.entries(dsp)
      .filter(([k]) => k.startsWith("block") || k.startsWith("cab"))
      .map(([, b]) => String(b["@model"]));
    assert.equal(models.some((m) => m.startsWith("HD2_Amp") || m.startsWith("HD2_Cab")), false);
    assert.ok(models.length >= 1);
  });
});
