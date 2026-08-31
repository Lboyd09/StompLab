export const ADMIN_EMAIL = "liamjamesb09@gmail.com";
export const PRICE_USD = 29;
export const LAUNCH_USD = 19;
export const FREE_BUILDS = 3;
export const PAID_MONTHLY_BUILDS = 50;

export function isAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function yearMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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
}): Plan {
  const month = yearMonth();
  const paid = opts.paid || isAdminEmail(opts.email);
  const freeUsed = opts.freeUsed;
  const freeRemaining = Math.max(0, FREE_BUILDS - freeUsed);
  const monthUsed = opts.monthUsed;
  const canBuild = paid ? monthUsed < PAID_MONTHLY_BUILDS : freeRemaining > 0;
  return {
    signedIn: true,
    userId: opts.userId,
    email: opts.email,
    paid,
    admin: isAdminEmail(opts.email),
    freeUsed,
    freeRemaining,
    monthUsed: paid ? monthUsed : freeUsed,
    monthLimit: paid ? PAID_MONTHLY_BUILDS : FREE_BUILDS,
    month,
    canResearch: canBuild,
    canCreate: canBuild,
    canHistory: paid,
    canGear: paid,
    canXlRegen: paid,
    canLockerSync: paid,
    canSharedLibrary: paid,
    blockedReason: canBuild ? null : paid ? "quota" : "paywall",
  };
}
