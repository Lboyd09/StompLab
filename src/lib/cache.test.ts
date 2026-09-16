import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { songCacheKey, songCacheKeyV8 } from "./cache.ts";

describe("songCacheKey", () => {
  it("is v9 and includes guitar role so rhythm/lead do not collide", () => {
    const a = songCacheKey("Sandman", "Metallica", "guitar", "hx-stomp", "frfr", "pedal", "rhythm");
    const b = songCacheKey("Sandman", "Metallica", "guitar", "hx-stomp", "frfr", "pedal", "lead");
    const c = songCacheKey("sandman", "metallica", "guitar", "hx-stomp");
    assert.match(a, /^song\|v9\|/);
    assert.notEqual(a, b);
    assert.match(c, /both$/);
    assert.notEqual(a, songCacheKeyV8("Sandman", "Metallica", "guitar", "hx-stomp", "frfr", "pedal"));
  });
});
