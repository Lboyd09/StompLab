import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STOMP_DEVICES } from "@/data/categories";
import { MODEL_MAP } from "@/data/catalog";
import { FEATURED } from "@/data/featured";
import { playbackAllowed, playbackOptionsFor, routeFor } from "@/data/playback";
import type { PlaybackTarget, Preset } from "@/data/types";
import { buildHlx, canExportHlx, droppedOnExport, inaudibleExport } from "./hlx";
import { validatePreset } from "./hx-validate";
import { withStompModel } from "./preset-utils";
import { applyRouting } from "./rig-routing";
import { systemForCustomSound, systemForDevice } from "./preset-schema";
import { sanitizeSnapshots } from "./snapshot-sanitize";
import { finishTone } from "./tone-finish";

type Json = Record<string, any>;
const ROUTES: PlaybackTarget[] = ["frfr", "amp-front", "amp-4cm", "power-amp", "headphones"];

function sandman(unit: Preset["stompModel"], playbackTarget?: PlaybackTarget): Preset {
  const src = FEATURED.find((p) => p.id === "featured-sandman")!;
  return { ...withStompModel(src, unit), playbackTarget };
}

function dsp(hlx: Json): Json {
  return hlx.data.tone.dsp0;
}

function blockList(hlx: Json): Json[] {
  const d = dsp(hlx);
  return Object.keys(d)
    .filter((k) => /^block\d+$/.test(k) && d[k]["@model"])
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((k) => ({ key: k, ...d[k] }));
}

function snapStates(hlx: Json): Json[] {
  const tone = hlx.data.tone;
  return Object.keys(tone)
    .filter((k) => /^snapshot\d+$/.test(k))
    .map((k) => tone[k].blocks.dsp0);
}

describe("SL-62 playback options", () => {
  it("offers the four rigs, hides what a unit cannot do, and keeps the legacy id out of the select", () => {
    const stomp = playbackOptionsFor("hx-stomp").map((o) => o.id);
    for (const id of ["frfr", "amp-front", "amp-4cm", "power-amp"] as const) assert.ok(stomp.includes(id), id);
    assert.ok(!stomp.includes("guitar-amp"));
    const fx = playbackOptionsFor("hx-effects").map((o) => o.id);
    assert.ok(!fx.includes("power-amp"), "HX Effects has no amp model to feed a power amp");
    assert.ok(fx.includes("amp-4cm"), "HX Effects has send/return");
    assert.equal(playbackAllowed("amp-4cm", "pod-go"), true);
    assert.equal(routeFor("guitar-amp"), "full", "old presets export as they did");
    assert.equal(routeFor(undefined), "full");
  });
});

