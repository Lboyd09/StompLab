import type { Sql } from "./db";
import { normalizeEmail } from "./plan";

export type EntRow = {
  paid: boolean;
  paid_source?: string | null;
  polar_order_id?: string | null;
  polar_subscription_id?: string | null;
  polar_customer_id?: string | null;
  plan_interval?: string | null;
  subscription_status?: string | null;
  email?: string | null;
  current_period_end?: Date | string | null;
};

/**
 * Which entitlement rows belong to this signed-in player. Their own user ids
 * always count. A row that only carries a matching billing email counts only when
 * the account's email is verified: anyone can type a payer's address into the
 * sign-up form, and an unverified address proves nothing.
 *
 * `ids` is $1; the email, when used, is $2.
 */
export function entitlementScope(
  ids: string[],
  email: string | null,
  emailVerified: boolean,
): { where: string; params: unknown[] } {
  const em = normalizeEmail(email);
  if (em && emailVerified) {
    return { where: "(user_id = any($1::text[]) or lower(email) = $2)", params: [ids, em] };
  }
  return { where: "user_id = any($1::text[])", params: [ids] };
}

export async function emailVerifiedFor(sql: Sql, userId: string): Promise<boolean> {
  try {
    const rows = await sql.query<{ verified: boolean | null }>(
      `select "emailVerified" as verified from "user" where id = $1 limit 1`,
      [userId],
    );
    return rows[0]?.verified === true;
  } catch {
    return false;
  }
}

export async function findEntitlement(
  sql: Sql,
  ids: string[],
  email: string | null,
  emailVerified: boolean,
): Promise<EntRow | undefined> {
  const scope = entitlementScope(ids, email, emailVerified);
  try {
    const rows = await sql.query<EntRow>(
      `select paid, paid_source, polar_order_id, polar_subscription_id, polar_customer_id, plan_interval, subscription_status, email, current_period_end
       from entitlements
       where ${scope.where}
       order by paid desc, updated_at desc
       limit 8`,
      scope.params,
    );
    const polar = rows.find((r) => r.paid && String(r.paid_source ?? "").toLowerCase() === "polar");
    return polar ?? rows[0];
  } catch {
    try {
      const rows = await sql.query<EntRow>(
        `select paid, paid_source, polar_order_id, email from entitlements where user_id = any($1::text[])`,
        [ids],
      );
      return rows.find((r) => r.paid) ?? rows[0];
    } catch {
      return undefined;
    }
  }
}
