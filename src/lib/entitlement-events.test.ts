import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { useTestDatabase, type Sql } from "./db";
import { findEntitlement } from "./entitlement";
import { grantPaid, paidVerifiedFor, revokeForRefund, revokeSubscription, markSubscriptionCanceled, markSubscriptionLapsed } from "./billing";
import { makeTestDb } from "./test-db";

let sql: Sql;
let pg: Awaited<ReturnType<typeof makeTestDb>>["pg"];

async function addUser(id: string, email: string, verified: boolean) {
  await sql.query(
    `insert into "user" (id, name, email, "emailVerified") values ($1, $2, $3, $4)`,
    [id, id, email, verified],
  );
}

async function addEntitlement(
  userId: string,
  email: string,
  fields: { paid?: boolean; sub?: string; status?: string; periodEnd?: string | null; order?: string } = {},
) {
  await sql.query(
    `insert into entitlements (user_id, email, paid, paid_source, polar_subscription_id, polar_order_id, subscription_status, current_period_end)
     values ($1, $2, $3, 'polar', $4, $5, $6, $7::timestamptz)`,
    [
      userId,
      email,
      fields.paid ?? true,
      fields.sub ?? "",
      fields.order ?? "",
      fields.status ?? "active",
      fields.periodEnd ?? null,
    ],
  );
}

async function row(userId: string) {
  const rows = await sql.query<{ paid: boolean; subscription_status: string; polar_event_at: string | null }>(
    `select paid, subscription_status, polar_event_at::text from entitlements where user_id = $1`,
    [userId],
  );
  return rows[0];
}

const PAID_RAW = { type: "order.paid", data: { id: "ord_12345678", status: "paid" } };

before(async () => {
  const db = await makeTestDb();
  sql = db.sql;
  pg = db.pg;
  useTestDatabase(db.sql, db.tx);
});

describe("entitlement by email needs a confirmed email", () => {
  it("a stranger with the payer's billing email gets nothing until that email is verified", async () => {
    await addUser("payer-1", "payer-login@example.com", true);
    await addUser("stranger-1", "billing-1@example.com", false);
    // The payer paid with a different billing email than their login.
    await addEntitlement("payer-1", "billing-1@example.com", { sub: "sub_payer_0001" });

    assert.equal(await findEntitlement(sql, ["stranger-1"], "billing-1@example.com", false), undefined);
    const verified = await findEntitlement(sql, ["stranger-1"], "billing-1@example.com", true);
    assert.equal(verified?.polar_subscription_id, "sub_payer_0001");
  });

  it("a paying customer is found by their own user id, verified or not", async () => {
    const own = await findEntitlement(sql, ["payer-1"], "payer-login@example.com", false);
    assert.equal(own?.polar_subscription_id, "sub_payer_0001");
  });
});

describe("backfill migration 0017", () => {
  it("moves an orphaned row to the only account with that email, and nothing else", async () => {
    await addUser("owner-a", "orphan-a@example.com", false);
    await addEntitlement("gone-user-a", "orphan-a@example.com", { sub: "sub_orphan_a1" });
    // A row that belongs to a real account must stay put, whoever has its email.
    await addUser("real-b", "real-b@example.com", true);
    await addUser("stranger-b", "billing-b@example.com", false);
    await addEntitlement("real-b", "billing-b@example.com", { sub: "sub_real_b001" });
    // Two orphans for one email: ambiguous, so neither moves.
    await addUser("owner-c", "orphan-c@example.com", false);
    await addEntitlement("gone-c1", "orphan-c@example.com", { sub: "sub_orphan_c1" });
    await addEntitlement("gone-c2", "orphan-c@example.com", { sub: "sub_orphan_c2" });

    const migration = readFileSync(new URL("../../migrations/0017_entitlement_user_backfill.sql", import.meta.url), "utf8");
    await pg.exec(migration);
    await pg.exec(migration);

    assert.ok(await row("owner-a"));
    assert.equal(await row("gone-user-a"), undefined);
    assert.ok(await row("real-b"));
    assert.equal(await row("stranger-b"), undefined);
    assert.ok(await row("gone-c1"));
    assert.ok(await row("gone-c2"));
    assert.equal(await row("owner-c"), undefined);
  });
});

