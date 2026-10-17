import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purgeExpiredWith } from "./closed-accounts";
import type { Sql } from "./db";
import { makeTestDb } from "./test-db";

async function addUser(sql: Sql, id: string, email: string) {
  await sql.query(`insert into "user" (id, name, email, "emailVerified") values ($1, $1, $2, true)`, [id, email]);
}

async function addHold(sql: Sql, email: string, userId: string, status: string, daysAgo: number) {
  await sql.query(
    `insert into closed_accounts (email_canonical, requested_at, recreate_after, status, user_id)
     values ($1, now() - interval '20 days', now() - ($2::int * interval '1 day'), $3, $4)`,
    [email, daysAgo, status, userId],
  );
}

async function userExists(sql: Sql, id: string) {
  return (await sql.query(`select 1 from "user" where id = $1`, [id])).length > 0;
}

describe("purge of closed accounts", () => {
  it("erases only confirmed holds. An unconfirmed delete request never wipes a live account", async () => {
    const { sql } = await makeTestDb();
    await addUser(sql, "held-due", "held-due@example.com");
    await addUser(sql, "pending-due", "pending-due@example.com");
    await addUser(sql, "held-later", "held-later@example.com");
    await addHold(sql, "held-due@example.com", "held-due", "held", 1);
    await addHold(sql, "pending-due@example.com", "pending-due", "pending_email", 1);
    await addHold(sql, "held-later@example.com", "held-later", "held", -5);

    const result = await purgeExpiredWith(sql, { cancelSubscription: async () => true });

    assert.equal(await userExists(sql, "held-due"), false);
    assert.equal(await userExists(sql, "pending-due"), true);
    assert.equal(await userExists(sql, "held-later"), true);
    assert.deepEqual(result, { wiped: 1, skipped: 0, dropped: 1 });
    const rows = await sql.query<{ email_canonical: string }>(`select email_canonical from closed_accounts`);
    assert.deepEqual(rows.map((r) => r.email_canonical), ["held-later@example.com"]);
  });

  it("cancels a live subscription first, and keeps the account when it cannot be canceled", async () => {
    const { sql } = await makeTestDb();
    await addUser(sql, "sub-ok", "sub-ok@example.com");
    await addUser(sql, "sub-stuck", "sub-stuck@example.com");
    await addUser(sql, "sub-ended", "sub-ended@example.com");
    for (const [id, sub, status] of [
      ["sub-ok", "sub_purge_ok01", "active"],
      ["sub-stuck", "sub_purge_stk1", "active"],
      ["sub-ended", "sub_purge_end1", "canceled"],
    ]) {
      await sql.query(
        `insert into entitlements (user_id, email, paid, paid_source, polar_subscription_id, subscription_status)
         values ($1, $2, true, 'polar', $3, $4)`,
        [id, `${id}@example.com`, sub, status],
      );
      await addHold(sql, `${id}@example.com`, id, "held", 2);
    }
    const canceled: string[] = [];
    const quiet = console.error;
    console.error = () => undefined;
    let result;
    try {
      result = await purgeExpiredWith(sql, {
        cancelSubscription: async (id) => {
          canceled.push(id);
          return id !== "sub_purge_stk1";
        },
      });
    } finally {
      console.error = quiet;
    }

    assert.deepEqual(canceled.sort(), ["sub_purge_ok01", "sub_purge_stk1"]);
    assert.equal(await userExists(sql, "sub-ok"), false);
    assert.equal(await userExists(sql, "sub-ended"), false);
    assert.equal(await userExists(sql, "sub-stuck"), true);
    assert.deepEqual(result, { wiped: 2, skipped: 1, dropped: 0 });
    const left = await sql.query<{ email_canonical: string }>(`select email_canonical from closed_accounts`);
    assert.deepEqual(left.map((r) => r.email_canonical), ["sub-stuck@example.com"]);
  });
});
