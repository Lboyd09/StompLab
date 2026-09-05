export const ADMIN_EMAIL = "liamjamesb09@gmail.com";
/** Business inbox Liam created for Stomp Lab. Also unlocks /admin. */
export const BUSINESS_EMAIL = "stomplab1@gmail.com";
/** Public support inbox. Prefer the Gmail we actually read. */
export const PUBLIC_SUPPORT_EMAIL = "stomplab1@gmail.com";
export const LEGACY_SUPPORT_EMAIL = "hello@stomplab.app";
export const PRICE_MONTHLY_USD = 6.99;
export const PRICE_YEARLY_USD = 75;
export const FREE_BUILDS = 3;
export const PAID_MONTHLY_BUILDS = 50;

/** @deprecated aliases so leftover one-time copy still compiles */
export const PRICE_USD = PRICE_YEARLY_USD;
export const LAUNCH_USD = PRICE_MONTHLY_USD;

export type PlanInterval = "month" | "year";

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function extraOwnerEmails(): string[] {
  if (typeof process === "undefined") return [];
  return [process.env.BUSINESS_EMAIL, process.env.SUPPORT_EMAIL, process.env.CONTACT_EMAIL]
    .map((v) => normalizeEmail(v))
    .filter(Boolean);
}

export function adminEmails(): string[] {
  return [...new Set([ADMIN_EMAIL, BUSINESS_EMAIL, ...extraOwnerEmails()])];
}

/** Admin unlock + Polar-test / business inboxes that must never count as revenue. */
export function ownerEmails(): string[] {
  return [...new Set([ADMIN_EMAIL, BUSINESS_EMAIL, PUBLIC_SUPPORT_EMAIL, LEGACY_SUPPORT_EMAIL, ...extraOwnerEmails()])];
}

/** Exact match only. iCloud, aliases, and session leftovers never unlock admin. */
export function isAdminEmail(email: string | null | undefined) {
  const n = normalizeEmail(email);
  if (!n) return false;
  return adminEmails().includes(n);
}

/** Owner row — Polar tests from this address are not customer revenue. */
export function isOwnerAccount(email: string | null | undefined) {
  const n = normalizeEmail(email);
  if (!n) return false;
  return ownerEmails().includes(n);
}

/** Stats/revenue must drop the owner even when the purchase email is blank. */
export function hideOwnerRow(
  email?: string | null,
  userId?: string | null,
  ownerIds?: Iterable<string> | null,
) {
  if (isOwnerAccount(email)) return true;
  const uid = String(userId ?? "").trim();
  if (!uid || uid === "unmatched" || uid === "revoked" || uid === "test") return true;
  if (ownerIds) {
    for (const id of ownerIds) {
      if (id && id === uid) return true;
    }
  }
  return false;
}

export function yearMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" }).replace(/\.00$/, "");
}

export type Plan = {
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  paid: boolean;
  admin: boolean;
  freeUsed: number;
  freeRemaining: number;
  monthUsed: number;
  monthLimit: number;
  month: string;
  planInterval: PlanInterval | null;
  subscriptionStatus: string;
  canResearch: boolean;
  canCreate: boolean;
  canHistory: boolean;
  canGear: boolean;
  canXlRegen: boolean;
  canLockerSync: boolean;
  canSharedLibrary: boolean;
  blockedReason: "signin" | "paywall" | "quota" | null;
};

export function emptyPlan(): Plan {
  const month = yearMonth();
  return {
    signedIn: false,
    userId: null,
    email: null,
    paid: false,
    admin: false,
    freeUsed: 0,
    freeRemaining: FREE_BUILDS,
    monthUsed: 0,
    monthLimit: FREE_BUILDS,
    month,
    planInterval: null,
    subscriptionStatus: "",
    canResearch: false,
    canCreate: false,
    canHistory: false,
    canGear: false,
    canXlRegen: false,
    canLockerSync: false,
    canSharedLibrary: false,
    blockedReason: "signin",
  };
}

export function assemblePlan(opts: {
  userId: string;
  email: string | null;
  paid: boolean;
  freeUsed: number;
  monthUsed: number;
  planInterval?: PlanInterval | null;
  subscriptionStatus?: string;
}): Plan {
  const month = yearMonth();
  const email = normalizeEmail(opts.email) || opts.email;
  const admin = isAdminEmail(opts.email);
  const paid = admin || opts.paid;
  const freeUsed = opts.freeUsed;
  const freeRemaining = Math.max(0, FREE_BUILDS - freeUsed);
  const monthUsed = opts.monthUsed;
  if (admin) {
    return {
      signedIn: true,
      userId: opts.userId,
      email,
      paid: true,
      admin: true,
      freeUsed,
      freeRemaining: FREE_BUILDS,
      monthUsed,
      monthLimit: 0,
      month,
      planInterval: opts.planInterval ?? null,
      subscriptionStatus: opts.subscriptionStatus || "active",
      canResearch: true,
      canCreate: true,
      canHistory: true,
      canGear: true,
      canXlRegen: true,
      canLockerSync: true,
      canSharedLibrary: false,
      blockedReason: null,
    };
  }
  const canBuild = paid ? monthUsed < PAID_MONTHLY_BUILDS : freeRemaining > 0;
  return {
    signedIn: true,
    userId: opts.userId,
    email,
    paid,
    admin,
    freeUsed,
    freeRemaining,
    monthUsed: paid ? monthUsed : freeUsed,
    monthLimit: paid ? PAID_MONTHLY_BUILDS : FREE_BUILDS,
    month,
    planInterval: paid ? (opts.planInterval ?? null) : null,
    subscriptionStatus: opts.subscriptionStatus ?? "",
    canResearch: canBuild,
    canCreate: canBuild,
    canHistory: true,
    canGear: paid,
    canXlRegen: paid,
    canLockerSync: paid,
    canSharedLibrary: false,
    blockedReason: canBuild ? null : paid ? "quota" : "paywall",
  };
}

export function yearlySavingsUsd() {
  return Math.round((PRICE_MONTHLY_USD * 12 - PRICE_YEARLY_USD) * 100) / 100;
}

export function buildsUsedCopy(plan: Plan): string {
  if (plan.admin) return "Admin — unlimited custom builds. The monthly cap is only for everyone else.";
  if (plan.paid) {
    return `${plan.monthUsed} of ${plan.monthLimit} custom builds used this month. Demos never count.`;
  }
  return `${plan.freeRemaining} of ${FREE_BUILDS} custom builds left.`;
}
