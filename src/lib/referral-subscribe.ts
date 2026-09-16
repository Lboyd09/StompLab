import { getSql } from "@/lib/db";
import {
  applyPolarSubscriptionDiscount,
  ensureReferralDiscountId,
  isRealPolarSubscriptionId,
  subscriptionStatusIsActive,
} from "@/lib/polar";

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

async function referrerPaidMonthlySub(referrerId: string): Promise<{ paid: boolean; monthlySubId: string }> {
  try {
    const sql = await getSql();
    const rows = await sql<{
      paid: boolean;
      plan_interval: string | null;
      polar_subscription_id: string | null;
      subscription_status: string | null;
    }>`
      select paid, plan_interval, polar_subscription_id, subscription_status
      from entitlements
      where user_id = ${referrerId}
      order by paid desc, updated_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row?.paid) return { paid: false, monthlySubId: "" };
    const interval = String(row.plan_interval ?? "").toLowerCase();
    const status = String(row.subscription_status ?? "");
    const sub = String(row.polar_subscription_id ?? "").trim();
    const monthly =
      interval === "month" &&
      isRealPolarSubscriptionId(sub) &&
      (!status || subscriptionStatusIsActive(status));
    return { paid: true, monthlySubId: monthly ? sub : "" };
  } catch {
    return { paid: false, monthlySubId: "" };
  }
}

/** Friend used an invite AND the referrer is currently subscribed. */
export async function referredUserGetsMonthOff(userId: string): Promise<boolean> {
  const row = await redemptionFor(userId);
  if (!row) return false;
  const { paid } = await referrerPaidMonthlySub(row.referrer_user_id);
  return paid;
}

/**
 * After a referred friend starts a monthly plan: 50% off the referrer's next
 * monthly invoice. Friend's first invoice is discounted at checkout.
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