describe("webhook ordering", () => {
  it("an older event never overwrites a newer state", async () => {
    await addUser("order-1", "order-1@example.com", true);
    const first = await grantPaid({
      userId: "order-1",
      email: "order-1@example.com",
      orderId: "ord_00000001",
      checkoutId: "chk_order_1",
      amountCents: 699,
      customerId: "cus_order_1",
      raw: PAID_RAW,
      subscriptionId: "sub_order_0001",
      interval: "month",
      eventAt: "2026-10-17T12:00:00.000Z",
    });
    assert.equal(first, true);

    // A revoke that Polar produced BEFORE the grant arrives late: ignored.
    await revokeSubscription({
      email: "order-1@example.com",
      subscriptionId: "sub_order_0001",
      eventAt: "2026-10-17T11:00:00.000Z",
      raw: {},
    });
    assert.equal((await row("order-1")).paid, true);
    assert.equal((await row("order-1")).subscription_status, "active");

    // A newer revoke lands.
    await revokeSubscription({
      email: "order-1@example.com",
      subscriptionId: "sub_order_0001",
      eventAt: "2026-10-17T13:00:00.000Z",
      raw: {},
    });
    assert.equal((await row("order-1")).paid, false);
    assert.equal((await row("order-1")).subscription_status, "revoked");

    // The old grant is redelivered after the revoke: it must not bring the plan back.
    const stale = await grantPaid({
      userId: "order-1",
      email: "order-1@example.com",
      orderId: "ord_00000001",
      checkoutId: "chk_order_1",
      amountCents: 699,
      customerId: "cus_order_1",
      raw: PAID_RAW,
      subscriptionId: "sub_order_0001",
      interval: "month",
      eventAt: "2026-10-17T12:00:00.000Z",
    });
    assert.equal(stale, false);
    assert.equal((await row("order-1")).paid, false);
  });

  it("past_due and a refund end the plan, and a late older cancel does not undo them", async () => {
    await addUser("order-2", "order-2@example.com", true);
    await grantPaid({
      userId: "order-2",
      email: "order-2@example.com",
      orderId: "ord_00000002",
      checkoutId: "chk_order_2",
      amountCents: 699,
      customerId: "cus_order_2",
      raw: PAID_RAW,
      subscriptionId: "sub_order_0002",
      interval: "month",
      eventAt: "2026-10-17T10:00:00.000Z",
    });
    await markSubscriptionLapsed({
      email: "order-2@example.com",
      subscriptionId: "sub_order_0002",
      status: "past_due",
      eventAt: "2026-10-17T11:00:00.000Z",
    });
    assert.deepEqual(
      { paid: (await row("order-2")).paid, status: (await row("order-2")).subscription_status },
      { paid: false, status: "past_due" },
    );
    await markSubscriptionCanceled({
      email: "order-2@example.com",
      subscriptionId: "sub_order_0002",
      eventAt: "2026-10-17T10:30:00.000Z",
      raw: {},
    });
    assert.equal((await row("order-2")).subscription_status, "past_due");
    await revokeForRefund({
      email: "order-2@example.com",
      subscriptionId: "sub_order_0002",
      orderId: "ord_00000002",
      eventAt: "2026-10-17T12:00:00.000Z",
      raw: {},
    });
    assert.equal((await row("order-2")).subscription_status, "refunded");
  });
});

describe("revoking matches the subscription, not a shared or empty email", () => {
  it("an empty email and an unknown subscription touch nothing", async () => {
    await addUser("rev-1", "rev-1@example.com", true);
    await addEntitlement("rev-1", "", { sub: "sub_rev_00001" });
    await addUser("rev-2", "rev-2@example.com", true);
    await addEntitlement("rev-2", "", { sub: "" });
    await revokeSubscription({ email: "", subscriptionId: "sub_never_seen1", raw: {} });
    assert.equal((await row("rev-1")).paid, true);
    assert.equal((await row("rev-2")).paid, true);
  });

  it("an old subscription's revoke cannot kill the newer subscription on the same email", async () => {
    await addUser("rev-3", "shared-rev@example.com", true);
    await addEntitlement("rev-3", "shared-rev@example.com", { sub: "sub_new_rev_01" });
    await revokeSubscription({ email: "shared-rev@example.com", subscriptionId: "sub_old_rev_01", raw: {} });
    assert.equal((await row("rev-3")).paid, true);
    assert.equal((await row("rev-3")).subscription_status, "active");
  });

  it("revokes the row that really holds that subscription", async () => {
    await addUser("rev-4", "rev-4@example.com", true);
    await addEntitlement("rev-4", "rev-4@example.com", { sub: "sub_rev_00004" });
    await revokeSubscription({ email: "", subscriptionId: "sub_rev_00004", raw: {} });
    assert.equal((await row("rev-4")).paid, false);
  });
});

describe("paid access lifetime", () => {
  async function paidFor(userId: string, email: string) {
    const ent = await findEntitlement(sql, [userId], email, false);
    return paidVerifiedFor(userId, email, ent);
  }

  it("canceled stays paid until current_period_end, then stops", async () => {
    await addUser("life-1", "life-1@example.com", true);
    await addEntitlement("life-1", "life-1@example.com", {
      sub: "sub_life_0001",
      status: "canceled",
      periodEnd: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      order: "ord_life_0001",
    });
    assert.equal(await paidFor("life-1", "life-1@example.com"), true);

    await addUser("life-2", "life-2@example.com", true);
    await addEntitlement("life-2", "life-2@example.com", {
      sub: "sub_life_0002",
      status: "canceled",
      periodEnd: new Date(Date.now() - 86_400_000).toISOString(),
      order: "ord_life_0002",
    });
    assert.equal(await paidFor("life-2", "life-2@example.com"), false);
    assert.equal((await row("life-2")).paid, false);
  });

  it("past_due, unpaid and refunded are not active, and an old purchase row cannot bring them back", async () => {
    for (const status of ["past_due", "unpaid", "refunded"]) {
      const id = `life-${status}`;
      await addUser(id, `${id}@example.com`, true);
      await addEntitlement(id, `${id}@example.com`, { sub: `sub_${status}_001`, status, order: `ord_${status}_001` });
      await sql.query(
        `insert into purchases (user_id, email, polar_order_id, polar_checkout_id, amount_cents) values ($1, $2, $3, $4, 699)`,
        [id, `${id}@example.com`, `ord_${status}_001`, `chk_${status}`],
      );
      assert.equal(await paidFor(id, `${id}@example.com`), false, status);
      assert.equal(await paidFor(id, `${id}@example.com`), false, `${status} again`);
    }
  });

  it("an active subscription is paid", async () => {
    await addUser("life-3", "life-3@example.com", true);
    await addEntitlement("life-3", "life-3@example.com", { sub: "sub_life_0003", status: "active" });
    assert.equal(await paidFor("life-3", "life-3@example.com"), true);
  });
});
