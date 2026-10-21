import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEATURED } from "@/data/featured";
import { GEAR_SUGGESTIONS, searchGear } from "@/data/gear-catalog";
import type { Preset, UserGear } from "@/data/types";
import { classifyPickup, playerPickup } from "./pickups";
import { overlayUserGear } from "./preset-schema";
import { cleanUserGear } from "./research";

/** A locker piece exactly as /gear adds it: the catalog's full display name. */
function lockerPiece(kind: UserGear["kind"], name: string, notes = ""): UserGear {
  const hit = GEAR_SUGGESTIONS.find((g) => g.kind === kind && g.name === name);
  assert.ok(hit, `catalog has ${name}`);
  return { id: `g-${name}`, kind, name: hit!.name, notes };
}

function record(): Preset {
  const base = FEATURED.find((p) => p.id === "featured-sandman")!;
  return {
    ...base,
    source: "song",
    instrument: "guitar",
    originalGear: [
      { role: "Guitar", name: "Fender Stratocaster", notes: "bridge pickup" },
      { role: "Amp", name: "Marshall JCM800 2203", notes: "" },
    ],
    recommendedGear: [{ item: "Bridge humbucker", why: "icepick" }],
  };
}

describe("a locker piece added from the new catalog entries", () => {
  const strat = lockerPiece("guitar", "Fender American Ultra Stratocaster");
  const jcm = lockerPiece("amp", "Marshall JCM800 2204");
  const cab = lockerPiece("cab", "Celestion Vintage 30");
  const tumnus = lockerPiece("pedal", "Wampler Tumnus");
  const duncan = lockerPiece("pickup", "Seymour Duncan JB SH-4");
  const bass = lockerPiece("bass", "Music Man StingRay Special 4 HH");
  const locker = [strat, jcm, cab, tumnus, duncan, bass];

  it("goes into the research prompt whole (names and notes survive the trim)", () => {
    const sent = cleanUserGear(locker.map((g) => ({ ...g, notes: g.kind === "pedal" ? "kept on the board" : g.notes })));
    assert.deepEqual(
      sent.map((g) => g.name),
      locker.map((g) => g.name),
    );
    assert.equal(sent.find((g) => g.kind === "pedal")?.notes, "kept on the board");
    for (const g of GEAR_SUGGESTIONS) assert.ok(g.name.length <= 80, `${g.name} fits the prompt trim`);
  });

  it("shows up on the preset as fromLocker: matches the record's guitar, then amp, cab, pedal, pickup", () => {
    const out = overlayUserGear(record(), locker);
    const mine = out.recommendedGear.filter((r) => r.fromLocker);
    const items = mine.map((r) => r.item);
    for (const g of locker.filter((g) => g.kind !== "bass")) assert.ok(items.includes(g.name), g.name);
    assert.equal(items.includes(bass.name), false, "a bass is not offered on a guitar preset");
    const guitar = mine.find((r) => r.item === strat.name)!;
    assert.match(guitar.why, /Closest match to the Fender Stratocaster on the record/);
    assert.match(mine.find((r) => r.item === cab.name)!.why, /4CM/);
    assert.match(mine.find((r) => r.item === tumnus.name)!.why, /FX Loop/);
    // The preset's own tip stays, locker items come first.
    assert.ok(out.recommendedGear.some((r) => r.item === "Bridge humbucker"));
    assert.equal(out.recommendedGear[0].fromLocker, true);
  });

  it("a bass piece lands on a bass preset", () => {
    const p = { ...record(), instrument: "bass" as const, originalGear: [{ role: "Bass", name: "Music Man StingRay", notes: "" }] };
    const out = overlayUserGear(p, locker);
    const hit = out.recommendedGear.find((r) => r.item === bass.name);
    assert.ok(hit?.fromLocker);
    assert.match(hit!.why, /Closest match to the Music Man StingRay/);
  });
});

describe("pickups read from catalog names", () => {
  it("knows pickups the name rules never could", () => {
    assert.equal(classifyPickup("Yamaha SA2200", "Yamaha SA2200"), "humbucker");
    assert.equal(classifyPickup("Harley Benton ST-62", "Harley Benton ST-62"), "single-coil");
    assert.equal(classifyPickup("Sire Larry Carlton H7", "Sire Larry Carlton H7"), "humbucker");
    assert.equal(classifyPickup("Suhr Classic Pro", "Suhr Classic Pro"), "single-coil");
    assert.equal(classifyPickup("PRS SE Silver Sky Stoptail", "PRS SE Silver Sky Stoptail"), "single-coil");
    assert.equal(classifyPickup("Gibson Les Paul Junior Tribute DC", "Gibson Les Paul Junior Tribute DC"), "p90");
    assert.equal(classifyPickup("Epiphone Riviera Custom P93", "Epiphone Riviera Custom P93"), "p90");
    assert.equal(classifyPickup("Seymour Duncan JB SH-4", "Seymour Duncan JB SH-4"), "humbucker");
  });

  it("mixed guitars (HSS, HSH) stay unclassified", () => {
    assert.equal(classifyPickup("Ibanez JEM7V", "Ibanez JEM7V"), null);
    assert.equal(classifyPickup("Charvel Pro-Mod DK24 HSS", "Charvel Pro-Mod DK24 HSS"), null);
    assert.equal(classifyPickup("Fender Player Stratocaster HSS", "Fender Player Stratocaster HSS"), null);
  });

  it("a note about swapped pickups still beats the catalog", () => {
    assert.equal(classifyPickup("Harley Benton ST-62 EMG 81", "Harley Benton ST-62"), "active");
  });

  it("feeds playerPickup for a locker guitar", () => {
    const p = playerPickup([lockerPiece("guitar", "Guild Starfire V")]);
    assert.equal(p?.kind, "humbucker");
    assert.equal(playerPickup([lockerPiece("guitar", "Fender Telecaster Thinline")]), null);
  });

  it("every guitar tag is a pickup kind, and acoustics carry none", () => {
    const kinds = new Set(["single-coil", "p90", "humbucker", "active", "mixed"]);
    for (const g of GEAR_SUGGESTIONS) if (g.pickups) assert.ok(kinds.has(g.pickups), g.name);
    for (const g of GEAR_SUGGESTIONS.filter((x) => x.kind === "guitar" && /^(Taylor|Martin)$/.test(x.brand))) {
      assert.equal(g.pickups, undefined, g.name);
    }
    const tagged = GEAR_SUGGESTIONS.filter((g) => g.kind === "guitar" && g.pickups).length;
    assert.ok(tagged > 600, `tagged guitars: ${tagged}`);
  });

  it("search finds the piece a player would type", () => {
    assert.ok(searchGear("lp", "guitar").slice(0, 3).every((g) => /Les Paul/.test(g.name)));
  });
});
