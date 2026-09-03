export const ADMIN_EMAIL = "liamjamesb09@gmail.com";
export const PRICE_MONTHLY_USD = 6.99;
export const PRICE_YEARLY_USD = 75;
export const FREE_BUILDS = 3;
export const PAID_MONTHLY_BUILDS = 50;

/** @deprecated aliases so leftover one-time copy still compiles */
export const PRICE_USD = PRICE_YEARLY_USD;
export const LAUNCH_USD = PRICE_MONTHLY_USD;

export type PlanInterval = "month" | "year";

/** Exact match only. iCloud, aliases, and session leftovers never unlock admin. */
export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

/** Exact admin email. Polar test checkouts from this address still count as Polar revenue. */
export function isOwnerAccount(email: string | null | undefined) {
  return isAdminEmail(email);
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
  const admin = isAdminEmail(opts.email);
  const paid = admin || opts.paid;
  const freeUsed = opts.freeUsed;
  const freeRemaining = Math.max(0, FREE_BUILDS - freeUsed);
  const monthUsed = opts.monthUsed;
  const canBuild = paid ? monthUsed < PAID_MONTHLY_BUILDS : freeRemaining > 0;
  return {
    signedIn: true,
    userId: opts.userId,
    email: opts.email,
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
