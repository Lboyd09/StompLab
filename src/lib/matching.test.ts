import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { FEATURED } from "@/data/featured";
import { lookupSongCache, songCacheKey } from "./cache";
import { useTestDatabase, type Sql } from "./db";
import { matchFeatured } from "./research";
import { makeTestDb } from "./test-db";

const hit = (song: string, artist: string | undefined) => matchFeatured(song, artist, "guitar", "hx-stomp");

describe("featured demo matching needs the artist", () => {
  it("still matches the real demos", () => {
    assert.ok(hit("Enter Sandman", "Metallica"));
    assert.ok(hit("Enter Sandman", undefined));
    assert.ok(hit("Higher", "Creed"));
    assert.ok(hit("Smells Like Teen Spirit", "Nirvana"));
    // A shorter title is fine when the artist is the demo's artist.
    assert.ok(hit("Sandman", "Metallica"));
    assert.ok(hit("Teen Spirit", "Nirvana"));
  });

  it("a different song that shares a word does not get the demo rig", () => {
    assert.equal(hit("Sandman", "America"), null);
    assert.equal(hit("Higher Love", "Steve Winwood"), null);
    assert.equal(hit("Enter Sandman", "Sandman Slim"), null);
    // A partial title with no artist cannot say which song it means.
    assert.equal(hit("Sandman", undefined), null);
    assert.equal(hit("Higher Love", undefined), null);
  });

  it("has the demos the checks above rely on", () => {
    assert.ok(FEATURED.some((p) => p.song === "Enter Sandman" && p.artist === "Metallica"));
    assert.ok(FEATURED.some((p) => p.song === "Higher" && p.artist === "Creed"));
  });
});

describe("shared song cache needs the artist", () => {
  let sql: Sql;
  const sandman = FEATURED.find((p) => p.song === "Enter Sandman")!;

  before(async () => {
    const db = await makeTestDb();
    sql = db.sql;
    useTestDatabase(db.sql, db.tx);
    const key = songCacheKey("Creep", "Radiohead", "guitar", "hx-stomp", "frfr", "pedal", "both");
    await sql.query(
      `insert into rig_cache (cache_key, kind, song, artist, instrument, stomp_model, preset)
       values ($1, 'song', 'Creep', 'Radiohead', 'guitar', 'hx-stomp', $2::jsonb)`,
      [key, JSON.stringify({ ...sandman, song: "Creep", artist: "Radiohead" })],
    );
  });

  const lookup = (artist: string | undefined, playbackTarget = "frfr") =>
    lookupSongCache({ song: "Creep", artist, instrument: "guitar", stompModel: "hx-stomp", playbackTarget, wahMode: "pedal", guitarRole: "both" });

  it("hits for the same song and artist", async () => {
    assert.equal((await lookup("Radiohead")).hit, true);
  });

  it("the loose fallback also needs the same artist", async () => {
    // Different playback target: the exact key misses, so the fallback runs.
    assert.equal((await lookup("Radiohead", "pa")).hit, true);
    assert.equal((await lookup("TLC", "pa")).hit, false);
    assert.equal((await lookup("TLC")).hit, false);
  });

  it("no artist means no hit", async () => {
    assert.equal((await lookup(undefined)).hit, false);
    assert.equal((await lookup("")).hit, false);
  });
});
