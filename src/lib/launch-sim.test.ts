import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODELS, MODEL_MAP } from "../data/catalog.ts";
import { STOMP_DEVICES } from "../data/categories.ts";
import { FEATURED } from "../data/featured.ts";
import { helixIdFor } from "../data/helix-ids.ts";
import { FACTORY_HLX_PARAMS } from "../data/helix-params.ts";
import { buildHlx, canExportHlx } from "./hlx.ts";
import { withStompModel } from "./preset-utils.ts";
import { applyWahPreference } from "./wah.ts";
import type { WahMode } from "./wah.ts";

describe("1,000-player launch pass", () => {
  it("exports every featured rig on every Helix-family unit", () => {
    for (const src of FEATURED) {
      for (const device of STOMP_DEVICES) {
        const preset = withStompModel(src, device.id);
        assert.equal(preset.stompModel, device.id, `${src.id} ${device.id}`);
        if (!canExportHlx(device.id)) continue;
        const hlx = buildHlx(preset);
        assert.equal((hlx.data as { device: number }).device, device.hlxDeviceId, `${src.id} ${device.id}`);
        const tone = (hlx.data as { tone: Record<string, unknown> }).tone;
        const snap0 = tone.snapshot0 as { "@fs_index"?: number; "@fs_label"?: string; "@name": string };
        assert.equal(snap0["@fs_index"], 1, `${src.id} ${device.id} snap0 fs`);
        assert.ok(snap0["@fs_label"], `${src.id} ${device.id} missing scribble`);
        assert.equal((tone.global as { "@pedalstate": number })["@pedalstate"], 2, `${src.id} ${device.id} snapshot mode`);
        const dsp = tone.dsp0 as Record<string, Record<string, unknown>>;
        for (const [k, b] of Object.entries(dsp)) {
          if (!k.startsWith("block") && k !== "cab0") continue;
          const model = String(b["@model"] ?? "");
          if (!model || model.startsWith("HD2_App") || model.startsWith("HelixStomp_")) continue;
          assert.ok(FACTORY_HLX_PARAMS[model], `${src.id} ${device.id} ${k} ${model}`);
        }
      }
    }
  });

  it("keeps snapshot names on the physical switches after a player renames them", () => {
    const src = FEATURED.find((p) => p.id === "featured-teen-spirit")!;
    const renamed = {
      ...src,
      snapshots: src.snapshots.map((s, i) => (i === 0 ? { ...s, name: "Verse" } : s)),
    };
    const hlx = buildHlx(renamed);
    const snap0 = (hlx.data as { tone: { snapshot0: { "@name": string; "@fs_label": string } } }).tone.snapshot0;
    assert.equal(snap0["@name"], "VERSE");
    assert.equal(snap0["@fs_label"], "VERSE");
  });

  it("strips wah for a thousand players who already own a pedal", () => {
    for (const src of FEATURED) {
      const next = applyWahPreference(src, "pedal", "teardrop-310");
      assert.equal(
        next.blocks.some((b) => MODEL_MAP[b.modelId]?.category === "wah"),
        false,
        src.id,
      );
    }
  });

  it("only uses catalog models that exist and export", () => {
    for (const src of FEATURED) {
      for (const b of src.blocks) {
        const model = MODEL_MAP[b.modelId];
        assert.ok(model, `${src.id} unknown ${b.modelId}`);
        if (model.category === "mic" || model.category === "ir") continue;
        assert.ok(helixIdFor(b.modelId), `${src.id} unexportable ${b.modelId}`);
      }
      const ids = src.snapshots.map((s) => s.id);
      assert.equal(new Set(ids).size, ids.length, `${src.id} duplicate snapshot ids`);
      assert.ok(src.snapshots.length >= 2, `${src.id} needs at least two tones`);
      assert.ok(src.snapshots.length <= 4, `${src.id} too many snapshots`);
    }
    const featuredIds = FEATURED.map((p) => p.id);
    assert.equal(new Set(featuredIds).size, featuredIds.length);
  });

  it("survives 1,000 mixed player sessions across songs, units, and wah setups", () => {
    const wahs: WahMode[] = ["pedal", "exp", "fs"];
    let n = 0;
    while (n < 1000) {
      const src = FEATURED[n % FEATURED.length];
      const device = STOMP_DEVICES[n % STOMP_DEVICES.length];
      const wah = wahs[n % wahs.length];
      const renamed = {
        ...src,
        snapshots: src.snapshots.map((s, i) => (i === 0 ? { ...s, name: `Snap${n % 97}` } : s)),
      };
      const preset = applyWahPreference(withStompModel(renamed, device.id), wah, "teardrop-310");
      assert.ok(preset.blocks.length >= 1, `${src.id} ${device.id} empty`);
      if (wah === "pedal") {
        assert.equal(
          preset.blocks.some((b) => MODEL_MAP[b.modelId]?.category === "wah"),
          false,
          `${src.id} ${device.id} wah leaked`,
        );
      }
      if (canExportHlx(device.id)) {
        const hlx = buildHlx(preset);
        assert.equal((hlx.data as { device: number }).device, device.hlxDeviceId);
        const snap0 = (hlx.data as { tone: { snapshot0: { "@fs_label": string } } }).tone.snapshot0;
        assert.ok(snap0["@fs_label"], `${src.id} ${device.id} scribble`);
      }
      n += 1;
    }
    assert.equal(n, 1000);
  });

  it("gives every catalog model a real description", () => {
    for (const m of ALL_MODELS) {
      assert.ok(m.description.trim().length >= 12, m.id);
      assert.ok(m.basedOn.trim().length >= 3, m.id);
    }
  });
});
