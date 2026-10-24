import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RESERVATION_TTL_MINUTES,
  confirmBuild,
  paidBonusRemaining,
  releaseBuild,
  reserveBuild,
  type ReserveInput,
} from "./build-quota";
import type { Sql, SqlTx } from "./db";
import { claimReferralSlot } from "./referral-claim";
import { makeTestDb } from "./test-db";

const base = (userId: string, over: Partial<ReserveInput> = {}): ReserveInput => ({
  userId,
  ids: [userId],
  kind: "song",
  song: "Test Song",
  paid: false,
  admin: false,
  month: "2026-10",
  ...over,
});

async function seed(sql: Sql, userId: string, n: number, over: { status?: string; month?: string; minutesAgo?: number } = {}) {
  for (let i = 0; i < n; i += 1) {
    await sql.query(
      `insert into build_events (user_id, kind, song, year_month, status, created_at)
       values ($1, 'song', 'seed', $2, $3, now() - ($4::int * interval '1 minute'))`,
      [userId, over.month ?? "2026-10", over.status ?? "confirmed", over.minutesAgo ?? 0],
    );
  }
}

async function count(sql: Sql, userId: string, status?: string) {
  const rows = status
    ? await sql.query<{ n: number }>(`select count(*)::int as n from build_events where user_id = $1 and status = $2`, [userId, status])
    : await sql.query<{ n: number }>(`select count(*)::int as n from build_events where user_id = $1`, [userId]);
  return rows[0].n;
}

