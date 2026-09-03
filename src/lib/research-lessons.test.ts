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

  it("always includes DS-1 and Guitar Chalk rules, never a featured title", () => {
    const block = standingRulesBlock([
      "Everlong chorus is too scooped",
      "Like a Stone needs more wah",
      "Show Me How to Live is wrong",
      "Don't dime Drive on high-gain amps",
    ]);
    assert.match(block, /deez-one-vintage/);
    assert.match(block, /Guitar Chalk/);
    assert.match(block, /stupor-od is the SD-1/);
    assert.equal(/everlong|like a stone|show me how to live/i.test(block), false);
    assert.match(STANDING_RESEARCH_RULES, /deez-one-vintage/);
  });
});
