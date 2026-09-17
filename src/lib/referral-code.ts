export const REFERRAL_BONUS = 3;
export const REFERRAL_CAP = 15;
/** Paid invite → friend starts a monthly plan: one invoice at this percent off. */
export const REFERRAL_SUBSCRIBE_PERCENT = 50;
export const REFERRAL_STORAGE_KEY = "stomplab.ref";

export function normalizeReferralCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

/** Gmail dots and +tags don't make a second person. */
export function canonicalEmail(email: string | null | undefined): string {
  const raw = (email ?? "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at < 1) return raw;
  let local = raw.slice(0, at);
  let domain = raw.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0]?.replace(/\./g, "") ?? local;
  }
  return `${local}@${domain}`;
}

export function invitePath(code: string) {
  const c = normalizeReferralCode(code);
  return c ? `/join?ref=${encodeURIComponent(c)}` : "/join";
}

export function inviteUrl(origin: string, code: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}${invitePath(code)}`;
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
