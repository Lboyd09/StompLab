import assert from "node:assert/strict";
import { test } from "node:test";
import type { StompBlock } from "@/data/types";
import { replicaStatusLine, shortGearName } from "./status-line.ts";

const block = (id: string, modelId: string, enabled: boolean, position: number): StompBlock => ({
  id,
  modelId,
  enabled,
  path: "main",
  position,
  params: {},
});

const chain = [
  block("b1", "deez-one-vintage", false, 0),
  block("b2", "70s-chorus", true, 1),
  block("b3", "cali-iv-rhythm-1", true, 2),
];

test("short gear names keep the pedal, drop the brand", () => {
  assert.equal(shortGearName("BOSS DS-1 Distortion (Made-in-Japan)", "Deez One Vintage"), "DS-1");
  assert.equal(shortGearName("BOSS CE-1 / EHX Small Clone", "70s Chorus"), "70s Chorus");
  assert.equal(shortGearName("BOSS CE-1 / EHX Small Clone", "70s Chorus", "a watery Small Clone verse"), "Small Clone");
  assert.equal(shortGearName("Line 6 Original", "Simple Delay"), "Simple Delay");
  assert.equal(shortGearName("Analog Man King of Tone", "Kingpin"), "King of Tone");
  assert.equal(shortGearName("Electro-Harmonix Deluxe Memory Man", "Adriatic Delay"), "Deluxe Memory Man");
  assert.equal(shortGearName("Fender optical tremolo circuit", "Optical Trem"), "Optical Trem");
  assert.equal(shortGearName("Xotic EP Booster", "Kinky Boost"), "EP Booster");
  assert.equal(shortGearName("MESA/Boogie Mark IV Graphic EQ", "Cali Q Graphic"), "Graphic EQ");
  assert.equal(shortGearName("MXR Phase 90", "Script Mod Phase"), "Phase 90");
  assert.equal(shortGearName("", "Noise Gate"), "Noise Gate");
});

test("snapshot line names the switch, the part and each effect, not the amp", () => {
  const line = replicaStatusLine({
    stompMode: false,
    blocks: chain,
    partName: "Verse",
    partFs: 1,
    footswitches: [],
    stompFs: [1, 2],
    context: "Clean amp, Small Clone on, DS-1 off.",
  });
  assert.equal(line, "FS1 · Verse: DS-1 off, Small Clone on");
});

test("stomp line lists the switches in order", () => {
  const line = replicaStatusLine({
    stompMode: true,
    blocks: chain,
    footswitches: [
      { index: 2, label: "CE1", color: "#0af", action: "bypass", targetBlockId: "b2", notes: "" },
      { index: 1, label: "DS1", color: "#f80", action: "bypass", targetBlockId: "b1", notes: "" },
    ],
    stompFs: [1, 2],
  });
  assert.equal(line, "FS1 DS-1 off · FS2 70s Chorus on");
});
