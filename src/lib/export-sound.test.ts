import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactCatalogForPrompt } from "../data/catalog.ts";
import { STOMP_DEVICES } from "../data/categories.ts";
import { FEATURED } from "../data/featured.ts";
import type { Preset, StompModelId } from "../data/types.ts";
import { buildHlx, canExportHlx, exportSlots } from "./hlx.ts";
import { liftSnapshotSwitches } from "./hx-params.ts";
import { pgpLayout } from "./pgp.ts";
import { parsePresetJson, publicPreset, toPreset } from "./preset-schema.ts";
import { pedalsOnlyRig, withStompModel } from "./preset-utils.ts";
import { applyRouting } from "./rig-routing.ts";
import { keepSnapshots, sanitizeSnapshots } from "./snapshot-sanitize.ts";
import { finishTone, snapshotLoudness } from "./tone-finish.ts";

/**
 * What the player hears per snapshot: every block in the file, on or off in every snapshot,
 * checked against the preset's own snapshot lists (the file validator does not look at this).
 */
type Json = Record<string, any>;
const toneOf = (hlx: Json) => hlx.data.tone as Json;

/** The preset exactly as the exporter sees it, and the block id behind each file slot. */
function exported(preset: Preset, irSlot: number | null = null) {
  const prep = liftSnapshotSwitches(sanitizeSnapshots(applyRouting(preset)));
  const ids =
    preset.stompModel === "pod-go"
      ? pgpLayout(prep).slots.map((s) => s.block?.id)
      : exportSlots(prep, { irSlot }).slots.map((s) => s.block.id);
  const hlx = buildHlx(preset, { irSlot }) as Json;
  return { prep, ids, hlx, tone: toneOf(hlx) };
}

/** On/off of one block in snapshot n of the file. */
function onIn(x: ReturnType<typeof exported>, snap: number, blockId: string): boolean | undefined {
  const i = x.ids.indexOf(blockId);
  if (i < 0) return undefined;
  return x.tone[`snapshot${snap}`].blocks.dsp0[`block${i}`];
}

function snapshotStateIssues(preset: Preset): string[] {
  const x = exported(preset);
  const issues: string[] = [];
  x.prep.snapshots.slice(0, STOMP_DEVICES.find((d) => d.id === preset.stompModel)!.snapshots).forEach((snap, n) => {
    for (const block of x.prep.blocks) {
      const got = onIn(x, n, block.id);
      if (got === undefined) continue;
      const want = snap.enabledBlocks.length ? snap.enabledBlocks.includes(block.id) : pedalsOnlyRig(x.prep) ? false : block.enabled;
      if (got !== want) issues.push(`${preset.id} ${preset.stompModel} ${snap.name}: ${block.modelId} is ${got ? "on" : "off"}`);
    }
  });
  return issues;
}

function unit(id: string, model: StompModelId, target: Preset["playbackTarget"] = "frfr"): Preset {
  return { ...withStompModel(FEATURED.find((p) => p.id === id)!, model), playbackTarget: target };
}

function blockId(p: Preset, modelId: string): string {
  return p.blocks.find((b) => b.modelId === modelId)!.id;
}

function snapIndex(p: Preset, name: RegExp): number {
  return p.snapshots.findIndex((s) => name.test(s.name));
}

const song = (out: unknown, stompModel: StompModelId = "hx-stomp", extra: Partial<Parameters<typeof toPreset>[1]> = {}) =>
  toPreset(parsePresetJson(out), { source: "song", instrument: "guitar", stompModel, playbackTarget: "frfr", ...extra });

describe("every snapshot's on/off reaches the file", () => {
  it("matches the snapshot lists for every featured rig on every unit and rig", () => {
    const issues: string[] = [];
    for (const device of STOMP_DEVICES.filter((d) => canExportHlx(d.id))) {
      for (const src of FEATURED) {
        for (const target of ["frfr", "amp-front"] as const) issues.push(...snapshotStateIssues(unit(src.id, device.id, target)));
      }
    }
    assert.deepEqual(issues, []);
  });

  it("POD Go turns on the pedals a demo starts with bypassed", () => {
    const sandman = exported(unit("featured-sandman", "pod-go"));
    const lead = snapIndex(sandman.prep, /lead/i);
    assert.equal(onIn(sandman, lead, blockId(sandman.prep, "kinky-boost")), true, "Sandman lead boost");
    assert.equal(onIn(sandman, lead, blockId(sandman.prep, "scream-808")), true, "Sandman lead screamer");
    assert.equal(onIn(sandman, lead, blockId(sandman.prep, "simple-delay")), true, "Sandman lead delay");
    assert.equal(onIn(sandman, 0, blockId(sandman.prep, "kinky-boost")), false, "Sandman intro stays clean");
    const teen = exported(unit("featured-teen-spirit", "pod-go"));
    assert.equal(onIn(teen, snapIndex(teen.prep, /verse/i), blockId(teen.prep, "deez-one-vintage")), true, "Teen Spirit verse DS-1");
    const numb = exported(unit("featured-numb", "pod-go"));
    assert.equal(onIn(numb, snapIndex(numb.prep, /solo/i), blockId(numb.prep, "bighorn-fuzz")), true, "Numb solo Muff");
  });
});

