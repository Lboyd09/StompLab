import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isCompilationAlbum,
  looksLikeJunkTitle,
  looksLikeRealSong,
  matchReleasedRecording,
  rankSongHits,
} from "./song-check.ts";

describe("song check", () => {
  it("rejects keyboard mash and accepts short real titles", () => {
    assert.equal(looksLikeJunkTitle("HhshhsHHHHHhaahhahhshs"), true);
    assert.equal(looksLikeJunkTitle("zzzxqv"), true);
    assert.equal(looksLikeJunkTitle("YYZ"), false);
    assert.equal(looksLikeRealSong("Plush", "Stone Temple Pilots"), true);
    assert.equal(looksLikeRealSong("HhshhsHHHHHhaahhahhshs", "Nope"), false);
  });

  it("confirms a real iTunes row and rejects a miss", () => {
    const hit = matchReleasedRecording("Plush", "Stone Temple Pilots", [
      { trackName: "Plush", artistName: "Stone Temple Pilots", collectionName: "Thank You" },
      { trackName: "Plush", artistName: "Stone Temple Pilots", collectionName: "Core" },
    ]);
    assert.equal(hit?.album, "Core");
    assert.equal(matchReleasedRecording("zzzxqv nonsense song 2026", "NoSuchArtist", []), null);
  });

  it("ranks the studio album above a compilation", () => {
    const ranked = rankSongHits("Plush", [
      { song: "Plush", album: "Thank You" },
      { song: "Plush", album: "Core" },
    ]);
    assert.equal(ranked[0]?.album, "Core");
    assert.equal(isCompilationAlbum("Thank You"), true);
    assert.equal(isCompilationAlbum("Core"), false);
  });
});

describe("rankSongHits originals first", () => {
  it("puts the album original above single covers and acoustic versions", async () => {
    const { rankSongHits } = await import("./song-check.ts");
    const ranked = rankSongHits("Sweet Child O' Mine", [
      { song: "Sweet Child O' Mine", album: "Sweet Child O' Mine - Single" },
      { song: "Sweet Child O' mine (Acoustic)", album: "Some Older Ones - EP" },
      { song: "Sweet Child O' Mine", album: "Appetite for Destruction" },
    ]);
    assert.equal(ranked[0].album, "Appetite for Destruction");
  });
});
