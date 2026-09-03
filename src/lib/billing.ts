import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  createPolarCheckout,
  extractOrder,
  fetchPolarCheckout,
  isRealPolarOrderId,
  isRealPolarSubscriptionId,
  polarConfigured,
  polarEventIsPaid,
  polarEventIsSubscriptionGrant,
  polarStatusIsPaid,
  purchaseLooksPaid,
  subscriptionStatusIsActive,
} from "./polar";
import { assemblePlan, emptyPlan, isAdminEmail, isOwnerAccount, normalizeEmail, yearMonth, type Plan, type PlanInterval, ADMIN_EMAIL } from "./plan";
import { amazonAssociateTag } from "./affiliate";
import type { Preset, UserGear } from "@/data/types";
import { parseStompModelId, STOMP_MODEL_IDS } from "@/data/types";
import { publicOrigin } from "./site-origin";

export async function emailFor(userId: string): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ email: string | null }>`select email from "user" where id = ${userId} limit 1`;
    const raw = rows[0]?.email ?? null;
    return raw ? normalizeEmail(raw) : null;
  } catch {
    return null;
  }
}

/** Every Better Auth user id that shares this email (case-insensitive). */
export async function siblingUserIds(userId: string, email: string | null): Promise<string[]> {
  const ids = new Set<string>([userId]);
  const em = normalizeEmail(email);
  if (!em) return [...ids];
  try {
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(`select id from "user" where lower(email) = $1`, [em]);
    for (const r of rows) {
      if (r?.id) ids.add(r.id);
    }
  } catch {
    /* ignore */
  }
  return [...ids];
}

