import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { useTestDatabase, type Sql } from "./db";
import { FAILED_BUILDS_PER_DAY, freeBuildUserIds, loadPlan, recordFailure, reserveBuildSlot, tooManyFailedBuilds } from "./billing";
import { gmailAliasTaken } from "./closed-accounts";
import { canonicalEmail, canonicalEmailSql } from "./referral-code";
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

describe("Gmail aliases share one free allowance", () => {
  it("the SQL canonical form matches canonicalEmail()", async () => {
    for (const email of ["Stomp.Lab1+x@Gmail.com", "a.b@googlemail.com", "Joe.Smith+1@icloud.com", " x@y.com "]) {
      const rows = await sql.query<{ c: string }>(`select ${canonicalEmailSql("$1::text")} as c`, [email]);
      assert.equal(rows[0]?.c, canonicalEmail(email), email);
    }
  });

  it("groups dot and +tag spellings for free builds, and refuses a new alias sign-up", async () => {
    await sql.query(`insert into "user" (id, name, email, "emailVerified") values ('alias-1', 'a', 'riff.player@gmail.com', true)`);
    await sql.query(`insert into "user" (id, name, email, "emailVerified") values ('alias-2', 'b', 'riffplayer+2@gmail.com', true)`);
    await sql.query(`insert into "user" (id, name, email, "emailVerified") values ('other-1', 'c', 'riffplayer@icloud.com', true)`);
    const ids = (await freeBuildUserIds("alias-2", "riffplayer+2@gmail.com")).sort();
    assert.deepEqual(ids, ["alias-1", "alias-2"]);
    assert.equal(await gmailAliasTaken("r.i.f.f.player+3@gmail.com"), true);
    assert.equal(await gmailAliasTaken("new.player@gmail.com"), false);
    assert.equal(await gmailAliasTaken("riffplayer@icloud.com"), false);
  });
});

describe("a refund on another server instance", () => {
  it("is seen when the build slot is taken, not two minutes later", async () => {
    await sql.query(`insert into "user" (id, name, email, "emailVerified") values ('stale-1', 's', 'stale@example.com', true)`);
    await sql.query(
      `insert into entitlements (user_id, email, paid, paid_source, polar_order_id, polar_subscription_id, subscription_status)
       values ('stale-1', 'stale@example.com', true, 'polar', 'ord_stale_0001', 'sub_stale_0001', 'active')`,
    );
    for (let i = 0; i < 3; i++) {
      await sql.query(
        `insert into build_events (user_id, kind, song, year_month, status) values ('stale-1', 'song', 's', '2000-01', 'confirmed')`,
      );
    }
    const stale = await loadPlan("stale-1", "stale@example.com");
    assert.equal(stale.paid, true);
    // The refund lands without this instance's cache hearing about it.
    await sql.query(`update entitlements set paid = false, subscription_status = 'refunded' where user_id = 'stale-1'`);
    const slot = await reserveBuildSlot({ userId: "stale-1", email: "stale@example.com", plan: stale, kind: "song", song: "x" });
    assert.deepEqual(slot, { ok: false, reason: "paywall" });
  });
});
