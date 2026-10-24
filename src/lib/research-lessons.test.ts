import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generalizeLesson, standingRulesBlock, STANDING_RESEARCH_RULES } from "./research-lessons.ts";

describe("research lessons", () => {
  it("never keeps a named demo title in a standing rule", () => {
    const g = generalizeLesson("Teen Spirit drive is too high, drop the DS-1");
    assert.ok(g);
    assert.equal(/teen spirit/i.test(g!), false);
    assert.match(g!, /ds-1/i);
  });

  it("drops a retune-this-title one-liner", () => {
    assert.equal(generalizeLesson("Fix Enter Sandman"), null);
    assert.equal(generalizeLesson("x"), null);
  });

  it("keeps a general gain/solo note", () => {
    const g = generalizeLesson("Solos need their own snapshot with a boost, not the rhythm tone");
    assert.ok(g);
    assert.match(g!, /solo/i);
  });

  it("frames player lessons as general rules, never a featured title", () => {
    const block = standingRulesBlock([
      "Everlong chorus is too scooped",
      "Like a Stone needs more wah",
      "Show Me How to Live is wrong",
      "Don't dime Drive on high-gain amps",
    ]);
    assert.match(block, /never retune a named title/);
    assert.match(block, /Don't dime Drive/);
    assert.equal(/everlong|like a stone|show me how to live/i.test(block), false);
  });

  it("does not repeat the tone rules that SYSTEM and systemForDevice already carry", () => {
    // Those rules are asserted on systemForDevice in src/data/catalog.test.ts.
    for (const rule of [/deez-one-vintage/, /GATE:/, /CLEAN OPENING/, /SINGING FUZZ/, /TIGHT CHUG/, /dedicated EQ/]) {
      assert.equal(rule.test(STANDING_RESEARCH_RULES), false, String(rule));
    }
  });

  it("is actually injected into song research, not only tested", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./research.ts", import.meta.url), "utf8");
    assert.match(src, /standingRulesBlock/);
    assert.match(src, /standingRulesBlock\(\[\]\)/);
    assert.equal(/playerDerivedRules\(bits\)/.test(src), false);
  });
});
