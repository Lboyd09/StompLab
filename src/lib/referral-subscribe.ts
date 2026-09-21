import { getSql } from "@/lib/db";
import { isAdminEmail } from "@/lib/plan";
import {
  applyPolarSubscriptionDiscount,
  ensureReferralDiscountId,
  isRealPolarSubscriptionId,
  lookupPolarSubscription,
  subscriptionStatusIsActive,
} from "@/lib/polar";
import { polarIntervalIsMonth, referrerCountsAsPaid, resolveMonthlySubId } from "@/lib/referral-rules";

type RedemptionRow = {
  referrer_user_id: string;
  subscribe_discount_at: Date | string | null;
};

async function redemptionFor(userId: string): Promise<RedemptionRow | null> {
  try {
    const sql = await getSql();
    const rows = await sql<RedemptionRow>`
      select referrer_user_id, subscribe_discount_at
      from referral_redemptions
      where referred_user_id = ${userId}
      limit 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function referrerEmail(referrerId: string, fallback: string | null): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ email: string | null }>(`select email from "user" where id = $1 limit 1`, [
      referrerId,
    ]);
    const email = String(rows[0]?.email ?? "").trim();
    return email || fallback;
  } catch {
    return fallback;
  }
}

async function referrerPaidMonthlySub(referrerId: string): Promise<{ paid: boolean; monthlySubId: string }> {
  try {
    const sql = await getSql();
    const rows = await sql<{
      paid: boolean;
      plan_interval: string | null;
      polar_subscription_id: string | null;
      subscription_status: string | null;
      email: string | null;
    }>`
      select paid, plan_interval, polar_subscription_id, subscription_status, email
      from entitlements
      where user_id = ${referrerId}
      order by paid desc, updated_at desc
      limit 1
    `;
    const row = rows[0];
    const email = await referrerEmail(referrerId, row?.email ?? null);
    const paid = referrerCountsAsPaid({ paid: row?.paid, email });
    if (!paid) return { paid: false, monthlySubId: "" };

    const storedSub = String(row?.polar_subscription_id ?? "").trim();
    const storedInterval = String(row?.plan_interval ?? "").trim();
    const status = String(row?.subscription_status ?? "");
    const storedOk =
      polarIntervalIsMonth(storedInterval) &&
      isRealPolarSubscriptionId(storedSub) &&
      (!status || subscriptionStatusIsActive(status));

    let lookup: { id: string; interval?: string | null; status?: string | null } | null = null;
    if (!storedOk) {
      const hit = await lookupPolarSubscription({
        email,
        externalId: referrerId,
      });
      if (hit) lookup = { id: hit.id, interval: hit.interval, status: hit.status };
    }

    return {
      paid: true,
      monthlySubId: resolveMonthlySubId({
        planInterval: row?.plan_interval,
        polarSubscriptionId: row?.polar_subscription_id,
        subscriptionStatus: row?.subscription_status,
        lookup,
      }),
    };
  } catch {
    try {
      const email = await referrerEmail(referrerId, null);
      if (isAdminEmail(email)) {
        const hit = await lookupPolarSubscription({ email, externalId: referrerId });
        const monthlySubId = resolveMonthlySubId({
          lookup: hit ? { id: hit.id, interval: hit.interval, status: hit.status } : null,
        });
        return { paid: true, monthlySubId };
      }
    } catch {
      /* ignore */
    }
    return { paid: false, monthlySubId: "" };
  }
}

/** Friend used an invite AND the referrer is currently subscribed (or the admin inbox). */
export async function referredUserGetsMonthOff(userId: string): Promise<boolean> {
  const row = await redemptionFor(userId);
  if (!row) return false;
  const { paid } = await referrerPaidMonthlySub(row.referrer_user_id);
  return paid;
}

/**
 * After a referred friend starts a monthly plan: 50% off the referrer's next
 * monthly invoice. Friend's first invoice is discounted at checkout.
 *
 * Polar applies subscription discounts to the *next* invoice — it will not
 * re-bill the current period. If you are already paying monthly, this is
 * 50% off next month, not a refund of this month.
 */
export async function giftReferrerMonthOff(referredUserId: string, interval: string): Promise<void> {
  if (interval !== "month") return;
  const row = await redemptionFor(referredUserId);
  if (!row || row.subscribe_discount_at) return;
  const { paid, monthlySubId } = await referrerPaidMonthlySub(row.referrer_user_id);
  if (!paid || !monthlySubId) return;
  const discountId = await ensureReferralDiscountId();
  if (!discountId) return;
  const ok = await applyPolarSubscriptionDiscount(monthlySubId, discountId);
  if (!ok) return;
  try {
    const sql = await getSql();
    await sql`
      update referral_redemptions
      set subscribe_discount_at = now()
      where referred_user_id = ${referredUserId} and subscribe_discount_at is null
    `;
  } catch {
    /* column missing on a stale host — Polar already has the discount */
  }
}

/** Referrer just subscribed monthly — apply any pending 50% from friends who already paid. */
export async function giftReferrerPendingDiscounts(
  referrerUserId: string,
  interval: string,
  subscriptionId: string,
): Promise<void> {
  if (interval !== "month" || !isRealPolarSubscriptionId(subscriptionId)) return;
  try {
    const sql = await getSql();
    const pending = await sql<{ referred_user_id: string }>`
      select rr.referred_user_id
      from referral_redemptions rr
      join entitlements e on e.user_id = rr.referred_user_id
      where rr.referrer_user_id = ${referrerUserId}
        and rr.subscribe_discount_at is null
        and e.paid = true
      limit 8
    `;
    if (!pending.length) return;
    const discountId = await ensureReferralDiscountId();
    if (!discountId) return;
    const ok = await applyPolarSubscriptionDiscount(subscriptionId, discountId);
    if (!ok) return;
    await sql`
      update referral_redemptions
      set subscribe_discount_at = now()
      where referrer_user_id = ${referrerUserId} and subscribe_discount_at is null
    `;
  } catch {
    /* ignore — grant already succeeded */
  }
}