async function countBuildsFor(ids: string[], month?: string): Promise<number> {
  try {
    const sql = await getSql();
    if (month) {
      const rows = await sql.query<{ n: number }>(
        `select count(*)::int as n from build_events where user_id = any($1::text[]) and year_month = $2`,
        [ids, month],
      );
      return Number(rows[0]?.n ?? 0);
    }
    const rows = await sql.query<{ n: number }>(
      `select count(*)::int as n from build_events where user_id = any($1::text[])`,
      [ids],
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    let n = 0;
    try {
      const sql = await getSql();
      for (const id of ids) {
        const rows = month
          ? await sql<{ n: number }>`select count(*)::int as n from build_events where user_id = ${id} and year_month = ${month}`
          : await sql<{ n: number }>`select count(*)::int as n from build_events where user_id = ${id}`;
        n += Number(rows[0]?.n ?? 0);
      }
    } catch {
      /* ignore */
    }
    return n;
  }
}

async function entitlementForIds(ids: string[], email: string | null): Promise<EntRow | undefined> {
  const sql = await getSql();
  const em = normalizeEmail(email);
  try {
    const rows = await sql.query<EntRow>(
      `select paid, paid_source, polar_order_id, polar_subscription_id, plan_interval, subscription_status, email
       from entitlements
       where user_id = any($1::text[]) ${em ? "or lower(email) = $2" : ""}
       order by paid desc, updated_at desc
       limit 8`,
      em ? [ids, em] : [ids],
    );
    const polar = rows.find((r) => r.paid && String(r.paid_source ?? "").toLowerCase() === "polar");
    return polar ?? rows[0];
  } catch {
    try {
      const rows = await sql.query<EntRow>(
        `select paid, paid_source, polar_order_id, email from entitlements where user_id = any($1::text[])`,
        [ids],
      );
      return rows.find((r) => r.paid) ?? rows[0];
    } catch {
      return undefined;
    }
  }
}

async function checkoutSuccessOrigin(): Promise<string> {
  return publicOrigin();
}

type EntRow = {
  paid: boolean;
  paid_source?: string | null;
  polar_order_id?: string | null;
  polar_subscription_id?: string | null;
  plan_interval?: string | null;
  subscription_status?: string | null;
  email?: string | null;
};

async function markAdminPaid(userId: string, email: string) {
  const sql = await getSql();
  try {
    await sql`
      insert into entitlements (user_id, email, paid, paid_source, subscription_status, paid_at, updated_at)
      values (${userId}, ${email}, true, ${"admin"}, ${"active"}, now(), now())
      on conflict (user_id) do update set
        paid = true,
        paid_source = 'admin',
        subscription_status = 'active',
        email = excluded.email,
        paid_at = coalesce(entitlements.paid_at, now()),
        updated_at = now()
    `;
  } catch {
    try {
      await sql`
        insert into entitlements (user_id, email, paid, paid_source, paid_at, updated_at)
        values (${userId}, ${email}, true, ${"admin"}, now(), now())
        on conflict (user_id) do update set
          paid = true,
          paid_source = 'admin',
          email = excluded.email,
          paid_at = coalesce(entitlements.paid_at, now()),
          updated_at = now()
      `;
    } catch {
      await sql`
        insert into entitlements (user_id, email, paid, paid_at, updated_at)
        values (${userId}, ${email}, true, now(), now())
        on conflict (user_id) do update set
          paid = true,
          email = excluded.email,
          paid_at = coalesce(entitlements.paid_at, now()),
          updated_at = now()
      `;
    }
  }
}

async function revokeStolenGrant(userId: string) {
  const sql = await getSql();
  try {
    await sql`
      update entitlements
      set paid = false, paid_source = '', polar_order_id = '', polar_subscription_id = '',
          subscription_status = 'revoked', updated_at = now()
      where user_id = ${userId}
    `;
  } catch {
    try {
      await sql`
        update entitlements
        set paid = false, paid_source = '', polar_order_id = '', updated_at = now()
        where user_id = ${userId}
      `;
    } catch {
      await sql`
        update entitlements
        set paid = false, polar_order_id = '', updated_at = now()
        where user_id = ${userId}
      `;
    }
  }
}

function orderIdFromPurchase(raw: unknown, fallback: string): string {
  if (raw && typeof raw === "object") {
    const extracted = extractOrder(raw as Record<string, unknown>);
    if (isRealPolarOrderId(extracted.orderId)) return extracted.orderId;
  }
  return isRealPolarOrderId(fallback) ? fallback : "";
}

/**
 * Paid is true only for the exact admin email, or a Polar subscription that is
 * still in period (active / trialing / canceled-until-revoke). Checkout.created
 * grants are revoked here so the back button cannot unlock the Lab.
 */
async function paidVerifiedFor(userId: string, email: string | null, row: EntRow | undefined): Promise<boolean> {
  if (isAdminEmail(email)) {
    await markAdminPaid(userId, email ?? "");
    return true;
  }
  const sql = await getSql();
  const source = String(row?.paid_source ?? "").trim().toLowerCase();
  const storedOrder = String(row?.polar_order_id ?? "").trim();
  const subStatus = String(row?.subscription_status ?? "").trim().toLowerCase();
  if (subStatus === "revoked" || subStatus === "expired" || subStatus === "incomplete_expired") {
    if (row?.paid) await revokeStolenGrant(userId);
    return false;
  }
  if (subscriptionStatusIsActive(subStatus) && (source === "polar" || source === "admin" || row?.paid)) {
    return true;
  }
  if (row?.paid && source === "polar" && isRealPolarOrderId(storedOrder) && !subStatus) {
    // Fresh order.paid before subscription.active webhook. Keep the grant.
    return true;
  }

  let purchases: { polar_order_id: string; raw: unknown }[] = [];
  try {
    purchases = await sql<{ polar_order_id: string; raw: unknown }>`
      select polar_order_id, raw from purchases where user_id = ${userId}
    `;
  } catch {
    purchases = [];
  }
  const good = purchases.find((p) => {
    const oid = orderIdFromPurchase(p.raw, p.polar_order_id);
    return purchaseLooksPaid(p.raw) && (isRealPolarOrderId(oid) || polarEventIsSubscriptionGrant(p.raw as Record<string, unknown>));
  });
  if (good) {
    const extracted = good.raw && typeof good.raw === "object" ? extractOrder(good.raw as Record<string, unknown>) : null;
    const oid = orderIdFromPurchase(good.raw, good.polar_order_id);
    const subId = extracted?.subscriptionId ?? "";
    const interval = extracted?.interval || "";
    try {
      await sql`
        update entitlements
        set paid = true, paid_source = ${"polar"}, polar_order_id = ${oid},
            polar_subscription_id = coalesce(nullif(${subId}, ''), entitlements.polar_subscription_id),
            plan_interval = coalesce(nullif(${interval}, ''), entitlements.plan_interval),
            subscription_status = ${"active"}, updated_at = now()
        where user_id = ${userId}
      `;
    } catch {
      try {
        await sql`
          update entitlements
          set paid = true, paid_source = ${"polar"}, polar_order_id = ${oid}, updated_at = now()
          where user_id = ${userId}
        `;
      } catch {
        await sql`
          update entitlements
          set paid = true, polar_order_id = ${oid}, updated_at = now()
          where user_id = ${userId}
        `;
      }
    }
    return true;
  }

  if (row?.paid) await revokeStolenGrant(userId);
  return false;
}

export async function loadPlan(userId: string, email: string | null): Promise<Plan> {
  const sql = await getSql();
  const em = normalizeEmail(email);
  const ids = await siblingUserIds(userId, em || email);
  let ent: EntRow | undefined;
  try {
    ent = await entitlementForIds(ids, em || email);
  } catch {
    try {
      const rows = await sql<EntRow>`
        select paid, paid_source, polar_order_id, polar_subscription_id, plan_interval, subscription_status, email
        from entitlements where user_id = ${userId} limit 1
      `;
      ent = rows[0];
    } catch {
      try {
        const rows = await sql<EntRow>`
          select paid, paid_source, polar_order_id, email from entitlements where user_id = ${userId} limit 1
        `;
        ent = rows[0];
      } catch {
        try {
          const rows = await sql<EntRow>`
            select paid, polar_order_id, email from entitlements where user_id = ${userId} limit 1
          `;
          ent = rows[0];
        } catch {
          ent = undefined;
        }
      }
    }
  }
  const paid = await paidVerifiedFor(userId, em || email, ent);
  const lifetimeN = await countBuildsFor(ids);
  const monthlyN = await countBuildsFor(ids, yearMonth());
  const intervalRaw = String(ent?.plan_interval ?? "").trim().toLowerCase();
  const planInterval: PlanInterval | null = intervalRaw === "year" ? "year" : intervalRaw === "month" ? "month" : null;
  return assemblePlan({
    userId,
    email: em || email,
    paid,
    freeUsed: lifetimeN,
    monthUsed: monthlyN,
    planInterval,
    subscriptionStatus: String(ent?.subscription_status ?? ""),
  });
}

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Plan> => {
    const email = await emailFor(context.userId);
    return loadPlan(context.userId, email);
  });

