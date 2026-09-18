import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, invalidatePlanCache } from "@/lib/billing";
import { confirmDeleteHold, requestDeleteHold } from "@/lib/closed-accounts";
import { getSql } from "@/lib/db";
import { isAdminEmail, PUBLIC_SUPPORT_EMAIL } from "@/lib/plan";
import { cancelPolarSubscription } from "@/lib/polar";

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
    { ok: true; recreateAfter: string } | { ok: false; error: string }
  > => {
    const res = await confirmDeleteHold(data.token);
    if (!res.ok) return res;
    try {
      const sql = await getSql();
      const rows = await sql<{ polar_subscription_id: string | null; user_id: string | null }>`
        select polar_subscription_id, user_id from entitlements
        where lower(email) = ${res.email} or user_id = (
          select user_id from closed_accounts where email_canonical = ${res.email} limit 1
        )
        limit 1
      `;
      const sub = String(rows[0]?.polar_subscription_id ?? "").trim();
      if (sub) await cancelPolarSubscription(sub);
      if (rows[0]?.user_id) invalidatePlanCache(rows[0].user_id);
    } catch {
      /* Polar cancel is best-effort — the hold is already in place */
    }
    return { ok: true, recreateAfter: res.recreateAfter };
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