describe("solo boost", () => {
  const out = {
    name: "T",
    tempo: 100,
    blocks: [
      { modelId: "kinky-boost", enabled: false, params: { Drive: 1.2 } },
      { modelId: "brit-2204", params: { Drive: 5, "Ch Vol": 6 } },
      { modelId: "4x12-greenback-25", params: {} },
    ],
    snapshots: [
      { name: "Verse", enabledModelIds: ["brit-2204", "4x12-greenback-25"] },
      { name: "Chorus", enabledModelIds: ["brit-2204", "4x12-greenback-25"] },
      {
        name: "Solo",
        enabledModelIds: ["kinky-boost", "brit-2204", "4x12-greenback-25"],
        paramOverrides: [{ modelId: "kinky-boost", params: [{ name: "Boost", value: 10 }] }],
      },
    ],
  };

  it("writes a Boost switch that only the solo turns on, on the block, on HX and POD Go", () => {
    for (const model of ["hx-stomp", "pod-go"] as const) {
      const p = finishTone(song(out, model), 100);
      const x = exported(p);
      const i = x.ids.indexOf(blockId(p, "kinky-boost"));
      assert.equal(x.tone.dsp0[`block${i}`].Boost, true, model);
      assert.equal(onIn(x, 2, blockId(p, "kinky-boost")), true, model);
      assert.equal(onIn(x, 0, blockId(p, "kinky-boost")), false, model);
    }
  });

  it("the boost finishTone adds is Boost on, Bright off", () => {
    const p = finishTone(
      song({
        ...out,
        blocks: out.blocks.slice(1),
        snapshots: out.snapshots.map((s) => ({ name: s.name, enabledModelIds: ["brit-2204", "4x12-greenback-25"] })),
      }),
      100,
    );
    const x = exported(p);
    const i = x.ids.indexOf(blockId(p, "kinky-boost"));
    assert.equal(x.tone.dsp0[`block${i}`].Boost, true);
    assert.equal(x.tone.dsp0[`block${i}`].Bright, false);
    assert.equal(onIn(x, 2, blockId(p, "kinky-boost")), true);
  });

  it("level match counts the boost only when its Boost switch is on", () => {
    const p = finishTone(song(out), 100);
    const boost = p.blocks.find((b) => b.modelId === "kinky-boost")!;
    assert.ok(snapshotLoudness(p.blocks, p.snapshots[2])! > snapshotLoudness(p.blocks, p.snapshots[0])!, "solo is the lift");
    const switchedOff = p.blocks.map((b) => (b.id === boost.id ? { ...b, params: { Drive: 1.2, Boost: 0 } } : b));
    const bypassed = { ...p.snapshots[2], enabledBlocks: p.snapshots[2].enabledBlocks.filter((id) => id !== boost.id) };
    assert.equal(snapshotLoudness(switchedOff, p.snapshots[2]), snapshotLoudness(switchedOff, bypassed));
  });
});