export const getPublicPlan = createServerFn({ method: "GET" }).handler(async (): Promise<Plan> => {
  return emptyPlan();
});

export async function grantPaid(opts: {
  userId: string;
  email: string;
  orderId: string;
  checkoutId: string;
  amountCents: number;
  customerId: string;
  raw: unknown;
  subscriptionId?: string;
  interval?: PlanInterval | "";
  subscriptionStatus?: string;
}) {
  const subId = opts.subscriptionId ?? "";
  const canGrantBySub = isRealPolarSubscriptionId(subId);
  if (!isRealPolarOrderId(opts.orderId) && !canGrantBySub) {
    throw new Error("Refusing to grant without a Polar order or subscription id.");
  }
  if (opts.raw && typeof opts.raw === "object") {
    const rec = opts.raw as Record<string, unknown>;
    const ok =
      polarEventIsPaid(rec) ||
      polarEventIsSubscriptionGrant(rec) ||
      polarStatusIsPaid(rec);
    if (!ok) throw new Error("Refusing to grant on an unpaid Polar event.");
  }
  const orderId = isRealPolarOrderId(opts.orderId) ? opts.orderId : `sub:${subId}`.slice(0, 80);
  const interval = opts.interval === "year" || opts.interval === "month" ? opts.interval : "";
  const status = (opts.subscriptionStatus || "active").slice(0, 32);
  const email = normalizeEmail(opts.email) || opts.email;
  const sql = await getSql();
  try {
    await sql`
      insert into entitlements (
        user_id, email, paid, paid_source, polar_customer_id, polar_order_id,
        polar_subscription_id, plan_interval, subscription_status, amount_cents, paid_at, updated_at
      )
      values (
        ${opts.userId}, ${email}, true, ${"polar"}, ${opts.customerId}, ${orderId},
        ${subId}, ${interval}, ${status}, ${opts.amountCents}, now(), now()
      )
      on conflict (user_id) do update set
        paid = true,
        paid_source = 'polar',
        email = excluded.email,
        polar_customer_id = coalesce(nullif(excluded.polar_customer_id, ''), entitlements.polar_customer_id),
        polar_order_id = coalesce(nullif(excluded.polar_order_id, ''), entitlements.polar_order_id),
        polar_subscription_id = coalesce(nullif(excluded.polar_subscription_id, ''), entitlements.polar_subscription_id),
        plan_interval = coalesce(nullif(excluded.plan_interval, ''), entitlements.plan_interval),
        subscription_status = excluded.subscription_status,
        amount_cents = excluded.amount_cents,
        paid_at = coalesce(entitlements.paid_at, now()),
        updated_at = now()
    `;
  } catch {
    try {
      await sql`
        insert into entitlements (user_id, email, paid, paid_source, polar_customer_id, polar_order_id, amount_cents, paid_at, updated_at)
        values (${opts.userId}, ${email}, true, ${"polar"}, ${opts.customerId}, ${orderId}, ${opts.amountCents}, now(), now())
        on conflict (user_id) do update set
          paid = true,
          paid_source = 'polar',
          email = excluded.email,
          polar_customer_id = coalesce(nullif(excluded.polar_customer_id, ''), entitlements.polar_customer_id),
          polar_order_id = coalesce(nullif(excluded.polar_order_id, ''), entitlements.polar_order_id),
          amount_cents = excluded.amount_cents,
          paid_at = coalesce(entitlements.paid_at, now()),
          updated_at = now()
      `;
    } catch {
      await sql`
        insert into entitlements (user_id, email, paid, polar_customer_id, polar_order_id, amount_cents, paid_at, updated_at)
        values (${opts.userId}, ${email}, true, ${opts.customerId}, ${orderId}, ${opts.amountCents}, now(), now())
        on conflict (user_id) do update set
          paid = true,
          email = excluded.email,
          polar_customer_id = coalesce(nullif(excluded.polar_customer_id, ''), entitlements.polar_customer_id),
          polar_order_id = coalesce(nullif(excluded.polar_order_id, ''), entitlements.polar_order_id),
          amount_cents = excluded.amount_cents,
          paid_at = coalesce(entitlements.paid_at, now()),
          updated_at = now()
      `;
    }
  }
  try {
    await sql.query(
      `insert into purchases (user_id, email, polar_order_id, polar_checkout_id, amount_cents, raw)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict do nothing`,
      [
        opts.userId,
        email,
        orderId,
        opts.checkoutId,
        opts.amountCents,
        JSON.stringify(opts.raw ?? {}),
      ],
    );
  } catch {
    /* duplicate order is fine */
  }
}

