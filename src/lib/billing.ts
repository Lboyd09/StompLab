import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { assemblePlan, emptyPlan, isAdminEmail, yearMonth, type Plan } from "./plan";
import {
  createPolarCheckout,
  extractOrder,
  fetchPolarCheckout,
  isRealPolarOrderId,
  polarEventIsPaid,
  polarStatusIsPaid,
  purchaseLooksPaid,
} from "./polar";
import type { UserGear } from "@/data/types";

export async function emailFor(userId: string): Promise<string | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ email: string | null }>`select email from "user" where id = ${userId} limit 1`;
    return rows[0]?.email ?? null;
  } catch {
    return null;
  }
}

type EntRow = {
  paid: boolean;
  paid_source?: string | null;
  polar_order_id?: string | null;
  email?: string | null;
};

async function markAdminPaid(userId: string, email: string) {
  const sql = await getSql();
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

async function revokeStolenGrant(userId: string) {
  const sql = await getSql();
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

function orderIdFromPurchase(raw: unknown, fallback: string): string {
  if (raw && typeof raw === "object") {
    const extracted = extractOrder(raw as Record<string, unknown>);
    if (isRealPolarOrderId(extracted.orderId)) return extracted.orderId;
  }
  return isRealPolarOrderId(fallback) ? fallback : "";
}

/**
 * Paid is true only for the exact admin email, or a Polar row that looks like
 * a real payment (order.paid / checkout succeeded). Checkout.created grants
 * are revoked here so the back button cannot unlock the Lab.
 */
async function paidVerifiedFor(userId: string, email: string | null, row: EntRow | undefined): Promise<boolean> {
  if (isAdminEmail(email)) {
    await markAdminPaid(userId, email ?? "");
    return true;
  }
  const sql = await getSql();
  const source = String(row?.paid_source ?? "").trim().toLowerCase();
  const storedOrder = String(row?.polar_order_id ?? "").trim();
  if (row?.paid && source === "polar" && isRealPolarOrderId(storedOrder)) {
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
    return purchaseLooksPaid(p.raw) && isRealPolarOrderId(oid);
  });
  if (good) {
    const oid = orderIdFromPurchase(good.raw, good.polar_order_id);
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
    return true;
  }

  if (row?.paid) await revokeStolenGrant(userId);
  return false;
}

export async function loadPlan(userId: string, email: string | null): Promise<Plan> {
  const sql = await getSql();
  const month = yearMonth();
  let ent: EntRow[] = [];
  try {
    ent = await sql<EntRow>`
      select paid, paid_source, polar_order_id, email from entitlements where user_id = ${userId} limit 1
    `;
  } catch {
    ent = await sql<EntRow>`
      select paid, polar_order_id, email from entitlements where user_id = ${userId} limit 1
    `;
  }
  const paid = await paidVerifiedFor(userId, email, ent[0]);
  const lifetime = await sql<{ n: number }>`
    select count(*)::int as n from build_events where user_id = ${userId}
  `;
  const monthly = await sql<{ n: number }>`
    select count(*)::int as n from build_events where user_id = ${userId} and year_month = ${month}
  `;
  return assemblePlan({
    userId,
    email,
    paid,
    freeUsed: Number(lifetime[0]?.n ?? 0),
    monthUsed: Number(monthly[0]?.n ?? 0),
  });
}

export const getMyPlan = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Plan> => {
    // Email comes ONLY from the user row for this session's userId.
    // Never prefer a cached session email — that is how iCloud became admin.
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
  if (!isRealPolarOrderId(opts.orderId)) {
    throw new Error("Refusing to grant without a Polar order id.");
  }
  if (opts.raw && typeof opts.raw === "object" && !polarEventIsPaid(opts.raw as Record<string, unknown>)) {
    const statusOk = polarStatusIsPaid(opts.raw as Record<string, unknown>);
    if (!statusOk) throw new Error("Refusing to grant on an unpaid Polar event.");
  }
  const sql = await getSql();
  try {
    await sql`
      insert into entitlements (user_id, email, paid, paid_source, polar_customer_id, polar_order_id, amount_cents, paid_at, updated_at)
      values (${opts.userId}, ${opts.email}, true, ${"polar"}, ${opts.customerId}, ${opts.orderId}, ${opts.amountCents}, now(), now())
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
  }
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
  if (!polarEventIsPaid(raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {})) {
    return false;
  }
  if (!isRealPolarOrderId(order.orderId)) return false;
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
    const plan = await loadPlan(context.userId, email);
    if (plan.paid) {
      return { ok: false as const, error: "This account is already unlocked." };
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
    let notes: { created_at: string; email: string; kind: string; song: string; message: string }[] = [];
    try {
      notes = await sql<{
        created_at: string;
        email: string;
        kind: string;
        song: string;
        message: string;
      }>`
        select created_at::text, email, kind, song, message
        from feedback
        order by created_at desc
        limit 80
      `;
    } catch {
      notes = [];
    }
    const entitlements = await sql<{
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
    `.catch(async () => {
      return sql<{
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
    });
    return { purchases, usage, failures, cache, feedback: notes, entitlements };
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

export type Profile = {
  displayName: string;
  instrument: "guitar" | "bass";
  stompModel: "hx-stomp" | "hx-stomp-xl";
  genres: string[];
};

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        displayName: z.string().max(80).optional().default(""),
        instrument: z.enum(["guitar", "bass"]).optional().default("guitar"),
        stompModel: z.enum(["hx-stomp", "hx-stomp-xl"]).optional().default("hx-stomp"),
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
        stompModel: row.stomp_model === "hx-stomp-xl" ? "hx-stomp-xl" : "hx-stomp",
        genres: row.genres ? row.genres.split(",").filter(Boolean) : [],
      };
    } catch {
      return null;
    }
  });

export const submitFeedbackFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        message: z.string().min(4).max(800),
        kind: z.enum(["site", "preset", "revise"]).optional().default("site"),
        song: z.string().max(120).optional().default(""),
        email: z.string().max(160).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into feedback (user_id, email, kind, message, song)
      values (${"anon"}, ${data.email}, ${data.kind ?? "site"}, ${data.message}, ${data.song ?? ""})
    `;
    return { ok: true as const };
  });

export const submitAuthedFeedbackFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    z
      .object({
        message: z.string().min(4).max(800),
        kind: z.enum(["site", "preset", "revise"]).optional().default("site"),
        song: z.string().max(120).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const email = (await emailFor(context.userId)) ?? "";
    const sql = await getSql();
    await sql`
      insert into feedback (user_id, email, kind, message, song)
      values (${context.userId}, ${email}, ${data.kind ?? "site"}, ${data.message}, ${data.song ?? ""})
    `;
    return { ok: true as const };
  });

export const probeResearchFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { probeResearch } = await import("./gemini");
    return probeResearch();
  });