describe("SL-62 routing in the exported file", () => {
  for (const device of STOMP_DEVICES.filter((d) => canExportHlx(d.id))) {
    for (const target of ROUTES) {
      if (!playbackAllowed(target, device.id)) continue;
      it(`${device.id} ${target}: every featured preset is valid and audible`, () => {
        for (const src of FEATURED) {
          const preset = { ...withStompModel(src, device.id), playbackTarget: target };
          const hlx = buildHlx(preset) as Json;
          assert.deepEqual(validatePreset(hlx, { strict: true }), [], `${src.id}`);
          assert.deepEqual(inaudibleExport(preset), [], `${src.id}`);
        }
      });
    }
  }

  it("front of the amp: no amp, no cab, pedals keep their place (HX Stomp)", () => {
    const hlx = buildHlx(sandman("hx-stomp", "amp-front")) as Json;
    const models = blockList(hlx).map((b) => b["@model"]);
    assert.ok(!models.some((m) => /^HD2_(Amp|Cab|Preamp)/.test(m)), models.join());
    assert.ok(!Object.keys(dsp(hlx)).some((k) => /^cab\d+$/.test(k)));
    assert.ok(models.includes("HD2_DistScream808"));
    const gate = models.indexOf("HD2_GateNoiseGate");
    const delay = models.findIndex((m) => /Delay|DL4|Transistor/.test(m));
    if (gate >= 0 && delay >= 0) assert.ok(gate < delay, "gate stays in front of the time effects");
  });

  it("4-cable: one FX Loop block where the amp was, dirt before, delay after, on in every snapshot", () => {
    const hlx = buildHlx(sandman("hx-stomp", "amp-4cm")) as Json;
    const list = blockList(hlx);
    const models = list.map((b) => b["@model"]);
    const loop = models.indexOf("HD2_FXLoopMono1");
    assert.ok(loop >= 0, models.join());
    assert.equal(models.filter((m) => m === "HD2_FXLoopMono1").length, 1);
    assert.ok(!models.some((m) => /^HD2_(Amp|Cab)/.test(m)));
    assert.ok(models.indexOf("HD2_DistScream808") < loop);
    const delay = models.findIndex((m) => /Delay|DL4|Transistor/.test(m));
    if (delay >= 0) assert.ok(delay > loop, "delay sits in the amp's loop");
    // Factory send/return at unity, full mix.
    assert.equal(list[loop].Send, 0);
    assert.equal(list[loop].Return, 0);
    assert.equal(list[loop].Mix, 1);
    for (const states of snapStates(hlx)) assert.equal(states[list[loop].key], true);
  });

  it("4-cable on HX Effects puts the loop in front of the time effects", () => {
    const hlx = buildHlx(sandman("hx-effects", "amp-4cm")) as Json;
    const models = blockList(hlx).map((b) => b["@model"]);
    assert.ok(models.includes("HD2_FXLoopMono1"), models.join());
    assert.deepEqual(validatePreset(hlx, { strict: true }), []);
  });

  it("power amp: amp kept without a cab (@type 1, no @cab)", () => {
    const hlx = buildHlx(sandman("helix-floor", "power-amp")) as Json;
    const amp = blockList(hlx).find((b) => /^HD2_Amp/.test(b["@model"]));
    assert.ok(amp);
    assert.equal(amp["@type"], 1);
    assert.equal(amp["@cab"], undefined);
    assert.ok(!Object.keys(dsp(hlx)).some((k) => /^cab\d+$/.test(k)));
  });

  it("FRFR keeps amp and cab exactly as before", () => {
    const before = buildHlx(withStompModel(FEATURED.find((p) => p.id === "featured-sandman")!, "hx-stomp")) as Json;
    const after = buildHlx(sandman("hx-stomp", "frfr")) as Json;
    assert.deepEqual(blockList(after).map((b) => b["@model"]), blockList(before).map((b) => b["@model"]));
    // Sandman's graphic EQ sits between amp and cab, so the cab is its own block here.
    assert.ok(blockList(after).some((b) => /^HD2_Cab/.test(b["@model"])));
  });

  it("POD Go keeps its fixed amp/cab slots, bypassed for a real amp; 4-cable turns on its FX Loop", () => {
    const front = buildHlx(sandman("pod-go", "amp-front")) as Json;
    const ampKey = blockList(front).find((b) => /^HD2_Amp/.test(b["@model"]))!.key;
    const cabKey = blockList(front).find((b) => /^HD2_Cab/.test(b["@model"]))!.key;
    for (const s of snapStates(front)) {
      assert.equal(s[ampKey], false);
      assert.equal(s[cabKey], false);
    }
    const cm = buildHlx(sandman("pod-go", "amp-4cm")) as Json;
    const loops = blockList(cm).filter((b) => b["@model"] === "HD2_FXLoopMono1");
    assert.equal(loops.length, 1, "the fixed FX Loop slot, not a second loop in a free slot");
    for (const s of snapStates(cm)) assert.equal(s[loops[0].key], true);
    const pa = buildHlx(sandman("pod-go", "power-amp")) as Json;
    const paAmp = blockList(pa).find((b) => /^HD2_Amp/.test(b["@model"]))!.key;
    const paCab = blockList(pa).find((b) => /^HD2_Cab/.test(b["@model"]))!.key;
    for (const s of snapStates(pa)) {
      assert.equal(s[paAmp], true);
      assert.equal(s[paCab], false);
    }
  });
});