export async function grantPaidByEmail(email: string, order: ReturnType<typeof extractOrder>, raw: unknown) {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const grantOk = polarEventIsPaid(rec) || polarEventIsSubscriptionGrant(rec);
  if (!grantOk) return false;
  if (!isRealPolarOrderId(order.orderId) && !isRealPolarSubscriptionId(order.subscriptionId)) return false;
  const sql = await getSql();
  const em = normalizeEmail(email) || email.trim().toLowerCase();
  let userId = order.userId;
  if (!userId && em) {
    const rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${em} limit 1`;
    userId = rows[0]?.id ?? "";
  }
  if (!userId) {
    await sql.query(
      `insert into purchases (user_id, email, polar_order_id, polar_checkout_id, amount_cents, raw)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        "unmatched",
        em,
        order.orderId || order.subscriptionId,
        order.checkoutId,
        order.amount,
        JSON.stringify(raw ?? {}),
      ],
    );
    return false;
  }
  await grantPaid({
    userId,
    email: em,
    orderId: order.orderId,
    checkoutId: order.checkoutId,
    amountCents: order.amount,
    customerId: order.customerId,
    raw,
    subscriptionId: order.subscriptionId,
    interval: order.interval,
    subscriptionStatus: order.subStatus || "active",
  });
  return true;
}

