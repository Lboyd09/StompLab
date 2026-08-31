import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { researchLabel } from "./research-progress.ts";

describe("researchLabel", () => {
  it("steps through the load copy", () => {
    assert.equal(researchLabel(0), "Finding the record");
    assert.equal(researchLabel(8), "Finding the record");
    assert.equal(researchLabel(24), "Reading the original rig");
    assert.equal(researchLabel(63), "Programming the Stomp");
    assert.equal(researchLabel(94), "Checking factory models");
  });
});
