import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STOMP_DEVICES } from "../data/categories.ts";
import { FEATURED } from "../data/featured.ts";
import { hxModel, SYNC_NOTES, syncNoteBeats } from "../data/hx-catalog.ts";
import { podGoIdFor, podGoModel } from "../data/podgo-catalog.ts";
import type { Preset, StompBlock } from "../data/types.ts";
import { buildHlx, canExportHlx } from "./hlx.ts";
import { blockNativeParams, resolveParamKeys } from "./hx-params.ts";
import { formatNative, nativeToUi, uiToNative } from "./hx-units.ts";
import { validatePreset } from "./hx-validate.ts";
import { pgpLayout } from "./pgp.ts";
import { withStompModel } from "./preset-utils.ts";

type Dsp = Record<string, Record<string, unknown>>;
const toneOf = (hlx: Record<string, unknown>) => (hlx.data as { tone: Record<string, any> }).tone;

function block(id: string, modelId: string, params: Record<string, number>, position: number, enabled = true): StompBlock {
  return { id, modelId, enabled, path: "main", position, params };
}

function preset(stompModel: Preset["stompModel"], blocks: StompBlock[], extra: Partial<Preset> = {}): Preset {
  const base = FEATURED.find((p) => p.id === "featured-teen-spirit")!;
  return {
    ...base,
    id: "t",
    stompModel,
    blocks,
    footswitches: [{ index: 1, label: "SNAP 1", color: "#22e07a", action: "snapshot", notes: "" }],
    snapshots: [
      { id: "s1", name: "Clean", color: "#22e07a", enabledBlocks: blocks.map((b) => b.id), notes: "" },
      { id: "s2", name: "Lead", color: "#e24a3a", enabledBlocks: blocks.map((b) => b.id), notes: "" },
    ],
    ...extra,
  } as Preset;
}

describe("every featured rig, every unit, both footswitch modes", () => {
  it("passes the real-file validator in strict mode", () => {
    for (const src of FEATURED) {
      for (const d of STOMP_DEVICES) {
        if (!canExportHlx(d.id)) continue;
        for (const fsMode of ["snapshot", "stomp"] as const) {
          const hlx = buildHlx(withStompModel(src, d.id), { fsMode });
          assert.deepEqual(validatePreset(hlx, { strict: true }), [], `${src.id} ${d.id} ${fsMode}`);
        }
      }
    }
  });
});

describe("unit profiles from real exports", () => {
  it("uses each unit's device id, I/O blocks and snapshot controller", () => {
    const expect: Record<string, [number, string, number]> = {
      "hx-stomp": [2162694, "HelixStomp_AppDSPFlowInput", 9],
      "hx-stomp-xl": [2162699, "HelixStomp_AppDSPFlowInput", 12],
      "helix-floor": [2162689, "HD2_AppDSPFlow1Input", 19],
      "helix-lt": [2162692, "HD2_AppDSPFlow1Input", 19],
      "hx-effects": [2162693, "HelixFx_AppDSPFlowInput", 10],
    };
    for (const [unit, [device, input, ctl]] of Object.entries(expect)) {
      const p = preset(unit as Preset["stompModel"], [block("b1", "scream-808", { Drive: 3, Output: 6 }, 0)]);
      p.snapshots[1].paramOverrides = { b1: { Drive: 6 } };
      const hlx = buildHlx(p);
      assert.equal((hlx.data as { device: number }).device, device, unit);
      const tone = toneOf(hlx);
      assert.equal(tone.dsp0.inputA["@model"], input, unit);
      assert.equal(tone.controller.dsp0.block0.Gain["@controller"], ctl, unit);
      assert.equal(tone.snapshot1.controllers.dsp0.block0.Gain["@value"], 0.6, unit);
    }
  });
});

describe("tempo sync", () => {
  it("treats the old Scale 5 as the programmed dotted eighth", () => {
    const native = blockNativeParams(block("d", "simple-delay", { Time: 4.2, Feedback: 3, Mix: 2.2, Scale: 5 }, 0));
    assert.equal(native.TempoSync1, true);
    assert.equal(native.SyncSelect1, 8);
    assert.equal(native.Scale, hxModel("HD2_DelaySimpleDelay")!.byKey.Scale.def);
  });

  it("writes an explicit note value and leaves free-running delays alone", () => {
    assert.equal(blockNativeParams(block("d", "simple-delay", { Note: 6 }, 0)).SyncSelect1, 6);
    assert.equal(blockNativeParams(block("d", "simple-delay", { Time: 3 }, 0)).TempoSync1, false);
  });

  it("knows the note lengths", () => {
    assert.equal(SYNC_NOTES[7], "1/8 dotted");
    assert.equal(syncNoteBeats(8), 0.75);
    assert.equal(syncNoteBeats(6), 1);
    assert.equal(syncNoteBeats(1), 4);
  });
});