export async function revokeSubscriptionByEmail(email: string, subscriptionId: string, raw: unknown) {
  const sql = await getSql();
  const em = email.trim().toLowerCase();
  const sub = subscriptionId.trim();
  if (!em && !sub) return false;
  try {
    if (sub) {
      await sql`
        update entitlements
        set paid = false, subscription_status = 'revoked', updated_at = now()
        where polar_subscription_id = ${sub} or lower(email) = ${em}
      `;
    } else {
      await sql`
        update entitlements
        set paid = false, subscription_status = 'revoked', updated_at = now()
        where lower(email) = ${em}
      `;
    }
  } catch {
    try {
      await sql`
        update entitlements set paid = false, updated_at = now() where lower(email) = ${em}
      `;
    } catch {
      /* ignore */
    }
  }
  try {
    await sql.query(
      `insert into purchases (user_id, email, polar_order_id, polar_checkout_id, amount_cents, raw)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      ["revoked", em, sub || "revoked", "", 0, JSON.stringify(raw ?? {})],
    );
  } catch {
    /* ignore */
  }
  return true;
}

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ interval: z.enum(["month", "year"]) }).parse(input))
  .handler(async ({ context, data }) => {
    const email = await emailFor(context.userId);
    if (!email) {
      return { ok: false as const, error: "Your account needs an email before checkout." };
    }
    const plan = await loadPlan(context.userId, email);
    if (plan.paid) {
      return { ok: false as const, error: "This account is already subscribed." };
    }
    const origin = await checkoutSuccessOrigin();
    return createPolarCheckout({
      email,
      userId: context.userId,
      interval: data.interval,
      successUrl: `${origin}/upgrade?checkout_id={CHECKOUT_ID}`,
    });
  });

export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ checkoutId: z.string().min(4).max(120) }).parse(input))
  .handler(async ({ context, data }) => {
    const checkout = await fetchPolarCheckout(data.checkoutId);
    if (!checkout) return { ok: false as const, error: "Could not confirm that payment yet. Wait a few seconds." };
    if (!polarStatusIsPaid(checkout)) {
      return { ok: false as const, error: "Payment is still processing. Finish checkout — going back does not unlock." };
    }
    const order = extractOrder(checkout);
    if (!isRealPolarOrderId(order.orderId)) {
      return { ok: false as const, error: "Polar has not issued an order yet. Finish payment first." };
    }
    const email = (await emailFor(context.userId)) ?? "";
    const metaUser = String(order.userId ?? "").trim();
    if (metaUser && metaUser !== context.userId) {
      return { ok: false as const, error: "That checkout belongs to a different account." };
    }
    if (order.email && email && order.email !== email.toLowerCase()) {
      return { ok: false as const, error: "That checkout belongs to a different email." };
    }
    await grantPaid({
      userId: context.userId,
      email: order.email || email,
      orderId: order.orderId,
      checkoutId: data.checkoutId,
      amountCents: order.amount,
      customerId: order.customerId,
      raw: { type: "checkout.updated", ...checkout, status: checkout.status ?? "succeeded" },
      subscriptionId: order.subscriptionId,
      interval: order.interval,
      subscriptionStatus: "active",
    });
    return { ok: true as const, plan: await loadPlan(context.userId, email) };
  });

export async function recordBuild(userId: string, kind: string, song: string) {
  const sql = await getSql();
  await sql`
    insert into build_events (user_id, kind, song, year_month)
    values (${userId}, ${kind}, ${song}, ${yearMonth()})
  `;
}

export async function recordFailure(userId: string, song: string, artist: string, error: string) {
  try {
    const sql = await getSql();
    await sql`
      insert into research_failures (user_id, song, artist, error)
      values (${userId}, ${song.slice(0, 120)}, ${artist.slice(0, 120)}, ${error.slice(0, 500)})
    `;
  } catch {
    /* ignore */
  }
}

async function assertAdmin(userId: string) {
  const email = await emailFor(userId);
  if (!isAdminEmail(email)) throw new Error("Unauthorized");
  return email;
}

export const requireAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await assertAdmin(context.userId);
    return { ok: true as const, email };
  });

export const adminDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const empty = {
      purchases: [] as {
        created_at: string;
        email: string;
        polar_order_id: string;
        polar_checkout_id: string;
        amount_cents: number;
      }[],
      usage: [] as { user_id: string; email: string; year_month: string; n: number }[],
      failures: [] as { created_at: string; song: string; artist: string; error: string }[],
      cache: [] as {
        cache_key: string;
        song: string;
        artist: string;
        instrument: string;
        stomp_model: string;
        hit_count: number;
        summary: string;
      }[],
      feedback: [] as {
        created_at: string;
        email: string;
        kind: string;
        song: string;
        message: string;
        rating: number | null;
        closer_tweaks: string;
        want_preset: string;
        want_app: string;
      }[],
      entitlements: [] as {
        user_id: string;
        email: string;
        paid: boolean;
        paid_source: string;
        polar_order_id: string;
      }[],
      accounts: [] as {
        id: string;
        email: string;
        name: string;
        created_at: string;
        paid: boolean;
        subscription_status: string;
        plan_interval: string;
        builds: number;
      }[],
      userCount: 0,
      subscribedCount: 0,
      revenueCents: 0,
      affiliateClicks: [] as { vendor: string; n: number }[],
      polarReady: polarConfigured(),
      amazonReady: Boolean(amazonAssociateTag()),
    };
    try {
      return await loadAdminDashboard(empty);
    } catch {
      return empty;
    }
  });

async function loadAdminDashboard(empty: {
  purchases: {
    created_at: string;
    email: string;
    polar_order_id: string;
    polar_checkout_id: string;
    amount_cents: number;
  }[];
  usage: { user_id: string; email: string; year_month: string; n: number }[];
  failures: { created_at: string; song: string; artist: string; error: string }[];
  cache: {
    cache_key: string;
    song: string;
    artist: string;
    instrument: string;
    stomp_model: string;
    hit_count: number;
    summary: string;
  }[];
  feedback: {
    created_at: string;
    email: string;
    kind: string;
    song: string;
    message: string;
    rating: number | null;
    closer_tweaks: string;
    want_preset: string;
    want_app: string;
  }[];
  entitlements: {
    user_id: string;
    email: string;
    paid: boolean;
    paid_source: string;
    polar_order_id: string;
  }[];
  accounts: {
    id: string;
    email: string;
    name: string;
    created_at: string;
    paid: boolean;
    subscription_status: string;
    plan_interval: string;
    builds: number;
  }[];
  userCount: number;
  subscribedCount: number;
  revenueCents: number;
  affiliateClicks: { vendor: string; n: number }[];
  polarReady: boolean;
  amazonReady: boolean;
}) {
    const sql = await getSql();
    let purchases = empty.purchases;
    try {
      purchases = await sql<{
        created_at: string;
        email: string;
        polar_order_id: string;
        polar_checkout_id: string;
        amount_cents: number;
      }>`
        select created_at::text, email, polar_order_id, polar_checkout_id, amount_cents
        from purchases
        order by created_at desc
        limit 100
      `;
    } catch {
      purchases = [];
    }
    let usage = empty.usage;
    try {
      usage = await sql<{
        user_id: string;
        email: string;
        year_month: string;
        n: number;
      }>`
        select
          b.user_id,
          coalesce(e.email, u.email, '') as email,
          b.year_month,
          count(*)::int as n
        from build_events b
        left join entitlements e on e.user_id = b.user_id
        left join "user" u on u.id = b.user_id
        group by b.user_id, coalesce(e.email, u.email, ''), b.year_month
        order by b.year_month desc, n desc
        limit 200
      `;
    } catch {
      usage = [];
    }
    let failures = empty.failures;
    try {
      failures = await sql<{
        created_at: string;
        song: string;
        artist: string;
        error: string;
      }>`
        select created_at::text, song, artist, error
        from research_failures
        order by created_at desc
        limit 80
      `;
    } catch {
      failures = [];
    }
    let cache = empty.cache;
    try {
      cache = await sql<{
        cache_key: string;
        song: string;
        artist: string;
        instrument: string;
        stomp_model: string;
        hit_count: number;
        summary: string;
      }>`
        select
          cache_key, song, artist, instrument, stomp_model, hit_count,
          coalesce(preset->>'summary', '') as summary
        from rig_cache
        where kind = 'song'
        order by updated_at desc
        limit 80
      `;
    } catch {
      cache = [];
    }
    let notes = empty.feedback;
    try {
      notes = await sql<{
        created_at: string;
        email: string;
        kind: string;
        song: string;
        message: string;
        rating: number | null;
        closer_tweaks: string;
        want_preset: string;
        want_app: string;
      }>`
        select
          created_at::text, email, kind, song, message,
          rating, closer_tweaks, want_preset, want_app
        from feedback
        order by created_at desc
        limit 120
      `;
    } catch {
      try {
        notes = (
          await sql<{
            created_at: string;
            email: string;
            kind: string;
            song: string;
            message: string;
          }>`
            select created_at::text, email, kind, song, message
            from feedback
            order by created_at desc
            limit 120
          `
        ).map((n) => ({ ...n, rating: null, closer_tweaks: "", want_preset: "", want_app: "" }));
      } catch {
        notes = [];
      }
    }
    let accounts = empty.accounts;
    try {
      accounts = await sql<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        paid: boolean;
        subscription_status: string;
        plan_interval: string;
        builds: number;
      }>`
        select
          u.id,
          coalesce(u.email, '') as email,
          coalesce(u.name, '') as name,
          u."createdAt"::text as created_at,
          coalesce(e.paid, false) as paid,
          coalesce(e.subscription_status, '') as subscription_status,
          coalesce(e.plan_interval, '') as plan_interval,
          coalesce((select count(*)::int from build_events b where b.user_id = u.id), 0) as builds
        from "user" u
        left join entitlements e on e.user_id = u.id
        order by u."createdAt" desc
        limit 200
      `;
    } catch {
      accounts = [];
    }
    let entitlements = empty.entitlements;
    try {
      entitlements = await sql<{
        user_id: string;
        email: string;
        paid: boolean;
        paid_source: string;
        polar_order_id: string;
      }>`
        select user_id, email, paid, coalesce(paid_source, '') as paid_source, polar_order_id
        from entitlements
        where paid = true
        order by updated_at desc
        limit 100
      `;
    } catch {
      try {
        entitlements = await sql<{
          user_id: string;
          email: string;
          paid: boolean;
          paid_source: string;
          polar_order_id: string;
        }>`
          select user_id, email, paid, '' as paid_source, polar_order_id
          from entitlements
          where paid = true
          order by updated_at desc
          limit 100
        `;
      } catch {
        entitlements = [];
      }
    }
    let userCount = 0;
    let subscribedCount = 0;
    let revenueCents = 0;
    let affiliateClicks: { vendor: string; n: number }[] = [];
    try {
      const u = await sql<{ n: number }>`
        select count(*)::int as n from "user"
        where lower(coalesce(email, '')) <> ${ADMIN_EMAIL}
      `;
      userCount = Number(u[0]?.n ?? 0);
    } catch {
      userCount = accounts.filter((a) => !isOwnerAccount(a.email)).length;
    }
    try {
      const s = await sql<{ n: number }>`
        select count(*)::int as n from entitlements
        where paid = true
          and coalesce(paid_source, '') <> 'admin'
          and lower(coalesce(email, '')) <> ${ADMIN_EMAIL}
          and coalesce(subscription_status, 'active') not in ('revoked', 'expired', 'incomplete_expired')
      `;
      subscribedCount = Number(s[0]?.n ?? 0);
    } catch {
      try {
        const s = await sql<{ n: number }>`
          select count(*)::int as n from entitlements
          where paid = true
            and coalesce(paid_source, '') <> 'admin'
            and lower(coalesce(email, '')) <> ${ADMIN_EMAIL}
        `;
        subscribedCount = Number(s[0]?.n ?? 0);
      } catch {
        subscribedCount = entitlements.filter(
          (e) => e.paid && e.paid_source !== "admin" && !isOwnerAccount(e.email),
        ).length;
      }
    }
    try {
      const r = await sql<{ n: number }>`
        select coalesce(sum(amount_cents), 0)::int as n
        from purchases
        where amount_cents > 0
          and user_id not in ('unmatched', 'revoked')
          and lower(coalesce(email, '')) <> ${ADMIN_EMAIL}
          and user_id not in (select id from "user" where lower(email) = ${ADMIN_EMAIL})
      `;
      revenueCents = Number(r[0]?.n ?? 0);
    } catch {
      try {
        const r = await sql<{ n: number }>`
          select coalesce(sum(amount_cents), 0)::int as n
          from purchases
          where amount_cents > 0
            and user_id not in ('unmatched', 'revoked')
            and lower(coalesce(email, '')) <> ${ADMIN_EMAIL}
        `;
        revenueCents = Number(r[0]?.n ?? 0);
      } catch {
        revenueCents = purchases
          .filter((p) => !isOwnerAccount(p.email))
          .reduce((n, p) => n + (Number(p.amount_cents) || 0), 0);
      }
    }
    try {
      affiliateClicks = await sql<{ vendor: string; n: number }>`
        select vendor, count(*)::int as n from affiliate_clicks group by vendor order by n desc
      `;
    } catch {
      affiliateClicks = [];
    }
    purchases = purchases.filter((p) => !isOwnerAccount(p.email));
    usage = usage.filter((u) => !isOwnerAccount(u.email));
    return {
      purchases,
      usage,
      failures,
      cache,
      feedback: notes,
      entitlements,
      accounts,
      userCount,
      subscribedCount,
      revenueCents,
      affiliateClicks,
      polarReady: polarConfigured(),
      amazonReady: Boolean(amazonAssociateTag()),
    };
}

export const adminDeleteCache = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ key: z.string().min(4).max(240) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from rig_cache where cache_key = ${data.key}`;
    return { ok: true as const };
  });

export const adminInspectCache = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ key: z.string().min(4).max(240) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      cache_key: string;
      song: string;
      artist: string;
      instrument: string;
      stomp_model: string;
      hit_count: number;
      preset: Preset | null;
      created_at: string;
      updated_at: string;
    }>`
      select
        cache_key, song, artist, instrument, stomp_model, hit_count, preset,
        created_at::text, updated_at::text
      from rig_cache
      where cache_key = ${data.key}
      limit 1
    `;
    return { row: rows[0] ?? null };
  });

