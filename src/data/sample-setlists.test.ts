import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MODEL_MAP } from "./catalog.ts";
import { SAMPLE_SETLISTS } from "./sample-setlists.ts";

describe("sample setlists", () => {
  it("only reference real catalog models and carry three named parts", () => {
    for (const set of SAMPLE_SETLISTS) {
      assert.equal(set.songs.length, 6);
      for (const song of set.songs) {
        assert.equal(song.parts.length, 3, song.title);
        for (const b of song.chain) assert.ok(MODEL_MAP[b.modelId], `${song.title}: ${b.modelId}`);
      }
    }
  });
});
