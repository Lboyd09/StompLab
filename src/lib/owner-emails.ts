import { BUSINESS_EMAIL, PUBLIC_SUPPORT_EMAIL, normalizeEmail } from "./plan.ts";

/**
 * Owner inboxes, kept out of plan.ts so the browser bundle never carries them.
 * Import this only from server code (server functions, API routes, billing).
 */
export const ADMIN_EMAIL = "liamjamesb09@gmail.com";
export const LEGACY_SUPPORT_EMAIL = "hello@stomplab.app";

function extraOwnerEmails(): string[] {
  if (typeof process === "undefined") return [];
  return [process.env.BUSINESS_EMAIL, process.env.SUPPORT_EMAIL, process.env.CONTACT_EMAIL]
    .map((v) => normalizeEmail(v))
    .filter(Boolean);
}

/** Polar-test / business inboxes that must never count as revenue. */
export function ownerEmails(): string[] {
  return [...new Set([ADMIN_EMAIL, BUSINESS_EMAIL, PUBLIC_SUPPORT_EMAIL, LEGACY_SUPPORT_EMAIL, ...extraOwnerEmails()])];
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
