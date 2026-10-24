import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { useTestDatabase, type Sql } from "./db";
import { checkoutReplayState, grantPaid, paidVerifiedFor, revokeForRefund } from "./billing";
import { findEntitlement } from "./entitlement";
import { makeTestDb } from "./test-db";

let sql: Sql;

before(async () => {
  const db = await makeTestDb();
  sql = db.sql;
  useTestDatabase(db.sql, db.tx);
});

async function addUser(id: string, email: string) {
  await sql.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, true)`, [id, id, email]);
}

const CHECKOUT_RAW = { type: "checkout.updated", id: "chk_old", status: "succeeded" };

describe("an old /upgrade?checkout_id link", () => {
  it("does not bring back a refunded plan", async () => {
    await addUser("replay-1", "replay1@example.com");
    await grantPaid({
      userId: "replay-1",
      email: "replay1@example.com",
      orderId: "ord_replay_0001",
      checkoutId: "chk_old_0001",
      amountCents: 699,
      customerId: "cus_1",
      raw: CHECKOUT_RAW,
      subscriptionId: "sub_replay_0001",
      interval: "month",
      eventAt: "2026-10-01T10:00:00Z",
    });
    await revokeForRefund({
      email: "replay1@example.com",
      subscriptionId: "sub_replay_0001",
      eventAt: "2026-10-05T10:00:00Z",
      raw: {},
    });
    const state = await checkoutReplayState(sql, {
      ids: ["replay-1"],
      checkoutId: "chk_old_0001",
      checkoutAt: "2026-10-01T10:00:00Z",
    });
    assert.equal(state, "stale");
  });

  it("refuses an unrecorded checkout older than the revoke", async () => {
    await addUser("replay-2", "replay2@example.com");
    await sql.query(
      `insert into entitlements (user_id, email, paid, paid_source, subscription_status, polar_event_at)
       values ('replay-2', 'replay2@example.com', false, 'polar', 'revoked', '2026-10-05T10:00:00Z')`,
    );
    assert.equal(
      await checkoutReplayState(sql, { ids: ["replay-2"], checkoutId: "chk_x_0002", checkoutAt: "2026-10-01T00:00:00Z" }),
      "stale",
    );
    assert.equal(
      await checkoutReplayState(sql, { ids: ["replay-2"], checkoutId: "chk_x_0002", checkoutAt: null }),
      "stale",
    );
  });

  it("lets a new checkout after the plan ended subscribe again", async () => {
    assert.equal(
      await checkoutReplayState(sql, { ids: ["replay-2"], checkoutId: "chk_new_0002", checkoutAt: "2026-10-20T00:00:00Z" }),
      null,
    );
  });

  it("a recorded checkout on an active plan grants nothing new", async () => {
    await addUser("replay-3", "replay3@example.com");
    await grantPaid({
      userId: "replay-3",
      email: "replay3@example.com",
      orderId: "ord_replay_0003",
      checkoutId: "chk_live_0003",
      amountCents: 699,
      customerId: "cus_3",
      raw: CHECKOUT_RAW,
      subscriptionId: "sub_replay_0003",
      interval: "month",
      eventAt: "2026-10-01T10:00:00Z",
    });
    assert.equal(
      await checkoutReplayState(sql, { ids: ["replay-3"], checkoutId: "chk_live_0003", checkoutAt: "2026-10-01T10:00:00Z" }),
      "recorded",
    );
    assert.equal(
      await checkoutReplayState(sql, { ids: ["replay-3"], checkoutId: "chk_first_0003", checkoutAt: null }),
      null,
    );
  });

  it("an old event time cannot overwrite a newer refund", async () => {
    const applied = await grantPaid({
      userId: "replay-1",
      email: "replay1@example.com",
      orderId: "ord_replay_0001",
      checkoutId: "chk_old_0001",
      amountCents: 699,
      customerId: "cus_1",
      raw: CHECKOUT_RAW,
      subscriptionId: "sub_replay_0001",
      interval: "month",
      eventAt: "2026-10-01T10:00:00Z",
    });
    assert.equal(applied, false);
    const ent = await findEntitlement(sql, ["replay-1"], "replay1@example.com", true);
    assert.equal(await paidVerifiedFor("replay-1", "replay1@example.com", ent), false);
  });
});
