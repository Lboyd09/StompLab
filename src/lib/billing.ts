import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assemblePlan, emptyPlan, isAdminEmail, yearMonth, type Plan } from "./plan";
import { createPolarCheckout, extractOrder, fetchPolarCheckout } from "./polar";
import type { UserGear } from "@/data/types";

async function emailFor(userId: string): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ email: string | null }>`select email from "user" where id = ${userId} limit 1`;
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

async function loadPlan(userId: string, email: string | null): Promise<Plan> {
  const sql = await getSql();
  const month = yearMonth();
  const ent = await sql<{ paid: boolean }>`
    select paid from entitlements where user_id = ${userId} limit 1
  `;
  const paidRow = Boolean(ent[0]?.paid);
  const lifetime = await sql<{ n: number }>`
    select count(*)::int as n from build_events where user_id = ${userId}
  `;
  const monthly = await sql<{ n: number }>`
    select count(*)::int as n from build_events where user_id = ${userId} and year_month = ${month}
  `;
  return assemblePlan({
    userId,
    email,
    paid: paidRow,
    freeUsed: Number(lifetime[0]?.n ?? 0),
    monthUsed: Number(monthly[0]?.n ?? 0),
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
}) {
  const sql = await getSql();
  await sql`
    insert into entitlements (user_id, email, paid, polar_customer_id, polar_order_id, amount_cents, paid_at, updated_at)
    values (${opts.userId}, ${opts.email}, true, ${opts.customerId}, ${opts.orderId}, ${opts.amountCents}, now(), now())
    on conflict (user_id) do update set
      paid = true,
      email = excluded.email,
      polar_customer_id = coalesce(nullif(excluded.polar_customer_id, ''), entitlements.polar_customer_id),
      polar_order_id = coalesce(nullif(excluded.polar_order_id, ''), entitlements.polar_order_id),
      amount_cents = excluded.amount_cents,
      paid_at = coalesce(entitlements.paid_at, now()),
      updated_at = now()
  `;
  try {
    await sql.query(
      `insert into purchases (user_id, email, polar_order_id, polar_checkout_id, amount_cents, raw)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict do nothing`,
      [
        opts.userId,
        opts.email,
        opts.orderId,
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
  const sql = await getSql();
  let userId = order.userId;
  if (!userId && email) {
    const rows = await sql<{ id: string }>`select id from "user" where lower(email) = ${email} limit 1`;
    userId = rows[0]?.id ?? "";
  }
  if (!userId) {
    await sql.query(
      `insert into purchases (user_id, email, polar_order_id, polar_checkout_id, amount_cents, raw)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      ["unmatched", email, order.orderId, order.checkoutId, order.amount, JSON.stringify(raw ?? {})],
    );
    return false;
  }
  await grantPaid({
    userId,
    email,
    orderId: order.orderId,
    checkoutId: order.checkoutId,
    amountCents: order.amount,
    customerId: order.customerId,
    raw,
  });
  return true;
}

export const startCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const email = await emailFor(context.userId);
    if (!email) {
      return { ok: false as const, error: "Your account needs an email before checkout." };
    }
    const origin =
      process.env.POLAR_SUCCESS_ORIGIN ??
      process.env.APP_ORIGIN ??
      "https://stomplab.vercel.app";
    return createPolarCheckout({
      email,
      userId: context.userId,
      successUrl: `${origin.replace(/\/$/, "")}/upgrade?checkout_id={CHECKOUT_ID}`,
    });
  });

export const confirmCheckout = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ checkoutId: z.string().min(4).max(120) }).parse(input))
  .handler(async ({ context, data }) => {
    const checkout = await fetchPolarCheckout(data.checkoutId);
    if (!checkout) return { ok: false as const, error: "Could not confirm that payment yet. Wait a few seconds." };
    const status = String(checkout.status ?? checkout.payment_status ?? "");
    const paid = /succeeded|paid|confirmed|complete/i.test(status) || Boolean(checkout.order_id);
    if (!paid) return { ok: false as const, error: "Payment is still processing." };
    const email = (await emailFor(context.userId)) ?? "";
    const order = extractOrder(checkout);
    await grantPaid({
      userId: context.userId,
      email: order.email || email,
      orderId: order.orderId || data.checkoutId,
      checkoutId: data.checkoutId,
      amountCents: order.amount,
      customerId: order.customerId,
      raw: checkout,
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
    const sql = await getSql();
    const purchases = await sql<{
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
    const usage = await sql<{
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
    const failures = await sql<{
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
    const cache = await sql<{
      cache_key: string;
      song: string;
      artist: string;
      instrument: string;
      stomp_model: string;
      hit_count: number;
    }>`
      select cache_key, song, artist, instrument, stomp_model, hit_count
      from rig_cache
      where kind = 'song'
      order by updated_at desc
      limit 80
    `;
    return { purchases, usage, failures, cache };
  });

export const adminDeleteCache = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => z.object({ key: z.string().min(4).max(240) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from rig_cache where cache_key = ${data.key}`;
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

export { loadPlan, emailFor };