describe("knobs reach the real HX keys", () => {
  it("finds the gain on amps whose drive knob has its own name", () => {
    assert.deepEqual(resolveParamKeys("fullerton-nrm", "Drive"), ["DriveNorm"]);
    assert.deepEqual(resolveParamKeys("fullerton-brt", "Drive"), ["DriveBright"]);
    assert.deepEqual(resolveParamKeys("pv-vitriol-lead", "Drive"), ["PreGain"]);
    assert.deepEqual(resolveParamKeys("scream-808", "Drive"), ["Gain"]);
    assert.deepEqual(resolveParamKeys("scream-808", "Treble"), ["Tone"]);
  });

  it("leaves an unset knob at HX Edit's factory default, not 0.5", () => {
    const native = blockNativeParams(block("r", "plateaux", { Mix: 3 }, 0));
    const m = hxModel("HD2_ReverbPlateaux")!;
    for (const p of m.params) {
      if (p.key === "Mix" || p.key === "PitchMix") continue;
      assert.deepEqual(native[p.key], p.def, p.key);
    }
    // Plateaux's factory shimmer stays off unless a preset asks for it.
    assert.equal(native.PitchMix, 0);
  });

  it("keeps a bass cab's low end", () => {
    const native = blockNativeParams(block("c", "8x10-ampeg-svt", { "Low Cut": 2 }, 0));
    assert.ok(Number(native.LowCut) <= 45, `LowCut ${native.LowCut} Hz`);
  });

  it("puts the volume pedal on EXP 2 next to a wah, and EXP 1 on a one-pedal Stomp", () => {
    const withWah = buildHlx(preset("hx-stomp", [block("w", "chrome", {}, 0), block("v", "volume-pedal", {}, 1)]));
    assert.equal(toneOf(withWah).controller.dsp0.block0.Pedal["@controller"], 1);
    assert.equal(toneOf(withWah).controller.dsp0.block1.Pedal["@controller"], 2);
    const alone = buildHlx(preset("hx-stomp", [block("v", "volume-pedal", {}, 0)]));
    assert.equal(toneOf(alone).controller.dsp0.block0.Pedal["@controller"], 1);
  });

  it("counts amp + cab as one block and keeps the 8th effect", () => {
    const blocks = [
      block("g", "noise-gate", {}, 0),
      block("d", "scream-808", {}, 1),
      block("a", "brit-plexi-brt", {}, 2),
      block("c", "4x12-greenback-25", {}, 3),
      block("e", "simple-eq", {}, 4),
      block("m", "chorus", {}, 5),
      block("x", "simple-delay", {}, 6),
      block("y", "transistor-tape", {}, 7),
      block("r", "plateaux", {}, 8),
    ];
    const dsp = toneOf(buildHlx(preset("hx-stomp", blocks))).dsp0 as Dsp;
    const models = Object.keys(dsp).filter((k) => /^block\d+$/.test(k)).map((k) => dsp[k]["@model"]);
    assert.equal(models.length, 8);
    assert.ok(models.includes("HD2_ReverbPlateaux"));
    assert.equal(dsp.cab0["@model"], "HD2_Cab4x12Greenback25");
  });

  it("keeps stomp assignments in snapshot mode and adds the Floor toe switch for the wah", () => {
    const p = preset("helix-floor", [block("w", "chrome", {}, 0), block("d", "scream-808", {}, 1)]);
    p.footswitches.push({ index: 2, label: "TS", color: "#e24a3a", action: "bypass", targetBlockId: "d", notes: "" });
    const fs = toneOf(buildHlx(p, { fsMode: "snapshot" })).footswitch.dsp0;
    assert.equal(fs.block1["@fs_index"], 2);
    assert.equal(fs.block0["@fs_index"], 13);
  });
});

describe("POD Go", () => {
  it("lays out the unit's own six built-ins plus four free blocks", () => {
    const go = withStompModel(FEATURED.find((p) => p.id === "featured-sandman")!, "pod-go");
    const { slots, dropped } = pgpLayout(go);
    assert.deepEqual(slots.map((s) => s.role).filter((r) => r !== "fx"), ["wah", "vol", "fxloop", "amp", "cab", "eq"]);
    assert.ok(slots.filter((s) => s.role === "fx").length <= 4);
    assert.equal(dropped.filter((b) => b.modelId === "simple-delay").length, 0, "Sandman keeps its lead delay");
    for (const s of slots) assert.ok(podGoModel(s.id), s.id);
  });

  it("maps Helix ids to POD Go's mono/stereo ids and stands in for missing models", () => {
    assert.equal(podGoIdFor("HD2_DistScream808", "pre"), "HD2_DistScream808Mono");
    assert.equal(podGoIdFor("HD2_DelayVintageDigitalV2", "post"), "HD2_DelayVintageDigitalStereoV2");
    assert.equal(podGoIdFor("HD2_DelayCosmosEcho", "post"), "HD2_DelayTransistorTapeStereo");
  });
});

describe("unit conversion", () => {
  it("round-trips every float knob on the demos", () => {
    for (const id of ["HD2_ReverbPlateaux", "HD2_DelaySimpleDelay", "HD2_CaliQ", "HD2_Cab4x12Greenback25", "HD2_CompressorDeluxeComp"]) {
      for (const p of hxModel(id)!.params) {
        if (p.type !== "f") continue;
        for (const ui of [0, 2.5, 5, 7.5, 10]) {
          const back = nativeToUi(p, uiToNative(p, ui));
          assert.ok(Math.abs(back - ui) <= 0.15, `${id}.${p.key} ui ${ui} → ${back}`);
        }
      }
    }
  });

  it("shows HX Edit's units", () => {
    const m = hxModel("HD2_DelaySimpleDelay")!;
    assert.equal(formatNative(m.byKey.SyncSelect1, 8), "1/8 dotted");
    assert.equal(formatNative(m.byKey.Level, 0), "0 dB");
    assert.equal(formatNative(m.byKey.Time, 0.42), "420 ms");
  });
});
