import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandsFor, GEAR_SUGGESTIONS, modelsFor, popularFor, searchGear, suggestionsFor } from "./gear-catalog.ts";

describe("gear catalog", () => {
  it("covers common guitar, bass, amp, cab, pedal, and pickup brands", () => {
    const kinds = new Set(GEAR_SUGGESTIONS.map((g) => g.kind));
    for (const k of ["guitar", "bass", "amp", "cab", "pedal", "pickup"] as const) {
      assert.ok(kinds.has(k), k);
    }
    assert.ok(GEAR_SUGGESTIONS.length > 2500, `too small: ${GEAR_SUGGESTIONS.length}`);
    assert.ok(brandsFor("guitar").includes("Fender"));
    assert.ok(brandsFor("guitar").includes("Gibson"));
    assert.ok(brandsFor("guitar").includes("Harley Benton"));
    assert.ok(brandsFor("amp").includes("Marshall"));
    assert.ok(brandsFor("amp").includes("Line 6"));
    assert.ok(brandsFor("pedal").includes("BOSS"));
    assert.ok(brandsFor("pedal").includes("Nobels"));
    assert.ok(modelsFor("guitar", "Fender").some((g) => /Stratocaster/.test(g.model)));
    assert.ok(suggestionsFor("amp", "rectifier").some((g) => /Rectifier/.test(g.name)));
    assert.ok(searchGear("big muff", "pedal").length >= 1);
  });
  it("lists popular one-tap models that exist in the catalog", () => {
    const guitars = popularFor("guitar");
    assert.ok(guitars.length >= 8, `popular guitars: ${guitars.length}`);
    assert.ok(guitars.some((g) => g.name === "Fender Stratocaster"));
    assert.ok(popularFor("amp").some((g) => /Twin Reverb/.test(g.name)));
    assert.ok(popularFor("pedal").some((g) => /TS9/.test(g.name)));
  });
  it("does not duplicate the same full name", () => {
    const names = GEAR_SUGGESTIONS.map((g) => `${g.kind}|${g.name}`);
    assert.equal(new Set(names).size, names.length);
  });
});