export const pullMyPresets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    try {
      const sql = await getSql();
      const email = await emailFor(context.userId);
      const ids = await siblingUserIds(context.userId, email);
      let rows: { presets: Preset[] }[] = [];
      try {
        rows = await sql.query<{ presets: Preset[] }>(
          `select presets from user_presets where user_id = any($1::text[])`,
          [ids],
        );
      } catch {
        rows = await sql<{ presets: Preset[] }>`
          select presets from user_presets where user_id = ${context.userId} limit 1
        `;
      }
      const byId = new Map<string, Preset>();
      for (const row of rows) {
        const list = Array.isArray(row?.presets) ? row.presets : [];
        for (const p of list) {
          if (p && typeof p === "object" && p.id && !byId.has(p.id)) byId.set(p.id, p);
        }
      }
      return { presets: [...byId.values()] };
    } catch {
      return { presets: [] as Preset[] };
    }
  });

export const pushMyPresets = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        presets: z.array(z.unknown()).max(60),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    try {
      const sql = await getSql();
      await sql.query(
        `insert into user_presets (user_id, presets, updated_at) values ($1, $2::jsonb, now())
         on conflict (user_id) do update set presets = excluded.presets, updated_at = now()`,
        [context.userId, JSON.stringify(data.presets)],
      );
      return { ok: true as const };
    } catch {
      return { ok: false as const };
    }
  });

