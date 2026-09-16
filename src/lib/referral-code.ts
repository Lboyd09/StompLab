export const REFERRAL_BONUS = 1;
export const REFERRAL_CAP = 15;
export const REFERRAL_STORAGE_KEY = "stomplab.ref";

export function normalizeReferralCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

export function captureReferralCode(raw?: string | null) {
  if (typeof window === "undefined") return;
  const code = normalizeReferralCode(raw ?? "");
  if (code.length < 4) return;
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function peekReferralCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

export function clearReferralCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
