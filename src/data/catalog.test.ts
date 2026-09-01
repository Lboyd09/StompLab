import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_MODELS, MODEL_MAP, findEquivalents, lookupAliases, searchModels } from "./catalog.ts";
import { HELIX_IDS, UNEXPORTABLE_MODELS, helixIdFor } from "./helix-ids.ts";
import { systemForDevice } from "../lib/preset-schema.ts";

describe("DS-1 catalog", () => {
  it("aliases DS-1 to Deez One Vintage first, never Stupor OD", () => {
    assert.deepEqual(lookupAliases("ds1"), ["deez-one-vintage", "deez-one-mod"]);
    assert.deepEqual(lookupAliases("DS-1"), ["deez-one-vintage", "deez-one-mod"]);
    assert.deepEqual(lookupAliases("boss ds1"), ["deez-one-vintage", "deez-one-mod"]);
    for (const q of ["ds1", "DS-1", "boss ds-1"]) {
      const hits = findEquivalents(q);
      assert.equal(hits[0]?.modelId, "deez-one-vintage", q);
      assert.equal(hits[1]?.modelId, "deez-one-mod", q);
      assert.ok(!hits.some((h) => h.modelId === "stupor-od"), q);
      const search = searchModels(q);
      assert.equal(search[0]?.id, "deez-one-vintage", q);
      assert.ok(search.some((m) => m.id === "deez-one-mod"), q);
      assert.ok(!search.some((m) => m.id === "stupor-od"), q);
    }
  });

  it("maps SD-1 to Stupor OD", () => {
    assert.equal(findEquivalents("sd-1")[0]?.modelId, "stupor-od");
    assert.equal(searchModels("super overdrive")[0]?.id, "stupor-od");
  });

  it("labels Deez One as the BOSS DS-1", () => {
    assert.match(MODEL_MAP["deez-one-vintage"].basedOn, /DS-1/);
    assert.match(MODEL_MAP["deez-one-mod"].basedOn, /DS-1/);
    assert.match(MODEL_MAP["stupor-od"].basedOn, /SD-1/);
  });
});

describe("catalog ids", () => {
  it("gives Moo)))n amps the factory moon-* ids", () => {
    assert.ok(MODEL_MAP["moon-nrm"]);
    assert.ok(MODEL_MAP["moon-brt"]);
    assert.ok(MODEL_MAP["moon-jump"]);
    assert.equal(HELIX_IDS["moon-nrm"], "HD2_AmpMoonNrm");
  });

  it("covers every exportable non-legacy non-mic model with a factory id", () => {
    for (const m of ALL_MODELS) {
      if (m.io === "legacy" || m.category === "mic") continue;
      if (UNEXPORTABLE_MODELS.has(m.id)) {
        assert.equal(helixIdFor(m.id), undefined, m.id);
        continue;
      }
      assert.ok(HELIX_IDS[m.id], `missing factory id for ${m.id} (${m.name})`);
      assert.ok(helixIdFor(m.id), `helixIdFor skipped ${m.id}`);
    }
  });
});

describe("research prompt", () => {
  it("tells Gemini DS-1 is Deez One, not Stupor OD", () => {
    const prompt = systemForDevice("hx-stomp", "guitar");
    assert.match(prompt, /deez-one-vintage/);
    assert.match(prompt, /NEVER stupor-od/);
    assert.match(prompt, /never dime Drive/i);
  });
});
