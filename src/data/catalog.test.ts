import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compactCatalogForPrompt, ALL_MODELS, MODEL_MAP, catalogModels, devicesForModel, findEquivalents, lookupAliases, modelOnDevice, searchModels } from "./catalog.ts";
import { DEVICE_MAP, STOMP_DEVICES } from "./categories.ts";
import { HELIX_IDS, UNEXPORTABLE_MODELS, helixIdFor } from "./helix-ids.ts";
import { SYSTEM } from "../lib/gemini.ts";
import { STANDING_RESEARCH_RULES } from "../lib/research-lessons.ts";
import { systemForDevice, songResearchInstructions, systemForCustomSound, customSoundInstructions, jsonSchemaHint } from "../lib/preset-schema.ts";

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

  it("scores an exact TS808 alias at 100 and names the Line 6 model", () => {
    const hits = findEquivalents("TS808");
    assert.equal(hits[0]?.modelId, "scream-808");
    assert.equal(hits[0]?.score, 100);
    assert.match(hits[0]?.reason ?? "", /Line 6 model:/);
    assert.equal(findEquivalents("zzzxqvnotapedal").length, 0);
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
    assert.match(prompt, /solo is almost never the rhythm tone/i);
    assert.match(prompt, /session tech/i);
    assert.match(prompt, /guitar\/pickups/i);
    assert.match(prompt, /A\/Bs against the RECORD/);
    assert.match(prompt, /Set every knob that shapes this tone/);
    assert.match(prompt, /8 = dotted eighth/);
    assert.equal(/Scale 5/.test(prompt), false);
    assert.match(prompt, /Unknown rock song/);
    assert.match(prompt, /GATE:/);
    assert.match(prompt, /cali-q-graphic/);
    assert.match(prompt, /cali-iv-rhythm-1/);
    assert.match(prompt, /pedal platform/);
    assert.match(prompt, /CLEAN OPENING/);
    assert.match(prompt, /SINGING FUZZ/);
    assert.match(prompt, /SATURATING ECHO/);
    assert.match(prompt, /NEVER stupor-od \(that is the SD-1\)/);
    assert.match(prompt, /EQ follows the record/);
    assert.match(prompt, /SINGING FUZZ: a Big Muff has Sustain, Tone, Level only \(no Mid knob\); keep Tone near 4–5/);
    assert.match(prompt, /TIGHT CHUG: TS tightener/);
  });

  it("asks for the tracked rig before any model id", () => {
    const brief = songResearchInstructions("Black Hole Sun", "Soundgarden", "guitar");
    assert.match(brief, /Black Hole Sun by Soundgarden/);
    assert.match(brief, /TRACKED on the record/);
    assert.match(brief, /Listener test/);
    assert.match(brief, /album title, year, studio, producer/);
    assert.match(brief, /tone fingerprint/);
    assert.match(brief, /unknown_song/);
    // Tone rules live once, in the device system prompt (song and revise both send it).
    const sys = systemForDevice("hx-stomp", "guitar");
    assert.match(sys, /paramOverrides/);
    assert.match(sys, /noise-gate/);
    assert.match(sys, /dedicated EQ/);
    assert.match(sys, /CLEAN OPENING: snapshot 1 is the recorded opening/);
  });

  it("says each tone rule once across the whole step-2 prompt", () => {
    const all = [
      systemForDevice("hx-stomp", "guitar"),
      songResearchInstructions("Black Hole Sun", "Soundgarden", "guitar", undefined, "lead"),
      jsonSchemaHint(),
    ].join("\n");
    for (const re of [/GATE:/g, /CLEAN OPENING/g, /SINGING FUZZ/g, /SATURATING ECHO/g, /TIGHT CHUG/g, /PEDAL PLATFORM/g, /NAMES \(/g, /Likely —/g, /BOSS CE-2/g, /NEVER stupor-od/g, /8 = dotted eighth/g]) {
      assert.equal(all.match(re)?.length ?? 0, 1, String(re));
    }
  });

  it("gates only hot rigs, as the finisher does", () => {
    const sys = systemForDevice("hx-stomp", "guitar");
    assert.match(sys, /GATE: noise-gate in front of the amp only for a high-gain amp \(or amp Drive ≥ 4\.5\) or a drive\/fuzz with its gain at 6\+/);
    assert.match(sys, /low-gain overdrive or Klon on a clean amp gets no gate/);
  });

  it("gives the unit's own snapshot count, keeps the solo, and maps footswitches from it", () => {
    const stomp = systemForDevice("hx-stomp", "guitar");
    assert.match(stomp, /SNAPSHOTS \(at most 3\)/);
    assert.match(stomp, /solo \/ lead part is always one of the 3/);
    assert.match(stomp, /FS 1–3 = action "snapshot"/);
    assert.match(stomp, /No spare switches/);
    assert.equal(/GATE, then EQ/.test(stomp), false);
    const xl = systemForDevice("hx-stomp-xl", "guitar");
    assert.match(xl, /FS 1–4 = action "snapshot"/);
    assert.match(xl, /Spare FS 5\+ = action "bypass" for GATE, then EQ, then WAH/);
    assert.match(systemForDevice("helix-floor", "guitar"), /SNAPSHOTS \(at most 8\)/);
    assert.equal(/kinky-boost on for that snapshot/.test(systemForDevice("hx-stomp", "bass")), false);
  });

  it("keeps the step-2 song prompt inside its size budget (the owner pays per input token)", () => {
    // Oct 2026: 50.6k chars before the dedupe (catalog 26.5k, rules 24k). Raise only on purpose.
    for (const unit of ["hx-stomp", "helix-floor"] as const) {
      const catalog = compactCatalogForPrompt("guitar", unit);
      const rules = [
        SYSTEM,
        systemForDevice(unit, "guitar"),
        STANDING_RESEARCH_RULES,
        songResearchInstructions("Sweet Child O' Mine", "Guns N' Roses", "guitar", undefined, "lead"),
        jsonSchemaHint(),
      ].join("\n");
      assert.ok(catalog.length < 21500, `${unit} catalog ${catalog.length}`);
      assert.ok(rules.length < 13000, `${unit} rules ${rules.length}`);
    }
  });

  it("names only stand-in ids the model can see in the catalog", () => {
    for (const unit of ["hx-stomp", "helix-floor"] as const) {
      const sys = systemForDevice(unit, "guitar");
      const stand = sys.slice(sys.indexOf("HX stand-ins"));
      const catalog = compactCatalogForPrompt("guitar", unit) + "\n" + compactCatalogForPrompt("bass", unit);
      const ids = [...new Set(stand.match(/→ [a-z0-9]+(?:-[a-z0-9]+)+/g) ?? [])].map((m) => m.slice(2));
      assert.ok(ids.length > 20);
      // echo-platter-legacy (Echorec) is the only Echo Platter; the catalog filter change that lists it lands separately.
      const missing = ids.filter((id) => id !== "echo-platter-legacy" && !catalog.includes(`- ${id}|`));
      assert.deepEqual(missing, [], unit);
    }
  });

  it("custom sound prompt invents a rig instead of copying a record", () => {
    const prompt = systemForCustomSound("hx-stomp", "guitar");
    assert.match(prompt, /not a song replica/i);
    assert.match(prompt, /Do not research a similar song/);
    assert.equal(/A\/Bs against the RECORD/.test(prompt), false);
    const brief = customSoundInstructions("Klon into a Deluxe, slapback, Strat neck", "guitar");
    assert.match(brief, /CUSTOM SOUND/);
    assert.match(brief, /Klon into a Deluxe/);
    assert.match(brief, /not a song/);
    const gilmour = customSoundInstructions("Klon into a Deluxe, slapback, Strat neck", "guitar", undefined, "both", "David Gilmour");
    assert.match(gilmour, /David Gilmour/);
    assert.match(gilmour, /Optional player/);
  });

  it("tells HX Effects it has no amp or cab", () => {
    const fx = systemForDevice("hx-effects", "guitar");
    assert.match(fx, /NO amp, cab, preamp, or IR/);
    assert.equal(/One amp/.test(fx), false);
  });

  it("names a based-on original for every catalog model", () => {
    for (const m of ALL_MODELS) {
      assert.ok(m.basedOn.trim().length >= 3, m.id);
      assert.ok(m.description.trim().length >= 12, `${m.id} missing description`);
    }
  });

  it("omits amp and cab from HX Effects catalog prompts", () => {
    const fx = compactCatalogForPrompt("guitar", "hx-effects");
    assert.equal(fx.includes("amp-guitar") || fx.includes("# Guitar Amps"), false);
    assert.equal(/cali-rectifire|essex-a30|4x12-cali-v30/.test(fx), false);
    assert.match(fx, /deez-one-vintage/);
    assert.match(fx, /- deez-one-vintage\|[^\n]*Drive,Level,Tone/);
  });

  it("lists factory knobs on guitar amps so Google cannot leave them at 5", () => {
    const gtr = compactCatalogForPrompt("guitar", "hx-stomp");
    // Each amp row carries HX Edit's own knob names (Fullerton has two drive knobs).
    assert.match(gtr, /# Guitar Amps/);
    assert.match(gtr, /- cali-iv-rhythm-2\|[^\n]*Drive/);
    assert.match(gtr, /- fullerton-nrm\|[^\n]*Drive Norm/);
  });

  it("omits wah models when the player has a real pedal", () => {
    const withWah = compactCatalogForPrompt("guitar", "hx-stomp");
    const noWah = compactCatalogForPrompt("guitar", "hx-stomp", { omitWah: true });
    assert.match(withWah, /teardrop-310/);
    assert.equal(/teardrop-310|uk-wah-846|# Wah/.test(noWah), false);
    assert.match(noWah, /deez-one-vintage/);
  });

  it("adds a short character hint on amps so unknown metal is not always a Recto", () => {
    const gtr = compactCatalogForPrompt("guitar", "hx-stomp");
    assert.match(gtr, /cali-rectifire\|/);
    assert.match(gtr, /us-double-nrm\|Fender Twin Reverb/);
  });

  it("does not leak Teen Spirit model ids into the JSON schema example", () => {
    const hint = jsonSchemaHint();
    assert.equal(/deez-one-vintage|70s-chorus|cali-iv-rhythm-1|cali-iv-rhythm-2/.test(hint), false);
    assert.match(hint, /catalog-id/);
    assert.match(hint, /Do not copy the example modelIds/);
    assert.match(hint, /fingerprint/);
  });

  it("maps Twin Reverb to us-double, never Deluxe", () => {
    const prompt = systemForDevice("hx-stomp", "guitar");
    assert.match(prompt, /us-double-nrm/);
    assert.match(prompt, /NOT us-deluxe-nrm/);
  });
});

describe("per-unit catalog", () => {
  it("hides amps from HX Effects and poly pitch from POD Go", () => {
    const recto = MODEL_MAP["cali-rectifire"];
    const deez = MODEL_MAP["deez-one-vintage"];
    const poly = MODEL_MAP["poly-pitch"] ?? MODEL_MAP["poly-wham"];
    assert.ok(recto);
    assert.ok(deez);
    assert.equal(modelOnDevice(recto, "hx-effects"), false);
    assert.equal(modelOnDevice(deez, "hx-effects"), true);
    assert.equal(modelOnDevice(recto, "hx-stomp"), true);
    assert.equal(modelOnDevice(deez, "pod-go"), true);
    if (poly) {
      assert.equal(modelOnDevice(poly, "pod-go"), false);
      assert.equal(modelOnDevice(poly, "hx-stomp"), true);
    }
    const fxOnly = catalogModels({ deviceId: "hx-effects", instrument: "guitar" });
    assert.ok(fxOnly.length > 40);
    assert.ok(!fxOnly.some((m) => m.category === "amp-guitar" || m.category === "cab"));
    assert.ok(fxOnly.some((m) => m.id === "deez-one-vintage"));
    const units = devicesForModel(deez).map((d) => d.id);
    assert.ok(units.includes("hx-stomp"));
    assert.ok(units.includes("hx-effects"));
    assert.ok(units.includes("pod-go"));
    const ampUnits = devicesForModel(recto).map((d) => d.id);
    assert.ok(!ampUnits.includes("hx-effects"));
  });

  it("omits L6SPB models from POD Go research prompts", () => {
    const go = compactCatalogForPrompt("guitar", "pod-go");
    assert.equal(/poly-pitch|poly-wham|acoustic-sim/.test(go), false);
    assert.match(go, /deez-one-vintage/);
  });
});

describe("devices", () => {
  it("lists Helix family and marks POD Go as .pgp", () => {
    assert.equal(DEVICE_MAP["helix-floor"].hlxDeviceId, 2162689);
    assert.equal(DEVICE_MAP["helix-lt"].hlxDeviceId, 2162692);
    assert.equal(DEVICE_MAP["hx-effects"].hlxDeviceId, 2162693);
    assert.equal(DEVICE_MAP["hx-effects"].hasAmpCab, false);
    assert.equal(DEVICE_MAP["pod-go"].exportFormat, "pgp");
    assert.equal(DEVICE_MAP["pod-go"].hlxDeviceId, 2162695);
    assert.equal(STOMP_DEVICES.length, 6);
    assert.equal(DEVICE_MAP["helix-floor"].layout, "floor");
    assert.equal(DEVICE_MAP["helix-lt"].layout, "lt");
    assert.equal(DEVICE_MAP["hx-effects"].layout, "effects");
    assert.equal(DEVICE_MAP["pod-go"].layout, "podgo");
    assert.equal(DEVICE_MAP["helix-floor"].footswitches, 12);
    assert.equal(DEVICE_MAP["helix-floor"].snapshots, 8);
    assert.equal(DEVICE_MAP["hx-effects"].maxBlocks, 9);
  });
});