describe("snapshot trimming keeps the solo", () => {
  const four = {
    name: "T",
    tempo: 100,
    blocks: [{ modelId: "brit-2204", params: { Drive: 5 } }, { modelId: "4x12-greenback-25" }],
    snapshots: ["Intro", "Verse", "Chorus", "Solo"].map((name) => ({ name, enabledModelIds: ["brit-2204", "4x12-greenback-25"] })),
  };

  const switches = ["Intro", "Verse", "Chorus", "Solo"].map((name, i) => ({ index: i + 1, label: name.toUpperCase(), action: "snapshot", snapshotName: name }));
  /** Snapshot name on each snapshot switch, by index. */
  const fsNames = (p: Preset) =>
    Object.fromEntries(
      p.footswitches.filter((f) => f.action === "snapshot").map((f) => [f.index, p.snapshots.find((s) => s.id === f.snapshotId)?.name]),
    );

  it("on a fresh HX Stomp build, with the solo on FS3", () => {
    const p = song({ ...four, footswitches: switches }, "hx-stomp");
    assert.deepEqual(p.snapshots.map((s) => s.name), ["Intro", "Verse", "Solo"]);
    assert.deepEqual(fsNames(p), { 1: "Intro", 2: "Verse", 3: "Solo" });
  });

  it("on a cached Floor build served to a Stomp (FS3) or an XL (FS4)", () => {
    const floor = song(
      {
        ...four,
        snapshots: ["Intro", "Verse", "Pre", "Chorus", "Bridge", "Solo"].map((name) => ({ name, enabledModelIds: ["brit-2204", "4x12-greenback-25"] })),
        footswitches: ["Intro", "Verse", "Pre", "Chorus", "Bridge", "Solo"].map((name, i) => ({ index: i + 1, label: name, action: "snapshot", snapshotName: name })),
      },
      "helix-floor",
    );
    const stomp = withStompModel(floor, "hx-stomp");
    assert.deepEqual(stomp.snapshots.map((s) => s.name), ["Intro", "Verse", "Solo"]);
    assert.deepEqual(fsNames(stomp), { 1: "Intro", 2: "Verse", 3: "Solo" });
    assert.equal(toneOf(buildHlx(stomp, { irSlot: null }) as Json).snapshot2["@name"], "SOLO");
    const xl = withStompModel(floor, "hx-stomp-xl");
    assert.deepEqual(xl.snapshots.map((s) => s.name), ["Intro", "Verse", "Pre", "Solo"]);
    assert.equal(fsNames(xl)[4], "Solo");
  });

  it("leaves a list that fits, or one with no solo, in order", () => {
    assert.deepEqual(keepSnapshots([{ name: "A" }, { name: "B" }], 3).map((s) => s.name), ["A", "B"]);
    assert.deepEqual(keepSnapshots(["A", "B", "C", "D"].map((name) => ({ name })), 3).map((s) => s.name), ["A", "B", "C"]);
    assert.deepEqual(
      keepSnapshots(["Intro", "Solo 1", "Verse", "Solo 2"].map((name) => ({ name })), 3).map((s) => s.name),
      ["Intro", "Solo 1", "Solo 2"],
    );
  });
});

describe("pedals into a real amp", () => {
  const out = {
    name: "T",
    tempo: 100,
    blocks: [{ modelId: "scream-808", enabled: true, params: { Gain: 3 } }, { modelId: "brit-2204" }, { modelId: "4x12-greenback-25" }, { modelId: "plate", enabled: true }],
    snapshots: [
      { name: "Clean", enabledModelIds: ["brit-2204", "4x12-greenback-25"] },
      { name: "Drive", enabledModelIds: ["scream-808", "brit-2204", "4x12-greenback-25", "plate"] },
    ],
  };

  it("HX Effects: a snapshot that only had the amp and cab on is every pedal off", () => {
    const fresh = finishTone(song(out, "hx-effects"), 100);
    const cached = withStompModel(finishTone(song(out, "helix-floor"), 100), "hx-effects");
    for (const p of [fresh, cached]) {
      const x = exported(p);
      for (const b of x.prep.blocks) {
        if (onIn(x, 0, b.id) === undefined) continue;
        assert.equal(onIn(x, 0, b.id), false, `${b.modelId} in the clean snapshot`);
      }
      assert.equal(onIn(x, 1, blockId(x.prep, "scream-808")), true);
      assert.deepEqual(snapshotStateIssues(p), []);
    }
  });

  it("a Stomp set to play into an amp keeps the clean snapshot dry", () => {
    const p = { ...finishTone(song(out, "hx-stomp"), 100), playbackTarget: "amp-front" as const };
    const x = exported(p);
    assert.equal(onIn(x, 0, blockId(x.prep, "scream-808")), false);
    assert.equal(onIn(x, 0, blockId(x.prep, "plate")), false);
    assert.deepEqual(snapshotStateIssues(p), []);
  });
});