export const recordAffiliateClick = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        vendor: z.enum(["amazon", "sweetwater"]),
        query: z.string().max(80),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const sql = await getSql();
      await sql`
        insert into affiliate_clicks (user_id, vendor, query)
        values (${""}, ${data.vendor}, ${data.query})
      `;
    } catch {
      /* table may not exist yet */
    }
    return { ok: true as const };
  });

export const pullMyGear = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    if (!plan.canLockerSync) return { gear: [] as UserGear[], sync: false };
    try {
      const sql = await getSql();
      const rows = await sql<{ gear: UserGear[] }>`select gear from user_gear where user_id = ${context.userId} limit 1`;
      return { gear: Array.isArray(rows[0]?.gear) ? rows[0].gear : [], sync: true };
    } catch {
      return { gear: [] as UserGear[], sync: true };
    }
  });

export const pushMyGear = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        gear: z.array(
          z.object({
            id: z.string(),
            kind: z.enum(["guitar", "bass", "amp", "cab", "pedal", "pickup"]),
            name: z.string(),
            notes: z.string(),
          }),
        ),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const email = await emailFor(context.userId);
    const plan = await loadPlan(context.userId, email);
    if (!plan.canLockerSync) return { ok: false as const };
    const sql = await getSql();
    await sql.query(
      `insert into user_gear (user_id, gear, updated_at) values ($1, $2::jsonb, now())
       on conflict (user_id) do update set gear = excluded.gear, updated_at = now()`,
      [context.userId, JSON.stringify(data.gear)],
    );
    return { ok: true as const };
  });

