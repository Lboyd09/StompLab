import type { SqlTx } from "./db";
import { REFERRAL_CAP } from "./referral-code";

export type ReferralClaim = "claimed" | "full" | "already";

/**
 * Take one of a referrer's friend slots for this new account. The cap check and
 * the insert run in one transaction behind a per-referrer lock, so five friends
 * redeeming at once still add up to REFERRAL_CAP and no more.
 */
export async function claimReferralSlot(
  tx: SqlTx,
  referrerId: string,
  referredId: string,
  cap = REFERRAL_CAP,
): Promise<ReferralClaim> {
  return tx(async (sql) => {
    await sql.query(`select pg_advisory_xact_lock(hashtext($1))`, [`ref:${referrerId}`]);
    const mine = await sql.query(`select 1 from referral_redemptions where referred_user_id = $1 limit 1`, [referredId]);
    if (mine.length) return "already" as const;
    const used = await sql.query<{ n: number }>(
      `select count(*)::int as n from referral_redemptions where referrer_user_id = $1`,
      [referrerId],
    );
    if (!used.length) throw new Error("referral count unreadable");
    if (Number(used[0]?.n ?? 0) >= cap) return "full" as const;
    await sql.query(`insert into referral_redemptions (referred_user_id, referrer_user_id) values ($1, $2)`, [
      referredId,
      referrerId,
    ]);
    return "claimed" as const;
  });
}