describe("gate", () => {
  it("counts the heaviest snapshot's amp Drive", () => {
    const p = finishTone(
      song({
        name: "T",
        tempo: 100,
        blocks: [{ modelId: "brit-2204", params: { Drive: 2 } }, { modelId: "4x12-greenback-25" }],
        snapshots: [
          { name: "Verse", enabledModelIds: ["brit-2204", "4x12-greenback-25"] },
          {
            name: "Chorus",
            enabledModelIds: ["brit-2204", "4x12-greenback-25"],
            paramOverrides: [{ modelId: "brit-2204", params: [{ name: "Drive", value: 6.5 }] }],
          },
        ],
      }),
      100,
    );
    const gate = p.blocks.find((b) => b.modelId === "noise-gate");
    assert.ok(gate, "gate added");
    const x = exported(p);
    assert.equal(onIn(x, 0, gate.id), false, "verse gate off");
    assert.equal(onIn(x, 1, gate.id), true, "chorus gate on");
  });

  it("sits ahead of a pre-amp echo, not between the echo and the amp", () => {
    const p = sanitizeSnapshots(
      finishTone(
        song({
          name: "T",
          tempo: 100,
          blocks: [{ modelId: "scream-808", params: { Gain: 7 } }, { modelId: "echo-platter-legacy" }, { modelId: "cali-rectifire", params: { Drive: 6 } }, { modelId: "4x12-cali-v30" }],
          snapshots: [{ name: "Riff", enabledModelIds: ["scream-808", "echo-platter-legacy", "cali-rectifire", "4x12-cali-v30"] }],
        }),
        100,
      ),
    );
    const order = [...p.blocks].sort((a, b) => a.position - b.position).map((b) => b.modelId);
    assert.ok(order.indexOf("noise-gate") >= 0);
    assert.ok(order.indexOf("noise-gate") < order.indexOf("echo-platter-legacy"), order.join(" "));
  });
});

describe("the player's IR", () => {
  const full = {
    name: "T",
    tempo: 100,
    blocks: [
      { modelId: "scream-808", params: { Gain: 7 } },
      { modelId: "chorus" },
      { modelId: "cali-rectifire", params: { Drive: 6 } },
      { modelId: "4x12-cali-v30" },
      { modelId: "simple-delay" },
      { modelId: "plate" },
      { modelId: "hall" },
      { modelId: "room" },
    ],
    snapshots: [{ name: "Riff", enabledModelIds: ["scream-808", "cali-rectifire", "4x12-cali-v30", "plate"] }],
  };

  it("finishTone leaves room for it, so the IR never pushes the last effect off a Stomp", () => {
    const p = finishTone(song(full), 100);
    const lastFx = p.blocks[p.blocks.length - 1].modelId;
    const withIr = exported(p, 7);
    assert.ok(withIr.ids.includes(blockId(p, lastFx)), `${lastFx} kept with the IR`);
    assert.equal(withIr.ids.length, 8);
  });

  it("is skipped on bass presets", () => {
    const bass = unit("featured-yyz", "hx-stomp");
    const tone = toneOf(buildHlx(bass, { irSlot: 7 }) as Json);
    const models = Object.values(tone.dsp0).map((b: any) => b?.["@model"]);
    assert.ok(!models.includes("HD2_ImpulseResponse1024"));
  });
});

describe("prompt catalog and shared cache", () => {
  it("lists the Binson Echorec stand-in", () => {
    assert.ok(compactCatalogForPrompt("guitar", "hx-stomp").includes("echo-platter-legacy"));
  });

  it("keeps the first player's locker out of the shared cache", () => {
    const p = song({
      name: "T",
      tempo: 100,
      originalGear: [{ role: "Pedal", name: "BOSS DS-1", notes: "verse" }],
      blocks: [{ modelId: "brit-2204" }, { modelId: "4x12-greenback-25" }],
      snapshots: [{ name: "Verse", notes: "DS-1 on. Grab your Telecaster for the bite." }],
      tips: ["Grab your Fender Telecaster and use the bridge pickup.", "Tune down a half step (Eb standard)", "Your Telecaster bridge pickup is close."],
      programming: ["Set the DS-1 tone at noon."],
    });
    const gear = [
      { id: "1", kind: "guitar" as const, name: "Fender Telecaster", notes: "" },
      { id: "2", kind: "pedal" as const, name: "BOSS DS-1", notes: "" },
    ];
    const shared = publicPreset({ ...p, recommendedGear: [{ item: "Fender Telecaster", why: "yours", fromLocker: true }] }, gear);
    assert.deepEqual(shared.recommendedGear, []);
    assert.deepEqual(shared.tips, ["Tune down a half step (Eb standard)"]);
    assert.deepEqual(shared.programming, ["Set the DS-1 tone at noon."]);
    assert.equal(shared.snapshots[0].notes.includes("Telecaster"), false);
  });
});
