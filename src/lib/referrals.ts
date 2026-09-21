import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { emailFor, invalidatePlanCache, siblingUserIds } from "@/lib/billing";
import { getSql } from "@/lib/db";
import { REFERRAL_BONUS, REFERRAL_CAP, REFERRAL_SUBSCRIBE_PERCENT, normalizeReferralCode } from "@/lib/referral-code";
import {
  USER_CREATED_AT_QUERY,
  decideRedeem,
  mapRedeemSqlError,
  referrerCountsAsPaid,
} from "@/lib/referral-rules";
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

async function undoBonus(userId: string, amount: number) {
  try {
    const sql = await getSql();
    await sql`
      update entitlements
      set bonus_builds = greatest(0, entitlements.bonus_builds - ${amount}), updated_at = now()
      where user_id = ${userId}
    `;
  } catch {
    /* best-effort rollback */
  }
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

/** Public: does this invite currently include Polar 50% off? Paid or admin referrer. */
export const invitePerkForCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ code: z.string().min(4).max(12) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true; paid: boolean; percent: number }> => {
    const code = normalizeReferralCode(data.code);
    if (code.length < 4) return { ok: true, paid: false, percent: REFERRAL_SUBSCRIBE_PERCENT };
    try {
      const sql = await getSql();
      const rows = await sql<{ paid: boolean | null; email: string | null }>`
        select e.paid, coalesce(u.email, e.email, '') as email
        from referrals r
        left join entitlements e on e.user_id = r.user_id
        left join "user" u on u.id = r.user_id
        where r.code = ${code}
        order by e.paid desc nulls last
        limit 1
      `;
      const row = rows[0];
      const paid = referrerCountsAsPaid({ paid: row?.paid, email: row?.email });
      return { ok: true, paid, percent: REFERRAL_SUBSCRIBE_PERCENT };
    } catch {
      return { ok: true, paid: false, percent: REFERRAL_SUBSCRIBE_PERCENT };
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
    let referrerId = "";
    try {
      const sql = await getSql();
      await ensureReferralSchema(sql);
      const already = await sql<{ referrer_user_id: string }>`
        select referrer_user_id from referral_redemptions where referred_user_id = ${context.userId} limit 1
      `;

      const owner = await sql<{ user_id: string }>`select user_id from referrals where code = ${code} limit 1`;
      referrerId = owner[0]?.user_id ?? "";

      const ids = await siblingUserIds(context.userId, email);
      const refEmail = referrerId ? await emailFor(referrerId, null) : null;

      let createdAt: unknown = null;
      try {
        const created = await sql.query<{ created_at: Date | string | null }>(USER_CREATED_AT_QUERY, [
          context.userId,
        ]);
        createdAt = created[0]?.created_at ?? null;
      } catch {
        createdAt = null;
      }

      const builds = await sql<{ n: number }>`
        select count(*)::int as n from build_events where user_id = ${context.userId}
      `;
      const used = referrerId
        ? await sql<{ n: number }>`
            select count(*)::int as n from referral_redemptions where referrer_user_id = ${referrerId}
          `
        : [{ n: 0 }];

      const decision = decideRedeem({
        code,
        userId: context.userId,
        email,
        referrerId: referrerId || null,
        referrerEmail: refEmail,
        siblingIds: ids,
        existingReferrerId: already[0]?.referrer_user_id ?? null,
        createdAt,
        customBuilds: Number(builds[0]?.n ?? 0),
        referrerUsed: Number(used[0]?.n ?? 0),
      });
      if (!decision.ok) return decision;
      if (decision.already) return { ok: true, bonus: REFERRAL_BONUS };

      await sql`
        insert into referral_redemptions (referred_user_id, referrer_user_id)
        values (${context.userId}, ${referrerId})
      `;
      try {
        await bumpBonus(context.userId, REFERRAL_BONUS);
        await bumpBonus(referrerId, REFERRAL_BONUS);
      } catch (err) {
        await sql`delete from referral_redemptions where referred_user_id = ${context.userId}`.catch(() => undefined);
        await undoBonus(context.userId, REFERRAL_BONUS);
        await undoBonus(referrerId, REFERRAL_BONUS);
        throw err;
      }
      invalidatePlanCache(context.userId);
      invalidatePlanCache(referrerId);
      return { ok: true, bonus: REFERRAL_BONUS };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/unique|duplicate/i.test(msg) && referrerId) {
        try {
          const sql = await getSql();
          const row = await sql<{ referrer_user_id: string }>`
            select referrer_user_id from referral_redemptions where referred_user_id = ${context.userId} limit 1
          `;
          if (row[0]?.referrer_user_id === referrerId) return { ok: true, bonus: REFERRAL_BONUS };
        } catch {
          /* fall through */
        }
      }
      const mapped = mapRedeemSqlError(msg);
      if (mapped) return { ok: false, error: mapped };
      console.error("[referrals] redeem failed", msg);
      return { ok: false, error: "Could not apply that invite. Try again in a minute." };
    }
  });
