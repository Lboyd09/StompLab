import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEATURED } from "../data/featured.ts";
import { applyWahPreference, parseWahMode, songUsedWah, wahPromptLine } from "./wah.ts";

function featured(id: string) {
  const p = FEATURED.find((x) => x.id === id);
  assert.ok(p, id);
  return p;
}

describe("wah preference", () => {
  it("defaults to a real pedal in front", () => {
    assert.equal(parseWahMode(undefined), "pedal");
    assert.equal(parseWahMode("nope"), "pedal");
    assert.equal(parseWahMode("exp"), "exp");
  });

  it("never puts a wah block on Sandman or Killing when the player has a pedal", () => {
    for (const id of ["featured-sandman", "featured-killing-name"] as const) {
      const src = featured(id);
      assert.equal(
        src.blocks.some((b) => /wah/i.test(b.modelId)),
        false,
        id,
      );
      assert.equal(songUsedWah(src), true, id);
      const next = applyWahPreference(src, "pedal", "teardrop-310");
      assert.equal(
        next.blocks.some((b) => /wah|teardrop|uk-wah|fassel/i.test(b.modelId)),
        false,
        id,
      );
      assert.ok(next.tips.some((t) => /wah/i.test(t)), id);
    }
  });

  it("inserts the chosen Helix wah first when the player wants EXP", () => {
    const next = applyWahPreference(featured("featured-sandman"), "exp", "uk-wah-846");
    assert.equal(next.blocks[0]?.modelId, "uk-wah-846");
    assert.ok(next.tips.some((t) => /EXP 1/i.test(t)));
  });

  it("tells Gemini to omit wah when the player has a pedal", () => {
    const line = wahPromptLine("pedal", "teardrop-310");
    assert.match(line, /Do NOT emit any wah block/);
    assert.match(wahPromptLine("exp", "teardrop-310"), /teardrop-310/);
  });
});
