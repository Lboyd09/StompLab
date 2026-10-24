import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_IDS } from "@/data/featured";
import { demosFor, rigBlocks, rigKnobs, welcomeDemo } from "./demo-rig";

describe("first-run demo rig", () => {
  const demo = welcomeDemo();

  it("uses a free demo whose switches light different pedals", () => {
    assert.ok((DEMO_IDS as readonly string[]).includes(demo.id));
    const lit = demo.snapshots.map((_, i) => rigBlocks(demo, i).filter((b) => b.on).map((b) => b.id).join(","));
    assert.equal(new Set(lit).size, demo.snapshots.length, "each switch should look different");
  });

  it("names blocks from the catalog, never a raw model id", () => {
    for (const b of rigBlocks(demo, 0)) assert.notEqual(b.name, demo.blocks.find((x) => x.id === b.id)?.modelId);
  });

  it("flags knobs that move between switches", () => {
    const first = rigKnobs(demo, 0);
    assert.ok(first.length > 0);
    assert.ok(first.every((k) => !k.changed));
    assert.ok(rigKnobs(demo, 1, 0).some((k) => k.changed));
  });

  it("never offers a paid featured rig to bass players", () => {
    const { demos, fallback } = demosFor("bass");
    assert.ok(demos.length > 0);
    assert.ok(demos.every((p) => (DEMO_IDS as readonly string[]).includes(p.id)));
    assert.equal(typeof fallback, "boolean");
  });
});
