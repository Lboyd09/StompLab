import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { useTestDatabase, type Sql } from "./db";
import { FAILED_BUILDS_PER_DAY, recordFailure, tooManyFailedBuilds } from "./billing";
import { cachedSuggestions, rememberSuggestions, suggestCacheKey } from "./songs";
import { makeTestDb } from "./test-db";

let sql: Sql;

before(async () => {
  const db = await makeTestDb();
  sql = db.sql;
  useTestDatabase(db.sql, db.tx);
});

describe("failed builds cap", () => {
  it("stops a player after 10 failed model calls in a day", async () => {
    for (let i = 0; i < FAILED_BUILDS_PER_DAY - 1; i++) await recordFailure("fail-1", "Song", "Band", "boom");
    assert.equal(await tooManyFailedBuilds("fail-1"), false);
    await recordFailure("fail-1", "Song", "Band", "boom");
    assert.equal(await tooManyFailedBuilds("fail-1"), true);
    assert.equal(await tooManyFailedBuilds("fail-2"), false);
  });

  it("forgets failures older than a day", async () => {
    await sql.query(`update research_failures set created_at = now() - interval '25 hours' where user_id = 'fail-1'`);
    assert.equal(await tooManyFailedBuilds("fail-1"), false);
  });
});

describe("song suggestion cache", () => {
  it("serves a repeated query from memory until it goes stale", () => {
    const key = suggestCacheKey("  Ever  Long ", "guitar");
    assert.equal(key, "guitar|ever long");
    const hits = [{ id: "1", song: "Everlong", artist: "Foo Fighters", album: "", artwork: "" }];
    rememberSuggestions(key, hits, 1_000);
    assert.deepEqual(cachedSuggestions(key, 2_000), hits);
    assert.equal(cachedSuggestions(key, 1_000 + 11 * 60_000), null);
    assert.equal(cachedSuggestions(suggestCacheKey("ever long", "bass"), 2_000), null);
  });
});
