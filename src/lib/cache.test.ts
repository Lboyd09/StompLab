import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { songCacheKey, songCacheKeyV8 } from "./cache.ts";

describe("songCacheKey", () => {
  it("is v12 and includes guitar role so rhythm/lead do not collide", () => {
    const a = songCacheKey("Sandman", "Metallica", "guitar", "hx-stomp", "frfr", "pedal", "rhythm");
    const b = songCacheKey("Sandman", "Metallica", "guitar", "hx-stomp", "frfr", "pedal", "lead");
    const c = songCacheKey("sandman", "metallica", "guitar", "hx-stomp");
    assert.match(a, /^song\|v12\|/);
    assert.notEqual(a, b);
    assert.match(c, /both$/);
    assert.notEqual(a, songCacheKeyV8("Sandman", "Metallica", "guitar", "hx-stomp", "frfr", "pedal"));
  });
});

describe("hxDonorsFor", () => {
  it("reuses a chain only from an HX amp unit with at least as many snapshots", async () => {
    const { hxDonorsFor } = await import("./cache.ts");
    assert.deepEqual(hxDonorsFor("hx-stomp").sort(), ["helix-floor", "helix-lt", "hx-stomp-xl"]);
    assert.deepEqual(hxDonorsFor("hx-stomp-xl").sort(), ["helix-floor", "helix-lt"]);
    assert.deepEqual(hxDonorsFor("helix-floor"), ["helix-lt"]);
    assert.deepEqual(hxDonorsFor("pod-go"), []);
    assert.deepEqual(hxDonorsFor("hx-effects"), []);
  });
});