describe("reserve, confirm, release", () => {
  it("two builds at once cannot both take the last free slot", async () => {
    const { sql, tx } = await makeTestDb();
    await seed(sql, "free-1", 2);
    const results = await Promise.all([reserveBuild(tx, base("free-1")), reserveBuild(tx, base("free-1"))]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    const refused = results.find((r) => !r.ok);
    assert.deepEqual(refused, { ok: false, reason: "paywall" });
    assert.equal(await count(sql, "free-1"), 3);
  });

  it("a paid player at 49 of 50 gets exactly one more when two arrive together", async () => {
    const { sql, tx } = await makeTestDb();
    await seed(sql, "paid-1", 49);
    const results = await Promise.all([
      reserveBuild(tx, base("paid-1", { paid: true })),
      reserveBuild(tx, base("paid-1", { paid: true })),
      reserveBuild(tx, base("paid-1", { paid: true })),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.deepEqual(results.find((r) => !r.ok), { ok: false, reason: "quota" });
  });

  it("a failed build releases its slot, and a confirmed one keeps it", async () => {
    const { sql, tx } = await makeTestDb();
    await seed(sql, "free-2", 2);
    const first = await reserveBuild(tx, base("free-2"));
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal((await reserveBuild(tx, base("free-2"))).ok, false);
    await releaseBuild(sql, first.reservation);
    assert.equal(await count(sql, "free-2"), 2);

    const second = await reserveBuild(tx, base("free-2"));
    assert.equal(second.ok, true);
    if (!second.ok) return;
    await confirmBuild(sql, second.reservation, "2026-10");
    assert.equal(await count(sql, "free-2", "confirmed"), 3);
    assert.equal(await count(sql, "free-2", "reserved"), 0);
    assert.equal((await reserveBuild(tx, base("free-2"))).ok, false);
  });

  it("a cache hit settles at once and still counts", async () => {
    const { sql, tx } = await makeTestDb();
    const hit = await reserveBuild(tx, base("free-3", { confirmed: true }));
    assert.equal(hit.ok, true);
    assert.equal(await count(sql, "free-3", "confirmed"), 1);
  });

  it("a reservation that never finished stops counting after the window", async () => {
    const { sql, tx } = await makeTestDb();
    await seed(sql, "free-4", 2);
    await seed(sql, "free-4", 1, { status: "reserved", minutesAgo: RESERVATION_TTL_MINUTES + 5 });
    assert.equal((await reserveBuild(tx, base("free-4"))).ok, true);
    await seed(sql, "free-5", 2);
    await seed(sql, "free-5", 1, { status: "reserved", minutesAgo: 1 });
    assert.equal((await reserveBuild(tx, base("free-5"))).ok, false);
  });

  it("fails closed when the count cannot be read", async () => {
    const empty: Sql = Object.assign(async () => [], { query: async () => [] }) as unknown as Sql;
    const blind: SqlTx = (fn) => fn(empty);
    await assert.rejects(() => reserveBuild(blind, base("free-6")), /unreadable/);
    const broken: SqlTx = async () => {
      throw new Error("connection lost");
    };
    await assert.rejects(() => reserveBuild(broken, base("free-6")), /connection lost/);
  });

  it("admins are never capped", async () => {
    const { sql, tx } = await makeTestDb();
    await seed(sql, "admin-1", 80);
    assert.equal((await reserveBuild(tx, base("admin-1", { paid: true, admin: true }))).ok, true);
  });

  it("free players get the invite bonus on top of 3, and it counts for life", async () => {
    const { sql, tx } = await makeTestDb();
    await sql.query(`insert into entitlements (user_id, email, bonus_builds) values ('free-7', '', 3)`);
    await seed(sql, "free-7", 5);
    assert.equal((await reserveBuild(tx, base("free-7"))).ok, true);
    assert.equal((await reserveBuild(tx, base("free-7"))).ok, false);
  });

  it("the invite bonus is one pool for a paid player, not 3 extra every month", async () => {
    const { sql, tx } = await makeTestDb();
    await sql.query(`insert into entitlements (user_id, email, bonus_builds) values ('paid-2', '', 3)`);
    // Last month they used 52: the cap plus 2 of the bonus. One bonus build is left.
    await seed(sql, "paid-2", 52, { month: "2026-09" });
    assert.equal(await paidBonusRemaining(sql, ["paid-2"], "2026-10", 3), 1);
    await seed(sql, "paid-2", 50);
    assert.equal((await reserveBuild(tx, base("paid-2", { paid: true }))).ok, true);
    assert.equal((await reserveBuild(tx, base("paid-2", { paid: true }))).ok, false);

    // Someone who never went over the cap keeps the whole bonus.
    await sql.query(`insert into entitlements (user_id, email, bonus_builds) values ('paid-3', '', 3)`);
    await seed(sql, "paid-3", 30, { month: "2026-09" });
    assert.equal(await paidBonusRemaining(sql, ["paid-3"], "2026-10", 3), 3);
  });

  it("bonus builds used while free do not come back on subscribing", async () => {
    const { sql } = await makeTestDb();
    // 3 free + 2 of the 3 bonus, all before the first payment.
    await seed(sql, "paid-4", 5, { month: "2026-09", minutesAgo: 120 });
    await sql.query(
      `insert into entitlements (user_id, email, bonus_builds, paid, paid_at) values ('paid-4', '', 3, true, now() - interval '1 hour')`,
    );
    assert.equal(await paidBonusRemaining(sql, ["paid-4"], "2026-10", 3), 1);
    // Builds after paying are not free-time builds.
    await seed(sql, "paid-4", 10, { month: "2026-10" });
    assert.equal(await paidBonusRemaining(sql, ["paid-4"], "2026-10", 3), 1);
  });
});

describe("referral friend cap", () => {
  it("five friends redeeming at once still add up to three", async () => {
    const { sql, tx } = await makeTestDb();
    const results = await Promise.all(
      ["f1", "f2", "f3", "f4", "f5"].map((friend) => claimReferralSlot(tx, "referrer-1", friend)),
    );
    assert.equal(results.filter((r) => r === "claimed").length, 3);
    assert.equal(results.filter((r) => r === "full").length, 2);
    const rows = await sql.query<{ n: number }>(
      `select count(*)::int as n from referral_redemptions where referrer_user_id = 'referrer-1'`,
    );
    assert.equal(rows[0].n, 3);
  });

  it("the same friend twice is already redeemed, not a second slot", async () => {
    const { tx } = await makeTestDb();
    assert.equal(await claimReferralSlot(tx, "referrer-2", "same"), "claimed");
    assert.equal(await claimReferralSlot(tx, "referrer-2", "same"), "already");
  });
});
