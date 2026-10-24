import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEATURED } from "@/data/featured";
import type { Preset } from "@/data/types";
import { openFeatured, type PlayerSettings } from "./open-featured.ts";
import { resolveNamedPreset, withStompModel } from "./preset-utils.ts";

const settings = (stompModel: PlayerSettings["stompModel"]): PlayerSettings => ({
  stompModel,
  gear: [],
  wahMode: "pedal",
  wahModelId: "teardrop-310",
  playbackTarget: "frfr",
});

function sandman(): Preset {
  const src = FEATURED.find((p) => p.id === "featured-sandman");
  assert.ok(src);
  return src;
}

describe("opening a demo", () => {
  it("fits the demo to the player's unit and asks to save it", () => {
    const opened = openFeatured("featured-sandman", settings("hx-stomp-xl"), []);
    assert.ok(opened);
    assert.equal(opened.save, true);
    assert.equal(opened.preset.id, "featured-sandman-hx-stomp-xl");
    assert.equal(opened.preset.stompModel, "hx-stomp-xl");
  });
  it("returns the player's edited copy untouched instead of rebuilding over it", () => {
    const edited = { ...withStompModel(sandman(), "hx-stomp"), userEdited: true, tempo: 77 };
    const opened = openFeatured("featured-sandman", settings("hx-stomp"), [edited]);
    assert.ok(opened);
    assert.equal(opened.save, false);
    assert.equal(opened.preset, edited);
  });
  it("an edit on another unit does not stand in for this unit", () => {
    const edited = { ...withStompModel(sandman(), "hx-stomp"), userEdited: true, tempo: 77 };
    const opened = openFeatured("featured-sandman", settings("helix-floor"), [edited]);
    assert.ok(opened);
    assert.equal(opened.save, true);
    assert.notEqual(opened.preset.tempo, 77);
  });
});

describe("resolving a preset link", () => {
  it("prefers the stored copy for that unit over the catalog", () => {
    const stored = { ...withStompModel(sandman(), "hx-stomp"), tempo: 77 };
    assert.equal(resolveNamedPreset("featured-sandman-hx-stomp", "hx-stomp", [stored])?.tempo, 77);
  });
  it("a friend's link for another unit never shows this player's edits", () => {
    const mine = { ...withStompModel(sandman(), "hx-stomp"), userEdited: true, tempo: 77 };
    const theirs = resolveNamedPreset("featured-sandman-helix-floor", "helix-floor", [mine]);
    assert.equal(theirs?.stompModel, "helix-floor");
    assert.notEqual(theirs?.tempo, 77);
  });
  it("setlist export still carries the player's edit to another unit", () => {
    const mine = { ...withStompModel(sandman(), "hx-stomp"), userEdited: true, tempo: 77 };
    const out = resolveNamedPreset("featured-sandman-hx-stomp", "helix-floor", [mine], { anyUnitEdits: true });
    assert.equal(out?.tempo, 77);
  });
});
