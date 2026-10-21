import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { brandsFor, catalogPickupsFor, GEAR_SUGGESTIONS, modelsFor, popularFor, searchGear, suggestionsFor, topBrandsFor } from "./gear-catalog.ts";

describe("gear catalog", () => {
  it("covers common guitar, bass, amp, cab, pedal, and pickup brands", () => {
    const kinds = new Set(GEAR_SUGGESTIONS.map((g) => g.kind));
    for (const k of ["guitar", "bass", "amp", "cab", "pedal", "pickup"] as const) {
      assert.ok(kinds.has(k), k);
    }
    assert.ok(GEAR_SUGGESTIONS.length > 3500, `too small: ${GEAR_SUGGESTIONS.length}`);
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
    assert.equal(brandsFor("guitar").includes("LTD"), false);
    assert.equal(brandsFor("guitar").includes("ESP LTD"), false);
    assert.ok(brandsFor("guitar").includes("ESP"));
    assert.equal(brandsFor("guitar").includes("Sterling"), false);
    assert.ok(brandsFor("guitar").includes("Sterling by Music Man"));
    assert.equal(brandsFor("guitar").includes("Tom Anderson"), false);
    assert.ok(brandsFor("guitar").includes("Anderson"));
    const les = GEAR_SUGGESTIONS.filter(
      (g) => g.kind === "guitar" && g.brand === "Gibson" && g.model === "Les Paul Standard",
    );
    assert.equal(les.length, 1);
    assert.ok(popularFor("guitar").some((g) => g.name === "ESP LTD EC-1000"));
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

  it("folds brand spellings and near-duplicate model spellings", () => {
    const guitarBrands = brandsFor("bass");
    assert.equal(guitarBrands.includes("Hofner"), false);
    assert.ok(guitarBrands.includes("Höfner"));
    assert.equal(brandsFor("amp").includes("Boss"), false);
    assert.ok(brandsFor("amp").includes("BOSS"));
    assert.equal(brandsFor("pedal").includes("EQD"), false);
    assert.equal(brandsFor("pedal").includes("Caroline"), false);
    assert.equal(brandsFor("pedal").includes("Benson"), false);
    assert.equal(brandsFor("pedal").includes("Dunlop Fuzz Face"), false);
    const loose = GEAR_SUGGESTIONS.map((g) => `${g.kind}|${g.brand}|${g.model}`.toLowerCase().replace(/[^a-z0-9|]+/g, ""));
    assert.equal(new Set(loose).size, loose.length, "TS-9 and TS9 are one entry");
  });
  it("gained real current and classic models", () => {
    const has = (kind: string, name: string) => GEAR_SUGGESTIONS.some((g) => g.kind === kind && g.name === name);
    assert.ok(has("guitar", "Fender American Ultra Stratocaster"));
    assert.ok(has("guitar", "Fender Vintera II '60s Jazzmaster"));
    assert.ok(has("guitar", "Squier Sonic Jazzmaster"));
    assert.ok(has("guitar", "Gibson 1959 Les Paul Standard Reissue"));
    assert.ok(has("guitar", "PRS SE Silver Sky Stoptail"));
    assert.ok(has("guitar", "Ibanez RG5120M Prestige"));
    assert.ok(has("guitar", "Martin D-28"));
    assert.ok(has("bass", "Fender American Professional II Jazz Bass"));
    assert.ok(has("bass", "Spector NS Ethos"));
    assert.ok(has("amp", "Fender Tone Master Deluxe Reverb"));
    assert.ok(has("amp", "Line 6 Catalyst 100"));
    assert.ok(has("cab", "Celestion Vintage 30"));
    assert.ok(has("pedal", "Wampler Tumnus"));
    assert.ok(has("pickup", "Seymour Duncan Jazz SH-2"));
  });
  it("finds gear by what players type: aliases, short names, gaps and typos", () => {
    const top = (q: string, kind?: "guitar" | "pedal" | "amp" | "bass") => searchGear(q, kind).slice(0, 5).map((g) => g.name);
    assert.ok(top("lp", "guitar").slice(0, 3).every((n) => /Les Paul/.test(n)), top("lp", "guitar").join());
    assert.ok(top("strat", "guitar").some((n) => /Stratocaster/.test(n)));
    assert.equal(top("ts9", "pedal")[0], "Ibanez TS9");
    assert.equal(top("ts 9", "pedal")[0], "Ibanez TS9");
    assert.equal(top("ts-9", "pedal")[0], "Ibanez TS9");
    assert.ok(top("klon", "pedal")[0].includes("Klon"));
    assert.ok(top("rat", "pedal").slice(0, 3).every((n) => /\brat/i.test(n)), top("rat", "pedal").join());
    assert.ok(top("tele", "guitar").every((n) => /Telecaster/.test(n)));
    assert.ok(top("crybaby", "pedal")[0].includes("Cry Baby"));
    assert.ok(top("recto", "amp")[0].includes("Rectifier"));
    assert.ok(top("p bass", "bass")[0].includes("Precision"));
    assert.ok(top("ehx", "pedal").every((n) => n.startsWith("Electro-Harmonix")));
    assert.ok(top("stratocastr", "guitar")[0].includes("Stratocaster"), "one typo");
    assert.ok(top("jcm800", "amp")[0].includes("JCM800"));
    assert.ok(top("mesa dual", "amp")[0].includes("Dual Rectifier"));
    assert.deepEqual(searchGear("zzqqxx"), []);
    assert.deepEqual(searchGear("   "), []);
  });
  it("lists the biggest brands first for the chips", () => {
    const top = topBrandsFor("guitar", 6);
    assert.equal(top.length, 6);
    assert.ok(top.includes("Fender"));
    assert.ok(popularFor("pedal").length >= 12);
  });
  it("tags the pickups of guitars where that is clear", () => {
    assert.equal(catalogPickupsFor("Fender American Ultra Stratocaster"), "single-coil");
    assert.equal(catalogPickupsFor("Gibson Les Paul Junior Tribute DC"), "p90");
    assert.equal(catalogPickupsFor("Gibson 1959 Les Paul Standard Reissue"), "humbucker");
    assert.equal(catalogPickupsFor("Ibanez JEM7V"), "mixed");
    assert.equal(catalogPickupsFor("Martin D-28"), null);
    const g = GEAR_SUGGESTIONS.find((x) => x.name === "Fender American Ultra Stratocaster");
    assert.equal(g?.pickups, "single-coil");
  });
});
