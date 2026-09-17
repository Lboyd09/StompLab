import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, invalidatePlanCache } from "@/lib/billing";
import { getSql } from "@/lib/db";
import { cancelPolarSubscription } from "@/lib/polar";

async function wipeUser(sql: Awaited<ReturnType<typeof getSql>>, userId: string) {
  const tables = [
    `delete from referral_redemptions where referred_user_id = $1 or referrer_user_id = $1`,
    `delete from referrals where user_id = $1`,
    `delete from entitlements where user_id = $1`,
    `delete from purchases where user_id = $1`,
    `delete from build_events where user_id = $1`,
    `delete from research_failures where user_id = $1`,
    `delete from user_gear where user_id = $1`,
    `delete from user_presets where user_id = $1`,
    `delete from feedback where user_id = $1`,
    `delete from affiliate_clicks where user_id = $1`,
    `delete from profiles where user_id = $1`,
    `delete from "session" where "userId" = $1`,
    `delete from "account" where "userId" = $1`,
    `delete from "user" where id = $1`,
  ];
  for (const q of tables) {
    try {
      await sql.query(q, [userId]);
    } catch {
      /* table or column missing on a stale host */
    }
  }
}

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const sql = await getSql();
    const email = await emailFor(context.userId, context.email);
    try {
      const rows = await sql<{ polar_subscription_id: string | null }>`
        select polar_subscription_id from entitlements where user_id = ${context.userId} limit 1
      `;
      const sub = String(rows[0]?.polar_subscription_id ?? "").trim();
      if (sub) await cancelPolarSubscription(sub);
    } catch {
      /* still wipe */
    }
    await wipeUser(sql, context.userId);
    invalidatePlanCache(context.userId);
    return { ok: true as const, email: email ?? "" };
  });
