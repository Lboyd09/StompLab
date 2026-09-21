import { isAdminEmail } from "./plan.ts";
import { isRealPolarSubscriptionId, subscriptionStatusIsActive } from "./polar.ts";
import { canonicalEmail, normalizeReferralCode, REFERRAL_CAP } from "./referral-code.ts";

/** Better Auth `"user"."createdAt"` — camelCase, quoted. `created_at` does not exist. */
export const USER_CREATED_AT_QUERY = `select u."createdAt" as created_at from "user" u where id = $1 limit 1`;

export const REFERRAL_NEW_ACCOUNT_MS = 48 * 60 * 60 * 1000;

export type RedeemDecision = { ok: true; already?: boolean } | { ok: false; error: string };

export function parseUserCreatedAt(value: unknown): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const t = Date.parse(value);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** Missing / unreadable signup time must not block an invite. */
export function inviteAgeBlocked(bornMs: number, now = Date.now()): boolean {
  if (!bornMs) return false;
  return now - bornMs > REFERRAL_NEW_ACCOUNT_MS;
}

export function referrerCountsAsPaid(opts: { paid?: boolean | null; email?: string | null }): boolean {
  return Boolean(opts.paid) || isAdminEmail(opts.email);
}

export function polarIntervalIsMonth(interval: string | null | undefined): boolean {
  const v = String(interval ?? "").trim().toLowerCase();
  return v === "month" || v === "monthly";
}

export function polarIntervalIsYear(interval: string | null | undefined): boolean {
  const v = String(interval ?? "").trim().toLowerCase();
  return v === "year" || v === "yearly";
}

export function friendCheckoutGetsReferralDiscount(interval: string, referrerPaid: boolean): boolean {
  return interval === "month" && referrerPaid;
}

export function resolveMonthlySubId(opts: {
  planInterval?: string | null;
  polarSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  lookup?: { id: string; interval?: string | null; status?: string | null } | null;
}): string {
  const storedId = String(opts.polarSubscriptionId ?? "").trim();
  const lookedId = String(opts.lookup?.id ?? "").trim();
  const id = isRealPolarSubscriptionId(storedId)
    ? storedId
    : isRealPolarSubscriptionId(lookedId)
      ? lookedId
      : "";
  if (!id) return "";
  const interval = opts.planInterval || opts.lookup?.interval || "";
  if (polarIntervalIsYear(interval) || !polarIntervalIsMonth(interval)) return "";
  const status = opts.subscriptionStatus || opts.lookup?.status || "";
  if (status && !subscriptionStatusIsActive(status)) return "";
  return id;
}

export function decideRedeem(input: {
  code: string;
  userId: string;
  email: string | null;
  referrerId: string | null;
  referrerEmail: string | null;
  siblingIds: string[];
  existingReferrerId?: string | null;
  createdAt: unknown;
  customBuilds: number;
  referrerUsed: number;
  now?: number;
}): RedeemDecision {
  const code = normalizeReferralCode(input.code);
  if (code.length < 4) return { ok: false, error: "That invite code doesn't look right." };
  if (input.existingReferrerId) {
    if (input.referrerId && input.existingReferrerId === input.referrerId) {
      return { ok: true, already: true };
    }
    return { ok: false, error: "This account already used an invite." };
  }
  if (!input.referrerId) return { ok: false, error: "No account uses that code." };
  if (input.referrerId === input.userId) return { ok: false, error: "You can't invite yourself." };
  if (input.siblingIds.includes(input.referrerId)) return { ok: false, error: "You can't invite yourself." };
  if (input.referrerEmail && input.email && canonicalEmail(input.referrerEmail) === canonicalEmail(input.email)) {
    return { ok: false, error: "You can't invite yourself." };
  }
  if (inviteAgeBlocked(parseUserCreatedAt(input.createdAt), input.now)) {
    return { ok: false, error: "Invites only work on a new account (first 48 hours)." };
  }
  if (input.customBuilds > 0) {
    return { ok: false, error: "Invites only work before you research a custom song." };
  }
  if (input.referrerUsed >= REFERRAL_CAP) {
    return { ok: false, error: "That friend already invited the maximum number of people." };
  }
  return { ok: true };
}

export function mapRedeemSqlError(message: string): string | null {
  const msg = message || "";
  if (/unique|duplicate/i.test(msg)) return "This account already used an invite.";
  if (/column .*does not exist/i.test(msg)) {
    return "Invite storage is updating. Wait a few seconds and try again.";
  }
  return null;
}
