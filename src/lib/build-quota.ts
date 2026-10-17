import type { Sql, SqlTx } from "./db";
import { FREE_BUILDS, PAID_MONTHLY_BUILDS, yearMonth } from "./plan";

/**
 * Reserve, then confirm. A build row is inserted as 'reserved' inside one
 * transaction (guarded by an advisory lock and a count), so two requests in
 * flight cannot both take the last slot. The row is confirmed when a real preset
 * exists and deleted when the build fails. A reservation stops counting after
 * RESERVATION_TTL_MINUTES, so a function that dies mid-request cannot burn a
 * slot forever.
 */
export const RESERVATION_TTL_MINUTES = 10;

/** SQL predicate for the build_events rows that count against a quota. */
export const COUNTED_BUILD_SQL = `(status = 'confirmed' or (status = 'reserved' and created_at > now() - interval '${RESERVATION_TTL_MINUTES} minutes'))`;

export type BuildReservation = { id: number; userId: string; kind: string; song: string };

export type ReserveResult =
  | { ok: true; reservation: BuildReservation }
  | { ok: false; reason: "paywall" | "quota" };

export type ReserveInput = {
  userId: string;
  /** Every account id that shares this player's email (includes userId). */
  ids: string[];
  kind: string;
  song: string;
  paid: boolean;
  admin: boolean;
  month?: string;
  /** Insert as confirmed right away (cache hits have no model call to wait for). */
  confirmed?: boolean;
};

/**
 * Invite bonus builds for a paid player. The bonus is a one-time pool, so builds
 * that earlier months already took past the monthly cap use it up first.
 */
export async function paidBonusRemaining(
  sql: Sql,
  ids: string[],
  month: string,
  bonusTotal: number,
): Promise<number> {
  if (bonusTotal <= 0) return 0;
  const rows = await sql.query<{ n: number }>(
    `select coalesce(sum(greatest(0, n - $3)), 0)::int as n from (
       select count(*)::int as n from build_events
       where user_id = any($1::text[]) and year_month < $2 and status = 'confirmed'
       group by year_month
     ) t`,
    [ids, month, PAID_MONTHLY_BUILDS],
  );
  const spent = Number(rows[0]?.n ?? 0);
  return Math.max(0, bonusTotal - spent);
}

export async function bonusTotalFor(sql: Sql, ids: string[]): Promise<number> {
  const rows = await sql.query<{ n: number }>(
    `select coalesce(sum(bonus_builds), 0)::int as n from entitlements where user_id = any($1::text[])`,
    [ids],
  );
  return Math.max(0, Number(rows[0]?.n ?? 0));
}

/**
 * Take a slot or say why not. Throws when the count cannot be read: callers must
 * fail closed (the player is told to retry), never grant the build.
 */
export async function reserveBuild(tx: SqlTx, input: ReserveInput): Promise<ReserveResult> {
  const month = input.month ?? yearMonth();
  const ids = [...new Set([input.userId, ...input.ids])].sort();
  return tx(async (sql) => {
    await sql.query(`select pg_advisory_xact_lock(hashtext($1))`, [`build:${ids[0]}`]);
    if (!input.admin) {
      const bonus = await bonusTotalFor(sql, ids);
      const limit = input.paid
        ? PAID_MONTHLY_BUILDS + (await paidBonusRemaining(sql, ids, month, bonus))
        : FREE_BUILDS + bonus;
      const rows = input.paid
        ? await sql.query<{ n: number }>(
            `select count(*)::int as n from build_events
             where user_id = any($1::text[]) and year_month = $2 and ${COUNTED_BUILD_SQL}`,
            [ids, month],
          )
        : await sql.query<{ n: number }>(
            `select count(*)::int as n from build_events
             where user_id = any($1::text[]) and ${COUNTED_BUILD_SQL}`,
            [ids],
          );
      if (!rows.length || rows[0]?.n === undefined || rows[0]?.n === null) {
        throw new Error("build count unreadable");
      }
      if (Number(rows[0].n) >= limit) return { ok: false as const, reason: input.paid ? "quota" : "paywall" };
    }
    await sql.query(
      `delete from build_events where user_id = any($1::text[]) and status = 'reserved' and created_at < now() - interval '1 hour'`,
      [ids],
    );
    const inserted = await sql.query<{ id: number }>(
      `insert into build_events (user_id, kind, song, year_month, status)
       values ($1, $2, $3, $4, $5) returning id`,
      [input.userId, input.kind, input.song.slice(0, 200), month, input.confirmed ? "confirmed" : "reserved"],
    );
    const id = Number(inserted[0]?.id);
    if (!Number.isFinite(id)) throw new Error("build reservation failed");
    return {
      ok: true as const,
      reservation: { id, userId: input.userId, kind: input.kind, song: input.song },
    };
  });
}

/** The model returned a real preset: the build counts for good. */
export async function confirmBuild(sql: Sql, reservation: BuildReservation, month = yearMonth()): Promise<void> {
  const rows = await sql.query<{ id: number }>(
    `update build_events set status = 'confirmed'
     where id = $1 and user_id = $2 and status = 'reserved' returning id`,
    [reservation.id, reservation.userId],
  );
  if (rows.length) return;
  const already = await sql.query<{ id: number }>(
    `select id from build_events where id = $1 and user_id = $2 and status = 'confirmed'`,
    [reservation.id, reservation.userId],
  );
  if (already.length) return;
  // The reservation was swept after a very slow call. The build still happened.
  await sql.query(
    `insert into build_events (user_id, kind, song, year_month, status) values ($1, $2, $3, $4, 'confirmed')`,
    [reservation.userId, reservation.kind, reservation.song.slice(0, 200), month],
  );
}

/** The build failed or returned nothing: give the slot back. */
export async function releaseBuild(sql: Sql, reservation: BuildReservation): Promise<void> {
  await sql.query(`delete from build_events where id = $1 and user_id = $2 and status = 'reserved'`, [
    reservation.id,
    reservation.userId,
  ]);
}
