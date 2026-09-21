export const REFERRAL_BONUS = 3;
export const REFERRAL_CAP = 3;
/** Paid invite → friend starts a monthly plan: one invoice at this percent off. */
export const REFERRAL_SUBSCRIBE_PERCENT = 50;
export const REFERRAL_STORAGE_KEY = "stomplab.ref";
export const INVITE_RESULT_KEY = "stomplab.invite.result";

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

export function invitePath(code: string, perk?: "half" | "builds") {
  const c = normalizeReferralCode(code);
  // Straight to Create account. /join still works for older links.
  const base = c ? `/login?mode=up&ref=${encodeURIComponent(c)}` : "/login?mode=up";
  if (perk === "half") return `${base}&perk=half`;
  if (perk === "builds") return `${base}&perk=builds`;
  return base;
}

export function inviteUrl(origin: string, code: string, perk?: "half" | "builds") {
  const base = origin.replace(/\/$/, "");
  return `${base}${invitePath(code, perk)}`;
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

export type InviteClaim = { ok: true; bonus: number } | { ok: false; error: string };

export function isPermanentInviteError(error: string): boolean {
  return /already used|can't invite|maximum|48 hours|before you research|doesn't look right|no account uses/i.test(
    error,
  );
}

/** A later "already used" from a double claim must not wipe a success toast. */
export function mergeInviteResult(prev: InviteClaim | null, next: InviteClaim): InviteClaim {
  if (prev?.ok && !next.ok) return prev;
  return next;
}

export function rememberInviteResult(result: InviteClaim) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(INVITE_RESULT_KEY);
    let prev: InviteClaim | null = null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as InviteClaim;
        if (parsed && typeof parsed === "object" && typeof parsed.ok === "boolean") prev = parsed;
      } catch {
        prev = null;
      }
    }
    window.sessionStorage.setItem(INVITE_RESULT_KEY, JSON.stringify(mergeInviteResult(prev, result)));
  } catch {
    /* ignore */
  }
}

export function takeInviteResult(): InviteClaim | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(INVITE_RESULT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(INVITE_RESULT_KEY);
    const parsed = JSON.parse(raw) as InviteClaim;
    if (!parsed || typeof parsed !== "object" || typeof parsed.ok !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}
