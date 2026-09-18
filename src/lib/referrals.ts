import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, invalidatePlanCache, siblingUserIds } from "@/lib/billing";
import { getSql } from "@/lib/db";
import { normalizeEmail } from "@/lib/plan";
import { REFERRAL_BONUS, REFERRAL_CAP, REFERRAL_SUBSCRIBE_PERCENT, normalizeReferralCode, canonicalEmail } from "@/lib/referral-code";
import { referredUserGetsMonthOff } from "@/lib/referral-subscribe";

export { REFERRAL_BONUS, REFERRAL_CAP, REFERRAL_SUBSCRIBE_PERCENT, normalizeReferralCode } from "@/lib/referral-code";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

async function ensureCode(userId: string): Promise<string> {
  const sql = await getSql();
  await ensureReferralSchema(sql);
  const existing = await sql<{ code: string }>`select code from referrals where user_id = ${userId} limit 1`;
  if (existing[0]?.code) return existing[0].code;
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    try {
      await sql`insert into referrals (user_id, code) values (${userId}, ${code})`;
      return code;
    } catch {
      const race = await sql<{ code: string }>`select code from referrals where user_id = ${userId} limit 1`;
      if (race[0]?.code) return race[0].code;
    }
  }
  throw new Error("Could not make an invite code.");
}

async function ensureReferralSchema(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql.query(`alter table entitlements add column if not exists bonus_builds integer not null default 0`).catch(() => undefined);
  await sql.query(`
    create table if not exists referrals (
      user_id text primary key,
      code text not null unique,
      created_at timestamptz not null default now()
    )
  `).catch(() => undefined);
  await sql.query(`
    create table if not exists referral_redemptions (
      referred_user_id text primary key,
      referrer_user_id text not null,
      created_at timestamptz not null default now()
    )
  `).catch(() => undefined);
}

async function bumpBonus(userId: string, amount: number) {
  const sql = await getSql();
  await ensureReferralSchema(sql);
  await sql`
      insert into entitlements (user_id, email, bonus_builds, updated_at)
      values (${userId}, ${""}, ${amount}, now())
      on conflict (user_id) do update set
        bonus_builds = entitlements.bonus_builds + ${amount},
        updated_at = now()
    `;
}

export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const code = await ensureCode(context.userId);
      const sql = await getSql();
      const rows = await sql<{ n: number }>`
        select count(*)::int as n from referral_redemptions where referrer_user_id = ${context.userId}
      `;
      return { ok: true as const, code, invited: Number(rows[0]?.n ?? 0), cap: REFERRAL_CAP, bonus: REFERRAL_BONUS };
    } catch {
      return { ok: false as const, error: "Invite codes need the database." };
    }
  });

export const getReferralMonthOffer = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const eligible = await referredUserGetsMonthOff(context.userId);
      return { ok: true as const, eligible, percent: REFERRAL_SUBSCRIBE_PERCENT };
    } catch {
      return { ok: true as const, eligible: false, percent: REFERRAL_SUBSCRIBE_PERCENT };
    }
  });

const RedeemIn = z.object({ code: z.string().min(4).max(12) });

export const redeemReferral = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => RedeemIn.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true; bonus: number } | { ok: false; error: string }> => {
    const code = normalizeReferralCode(data.code);
    if (code.length < 4) return { ok: false, error: "That invite code doesn't look right." };
    const email = await emailFor(context.userId, context.email);
    try {
      const sql = await getSql();
      await ensureReferralSchema(sql);
      const already = await sql<{ referrer_user_id: string }>`
        select referrer_user_id from referral_redemptions where referred_user_id = ${context.userId} limit 1
      `;
      if (already[0]) return { ok: false, error: "This account already used an invite." };

      const owner = await sql<{ user_id: string }>`select user_id from referrals where code = ${code} limit 1`;
      const referrerId = owner[0]?.user_id;
      if (!referrerId) return { ok: false, error: "No account uses that code." };
      if (referrerId === context.userId) return { ok: false, error: "You can't invite yourself." };

      const ids = await siblingUserIds(context.userId, email);
      if (ids.includes(referrerId)) return { ok: false, error: "You can't invite yourself." };

      const refEmail = await emailFor(referrerId, null);
      if (refEmail && email && canonicalEmail(refEmail) === canonicalEmail(email)) {
        return { ok: false, error: "You can't invite yourself." };
      }

      const created = await sql<{ created_at: Date }>`
        select created_at from "user" where id = ${context.userId} limit 1
      `;
      const born = created[0]?.created_at ? new Date(created[0].created_at).getTime() : 0;
      if (born && Date.now() - born > 48 * 60 * 60 * 1000) {
        return { ok: false, error: "Invites only work on a new account (first 48 hours)." };
      }

      const builds = await sql<{ n: number }>`
        select count(*)::int as n from build_events where user_id = ${context.userId}
      `;
      if (Number(builds[0]?.n ?? 0) > 0) {
        return { ok: false, error: "Invites only work before you research a custom song." };
      }

      const used = await sql<{ n: number }>`
        select count(*)::int as n from referral_redemptions where referrer_user_id = ${referrerId}
      `;
      if (Number(used[0]?.n ?? 0) >= REFERRAL_CAP) {
        return { ok: false, error: "That friend already invited the maximum number of people." };
      }

      await sql`
        insert into referral_redemptions (referred_user_id, referrer_user_id)
        values (${context.userId}, ${referrerId})
      `;
      await bumpBonus(context.userId, REFERRAL_BONUS);
      await bumpBonus(referrerId, REFERRAL_BONUS);
      invalidatePlanCache(context.userId);
      invalidatePlanCache(referrerId);
      return { ok: true, bonus: REFERRAL_BONUS };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/unique|duplicate/i.test(msg)) return { ok: false, error: "This account already used an invite." };
      return { ok: false, error: "Could not apply that invite. Try again in a minute." };
    }
  });
