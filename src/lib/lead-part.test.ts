import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_IDS, FEATURED } from "@/data/featured";
import { songCacheKey } from "./cache";
import { PRESET_RESPONSE_SCHEMA } from "./gemini";
import { guitarRolePrompt, libraryServesFeatured, songBuildRole } from "./guitar-role";
import { parsePresetJson, parseRecordNotes, songResearchInstructions, toPreset, tuningTip } from "./preset-schema";
import { matchFeatured } from "./research";

describe("a looked-up song is the lead part", () => {
  it("targets the lead player on a two-guitar record, whatever the client sent", () => {
    assert.equal(songBuildRole("guitar", "Sweet Child O' Mine", "Guns N' Roses"), "lead");
    assert.equal(songBuildRole("guitar", "Back in Black", "AC/DC"), "lead");
    assert.equal(songBuildRole("guitar", "Enter Sandman", "Metallica"), "lead");
  });

  it("keeps one-guitarist and unknown songs on 'both' so their v11 cache rows still hit", () => {
    assert.equal(songBuildRole("guitar", "Smells Like Teen Spirit", "Nirvana"), "both");
    assert.equal(songBuildRole("guitar", "Oceans (Where Feet May Fail)", "Hillsong UNITED"), "both");
    assert.equal(songBuildRole("bass", "Sweet Child O' Mine", "Guns N' Roses"), "both");
    const key = songCacheKey("Smells Like Teen Spirit", "Nirvana", "guitar", "hx-stomp", "frfr", "pedal", songBuildRole("guitar", "Smells Like Teen Spirit", "Nirvana"));
    assert.match(key, /^song\|v11\|.*\|both$/);
    const lead = songCacheKey("Sweet Child O' Mine", "Guns N' Roses", "guitar", "hx-stomp", "frfr", "pedal", songBuildRole("guitar", "Sweet Child O' Mine", "Guns N' Roses"));
    assert.match(lead, /^song\|v11\|.*\|lead$/);
  });

  it("briefs the model on the lead part, never the rhythm part or a blend", () => {
    const dual = guitarRolePrompt("lead", "guitar", "dual");
    assert.match(dual, /LEAD GUITARIST'S PART/);
    assert.match(dual, /Never the rhythm guitarist's chain/);
    assert.doesNotMatch(dual, /RHYTHM GUITARIST ONLY/);
    // Even a stale "rhythm" role cannot produce a rhythm brief.
    assert.doesNotMatch(guitarRolePrompt("rhythm", "guitar", "dual"), /RHYTHM GUITARIST ONLY/);
    const unknown = songResearchInstructions("Oceans (Where Feet May Fail)", "Hillsong UNITED", "guitar", undefined, "both");
    assert.match(unknown, /build the LEAD part/);
    assert.match(guitarRolePrompt("both", "bass"), /^Bass: one player/);
  });
});

describe("featured presets ignore the guitar role", () => {
  it("serves demos to everyone and the other featured rigs to paying players", () => {
    assert.equal(libraryServesFeatured(true, false), true);
    assert.equal(libraryServesFeatured(true, true), true, "a paid player on a two-guitar demo still gets the demo");
    assert.equal(libraryServesFeatured(false, true), true, "Higher for a paid player");
    assert.equal(libraryServesFeatured(false, false), false);
  });

  it("returns the whole demo, not a rhythm- or lead-trimmed copy", () => {
    const sand = FEATURED.find((p) => p.id === "featured-sandman")!;
    for (const role of ["rhythm", "lead", "both"] as const) {
      const hit = matchFeatured("Enter Sandman", "Metallica", "guitar", "hx-stomp", role);
      assert.ok(hit);
      assert.deepEqual(hit.snapshots.map((s) => s.name), sand.snapshots.map((s) => s.name));
    }
    assert.ok((DEMO_IDS as readonly string[]).includes("featured-sandman"));
  });
});

describe("preset response", () => {
  it("has no open OBJECT in the response schema (Gemini rejects or empties those)", () => {
    const walk = (node: unknown, path: string) => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "OBJECT") {
        assert.ok(n.properties && Object.keys(n.properties as object).length, `${path} is an OBJECT with no properties`);
      }
      for (const [k, v] of Object.entries(n)) walk(v, `${path}.${k}`);
    };
    walk(PRESET_RESPONSE_SCHEMA, "schema");
  });

  it("reads knob arrays, override arrays, sections, and the tuning", () => {
    const parsed = parsePresetJson({
      guitarist: "Slash (lead guitar)",
      tuning: "Eb standard",
      name: "Sweet Child",
      tempo: 125,
      summary: "Les Paul into a Marshall.",
      originalGear: [{ role: "Amp", name: "Marshall JCM800", notes: "rented" }],
      blocks: [
        { modelId: "brit-2204", enabled: true, params: [{ name: "Drive", value: 5.5 }, { name: "Ch Vol", value: 6 }] },
        { modelId: "4x12-greenback-25", enabled: true, params: [{ name: "Mic", value: 0 }] },
      ],
      snapshots: [
        {
          name: "Intro",
          sections: "Intro riff, Verse",
          changes: "neck pickup, amp crunch",
          enabledModelIds: ["brit-2204", "4x12-greenback-25"],
          paramOverrides: [{ modelId: "brit-2204", params: [{ name: "Drive", value: 5 }] }],
        },
      ],
      footswitches: [{ index: 1, label: "INTRO", action: "snapshot", snapshotName: "Intro" }],
      tips: ["Neck pickup for the intro."],
    });
    const preset = toPreset(parsed, { source: "song", instrument: "guitar", stompModel: "hx-stomp", song: "Sweet Child O' Mine", artist: "Guns N' Roses" });
    const amp = preset.blocks.find((b) => b.modelId === "brit-2204")!;
    assert.equal(amp.params.Drive, 5.5);
    assert.equal(preset.snapshots[0].paramOverrides?.[amp.id]?.Drive, 5);
    assert.equal(preset.snapshots[0].notes, "Intro riff, Verse: neck pickup, amp crunch");
    assert.match(preset.tips[0], /Tune down a half step/);
    assert.match(preset.summary, /Slash/);
  });

  it("writes plain tuning tips and none for standard", () => {
    assert.equal(tuningTip("E standard"), null);
    assert.equal(tuningTip("Standard"), null);
    assert.match(tuningTip("E♭ standard")!, /half step/);
    assert.match(tuningTip("Drop D")!, /^Drop D/);
    assert.match(tuningTip("D standard")!, /whole step/);
  });

  it("reads the grounded research notes loosely", () => {
    const json = parseRecordNotes('Here you go:\n```json\n{"bpm": 125, "tuning": "Eb standard", "amp": "Marshall JCM800"}\n```');
    assert.equal(json.bpm, 125);
    assert.match(json.notes, /JCM800/);
    assert.doesNotMatch(json.notes, /"bpm"/);
    const text = parseRecordNotes("The song is about 94 BPM, Les Paul into a Marshall.");
    assert.equal(text.bpm, 94);
    assert.deepEqual(parseRecordNotes(null), { notes: "", bpm: null });
    assert.equal(parseRecordNotes('{"bpm": 999}').bpm, null);
  });
});