export type Profile = {
  displayName: string;
  instrument: "guitar" | "bass";
  stompModel: (typeof STOMP_MODEL_IDS)[number];
  genres: string[];
};

const DeviceEnum = z.enum(STOMP_MODEL_IDS);

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        displayName: z.string().max(80).optional().default(""),
        instrument: z.enum(["guitar", "bass"]).optional().default("guitar"),
        stompModel: DeviceEnum.optional().default("hx-stomp"),
        genres: z.array(z.string().max(32)).max(12).optional().default([]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const genres = data.genres.join(",");
    try {
      await sql`
        insert into profiles (user_id, display_name, instrument, stomp_model, genres, onboarded_at, updated_at)
        values (${context.userId}, ${data.displayName}, ${data.instrument}, ${data.stompModel}, ${genres}, now(), now())
        on conflict (user_id) do update set
          display_name = excluded.display_name,
          instrument = excluded.instrument,
          stomp_model = excluded.stomp_model,
          genres = excluded.genres,
          onboarded_at = coalesce(profiles.onboarded_at, now()),
          updated_at = now()
      `;
    } catch {
      /* table may not exist yet on a lagging migrate */
    }
    return { ok: true as const };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Profile | null> => {
    try {
      const sql = await getSql();
      const rows = await sql<{
        display_name: string;
        instrument: string;
        stomp_model: string;
        genres: string;
      }>`
        select display_name, instrument, stomp_model, genres
        from profiles where user_id = ${context.userId} limit 1
      `;
      const row = rows[0];
      if (!row) return null;
      return {
        displayName: row.display_name,
        instrument: row.instrument === "bass" ? "bass" : "guitar",
        stompModel: parseStompModelId(row.stomp_model),
        genres: row.genres ? row.genres.split(",").filter(Boolean) : [],
      };
    } catch {
      return null;
    }
  });

const FeedbackFields = {
  message: z.string().max(800).optional().default(""),
  kind: z.enum(["site", "preset", "revise"]).optional().default("site"),
  song: z.string().max(120).optional().default(""),
  rating: z.number().int().min(1).max(5).optional(),
  closerTweaks: z.string().max(800).optional().default(""),
  wantPreset: z.string().max(800).optional().default(""),
  wantApp: z.string().max(800).optional().default(""),
};

function feedbackHasBody(d: {
  message: string;
  closerTweaks: string;
  wantPreset: string;
  wantApp: string;
  rating?: number;
}) {
  return (
    d.message.trim().length >= 4 ||
    d.closerTweaks.trim().length >= 4 ||
    d.wantPreset.trim().length >= 4 ||
    d.wantApp.trim().length >= 4 ||
    typeof d.rating === "number"
  );
}

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        ...FeedbackFields,
        email: z.string().max(160).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!feedbackHasBody(data)) {
      throw new Error("Write a little more so we can use it.");
    }
    const sql = await getSql();
    const message =
      data.message.trim() ||
      [data.closerTweaks, data.wantPreset, data.wantApp].filter((s) => s.trim().length >= 4).join("\n");
    try {
      await sql`
        insert into feedback (user_id, email, kind, message, song, rating, closer_tweaks, want_preset, want_app)
        values (
          ${"anon"}, ${data.email}, ${data.kind ?? "site"}, ${message}, ${data.song ?? ""},
          ${data.rating ?? null}, ${data.closerTweaks ?? ""}, ${data.wantPreset ?? ""}, ${data.wantApp ?? ""}
        )
      `;
    } catch {
      await sql`
        insert into feedback (user_id, email, kind, message, song)
        values (${"anon"}, ${data.email}, ${data.kind ?? "site"}, ${message}, ${data.song ?? ""})
      `;
    }
    return { ok: true as const };
  });

export const submitAuthedFeedbackFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object(FeedbackFields).parse(input))
  .handler(async ({ context, data }) => {
    if (!feedbackHasBody(data)) {
      throw new Error("Write a little more so we can use it.");
    }
    const email = (await emailFor(context.userId)) ?? "";
    const sql = await getSql();
    const message =
      data.message.trim() ||
      [data.closerTweaks, data.wantPreset, data.wantApp].filter((s) => s.trim().length >= 4).join("\n");
    try {
      await sql`
        insert into feedback (user_id, email, kind, message, song, rating, closer_tweaks, want_preset, want_app)
        values (
          ${context.userId}, ${email}, ${data.kind ?? "site"}, ${message}, ${data.song ?? ""},
          ${data.rating ?? null}, ${data.closerTweaks ?? ""}, ${data.wantPreset ?? ""}, ${data.wantApp ?? ""}
        )
      `;
    } catch {
      await sql`
        insert into feedback (user_id, email, kind, message, song)
        values (${context.userId}, ${email}, ${data.kind ?? "site"}, ${message}, ${data.song ?? ""})
      `;
    }
    return { ok: true as const };
  });

export const probeResearchFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { probeResearch } = await import("./gemini");
    return probeResearch();
  });
