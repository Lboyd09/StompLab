import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, invalidatePlanCache } from "@/lib/billing";
import { adminWipeAccountNow, confirmDeleteHold, requestDeleteHold } from "@/lib/closed-accounts";
import { getSql } from "@/lib/db";
import { isAdminEmail, PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";
import { canonicalEmail } from "@/lib/referral-code";
import {
  cancelPolarSubscription,
  createCustomerPortalSession,
  lookupPolarSubscription,
  polarPublicPortalUrl,
} from "@/lib/polar";
import { publicOrigin } from "@/lib/site-origin";

async function cancelPolarForClosedEmail(email: string, userId?: string | null) {
  const sql = await getSql();
  const canon = canonicalEmail(email);
  let sub = "";
  let customerId = "";
  let uid = userId ?? "";
  try {
    const rows = await sql<{
      polar_subscription_id: string | null;
      polar_customer_id: string | null;
      user_id: string | null;
    }>`
      select polar_subscription_id, polar_customer_id, user_id from entitlements
      where user_id = ${uid || "—"}
         or lower(email) = ${email.toLowerCase()}
         or lower(email) = ${canon}
      order by updated_at desc
      limit 8
    `;
    const row =
      rows.find((r) => String(r.polar_subscription_id ?? "").trim()) ??
      rows.find((r) => String(r.polar_customer_id ?? "").trim()) ??
      rows[0];
    sub = String(row?.polar_subscription_id ?? "").trim();
    customerId = String(row?.polar_customer_id ?? "").trim();
    if (!uid) uid = String(row?.user_id ?? "").trim();
  } catch {
    /* entitlements may be missing columns */
  }
  if (!sub) {
    const looked = await lookupPolarSubscription({
      email: canon || email,
      externalId: uid || undefined,
      customerId: customerId || undefined,
    });
    if (looked) {
      sub = looked.id;
      customerId = looked.customerId || customerId;
    }
  }
  if (sub) await cancelPolarSubscription(sub);
  const origin = (await publicOrigin()).replace(/\/$/, "");
  const portal = await createCustomerPortalSession({
    customerId: customerId || undefined,
    externalCustomerId: uid || undefined,
    email: canon || email,
    returnUrl: `${origin}/`,
  });
  let polarPortalUrl = portal.ok ? portal.url : "";
  if (!polarPortalUrl) polarPortalUrl = await polarPublicPortalUrl();
  return { polarPortalUrl, hadPolar: Boolean(sub || customerId) };
}

export const requestAccountDelete = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const email = await emailFor(context.userId, context.email);
    if (!email) return { ok: false, error: "This account has no email to confirm with." };
    if (isAdminEmail(email)) {
      return {
        ok: false,
        error: "The admin inbox can't be deleted. Cancel the Polar test subscription from Account instead.",
      };
    }
    try {
      return await requestDeleteHold({ userId: context.userId, email });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/mail isn't connected|resend|from-address|verified/i.test(msg)) return { ok: false, error: msg };
      return {
        ok: false,
        error: `Could not send the confirmation email. Email ${PUBLIC_SUPPORT_EMAIL} if it keeps failing.`,
      };
    }
  });

export const confirmAccountDelete = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ token: z.string().min(16).max(128) }).parse(input))
  .handler(async ({ data }): Promise<
    { ok: true; recreateAfter: string; polarPortalUrl?: string } | { ok: false; error: string }
  > => {
    const res = await confirmDeleteHold(data.token);
    if (!res.ok) return res;
    let polarPortalUrl = "";
    try {
      const sql = await getSql();
      const held = await sql<{ user_id: string | null }>`
        select user_id from closed_accounts where email_canonical = ${res.email} limit 1
      `;
      const polar = await cancelPolarForClosedEmail(res.email, held[0]?.user_id);
      polarPortalUrl = polar.polarPortalUrl;
      if (held[0]?.user_id) invalidatePlanCache(held[0].user_id);
    } catch {
      /* Polar cancel is best-effort — the hold is already in place */
    }
    return { ok: true, recreateAfter: res.recreateAfter, polarPortalUrl: polarPortalUrl || undefined };
  });

/** Older clients still POST DELETE — same path: email a confirm link, do not wipe yet. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const email = await emailFor(context.userId, context.email);
    if (!email) return { ok: false as const, error: "This account has no email to confirm with." };
    if (isAdminEmail(email)) {
      return {
        ok: false as const,
        error: "The admin inbox can't be deleted. Cancel the Polar test subscription from Account instead.",
      };
    }
    try {
      return await requestDeleteHold({ userId: context.userId, email });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/mail isn't connected|resend|from-address|verified/i.test(msg)) {
        return { ok: false as const, error: msg };
      }
      return {
        ok: false as const,
        error: `Could not send the confirmation email. Email ${PUBLIC_SUPPORT_EMAIL} if it keeps failing.`,
      };
    }
  });

/** Admin-only: erase someone else's account now. Requires typing DELETE. No 14-day hold. */
export const adminCloseAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        email: z.string().email().max(200),
        confirm: z.literal("DELETE"),
        typedEmail: z.string().min(3).max(200),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; email: string } | { ok: false; error: string }> => {
    const admin = await emailFor(context.userId, context.email);
    if (!isAdminEmail(admin)) return { ok: false, error: "Not the admin inbox." };
    if (canonicalEmail(data.email) !== canonicalEmail(data.typedEmail)) {
      return { ok: false, error: "Type the same email twice. This is on purpose so it cannot be a misclick." };
    }
    if (isAdminEmail(data.email)) {
      return { ok: false, error: "The admin inbox can't be closed from here." };
    }
    try {
      let uid: string | undefined;
      try {
        const sql = await getSql();
        const rows = await sql<{ id: string }>`
          select id from "user"
          where lower(email) = ${data.email.trim().toLowerCase()}
             or lower(email) = ${canonicalEmail(data.email)}
          limit 1
        `;
        uid = rows[0]?.id;
      } catch {
        /* lookup is best-effort */
      }
      try {
        await cancelPolarForClosedEmail(data.email, uid);
        if (uid) invalidatePlanCache(uid);
      } catch {
        /* Polar cancel is best-effort */
      }
      const closed = await adminWipeAccountNow(data.email);
      if (!closed.ok) return closed;
      if (closed.userId) invalidatePlanCache(closed.userId);
      return { ok: true, email: closed.email };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Could not delete that account." };
    }
  });