describe("applyRouting", () => {
  it("is idempotent, drops switches aimed at removed blocks, and adds one wiring tip", () => {
    const once = applyRouting(sandman("hx-stomp-xl", "amp-4cm"));
    const twice = applyRouting(once);
    assert.deepEqual(twice.blocks, once.blocks);
    assert.equal(twice.tips.length, once.tips.length);
    assert.ok(once.tips.some((t) => /4-cable/.test(t)));
    const ids = new Set(once.blocks.map((b) => b.id));
    for (const f of once.footswitches) if (f.action === "bypass" && f.targetBlockId) assert.ok(ids.has(f.targetBlockId));
    for (const s of once.snapshots) for (const id of s.enabledBlocks) assert.ok(ids.has(id));
  });

  it("a cached FRFR row served to a 4-cable player comes out routed (the playback on the request wins)", () => {
    const cached = sandman("hx-stomp", "frfr");
    const routed = sanitizeSnapshots(applyRouting(finishTone(cached), "amp-4cm"));
    assert.equal(routed.playbackTarget, "amp-4cm");
    assert.ok(!routed.blocks.some((b) => /^(amp|cab|preamp)/.test(MODEL_MAP[b.modelId]?.category ?? "")));
    assert.ok(routed.blocks.some((b) => b.modelId === "fx-loop"));
    assert.equal(droppedOnExport(routed).length, 0);
  });

  it("sanitize keeps the FX Loop on in every snapshot", () => {
    const routed = applyRouting(sandman("hx-stomp", "amp-4cm"));
    const loop = routed.blocks.find((b) => b.modelId === "fx-loop")!;
    const broken = { ...routed, snapshots: routed.snapshots.map((s) => ({ ...s, enabledBlocks: s.enabledBlocks.filter((id) => id !== loop.id) })) };
    for (const s of sanitizeSnapshots(broken).snapshots) assert.ok(s.enabledBlocks.includes(loop.id));
  });
});

describe("SL-62 prompt", () => {
  it("tells Gemini which rig, and drops the amp/cab rule for a real amp", () => {
    for (const sys of [systemForDevice("hx-stomp", "guitar", "amp-4cm"), systemForCustomSound("hx-stomp", "guitar", "amp-4cm")]) {
      assert.match(sys, /4-cable method/);
      assert.match(sys, /Never emit amp-guitar/);
    }
    assert.match(systemForDevice("pod-go", "guitar", "amp-front"), /FRONT of the player's real guitar amp/);
    assert.match(systemForDevice("helix-lt", "guitar", "power-amp"), /NO cab, mic, or ir block/);
    assert.match(systemForDevice("hx-stomp", "guitar", "frfr"), /One amp\. Bypassed amps/);
  });
});

describe("finishTone without an amp", () => {
  it("puts the gate in front of the delay, not after the tails", () => {
    const preset: Preset = {
      ...sandman("hx-stomp"),
      source: "song",
      blocks: [
        { id: "d", modelId: "scream-808", enabled: true, path: "main", position: 0, params: { Drive: 6 } },
        { id: "dl", modelId: Object.keys(MODEL_MAP).find((k) => MODEL_MAP[k].category === "delay")!, enabled: true, path: "main", position: 1, params: {} },
      ],
      snapshots: [{ id: "s1", name: "Verse", color: "red", enabledBlocks: ["d", "dl"], notes: "" }],
      footswitches: [],
    };
    const out = finishTone(preset);
    const order = [...out.blocks].sort((a, b) => a.position - b.position).map((b) => b.modelId);
    const gate = order.indexOf("noise-gate");
    assert.ok(gate >= 0, order.join());
    assert.ok(gate < order.indexOf(preset.blocks[1].modelId), order.join());
  });
});
