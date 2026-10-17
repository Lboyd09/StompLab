import type { Sql } from "./db";

/**
 * Abuse limits that hold across serverless instances (rows in `rate_limit_hits`),
 * with an in-memory counter as the backstop when the database cannot answer.
 */

const memoryHits = new Map<string, number[]>();

/** In-memory sliding window. Returns true when this hit is over the limit. */
export function memoryRateLimited(bucket: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (memoryHits.get(bucket) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    memoryHits.set(bucket, recent);
    return true;
  }
  recent.push(now);
  memoryHits.set(bucket, recent);
  if (memoryHits.size > 5000) {
    for (const [key, times] of memoryHits) {
      if (!times.some((t) => now - t < windowMs)) memoryHits.delete(key);
    }
  }
  return false;
}

export function resetMemoryRateLimits() {
  memoryHits.clear();
}

/**
 * Records one hit for `bucket` and reports whether it is over `max` in the last
 * `windowSec` seconds. Returns true when the caller must refuse.
 */
export async function rateLimited(
  getSql: () => Promise<Sql>,
  bucket: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const key = bucket.slice(0, 200);
  if (memoryRateLimited(`m:${key}`, max, windowSec * 1000)) return true;
  try {
    const sql = await getSql();
    const rows = await sql.query<{ id: number }>(
      `with recent as (
         select count(*)::int as n from rate_limit_hits
         where bucket = $1 and created_at > now() - ($3::int * interval '1 second')
       )
       insert into rate_limit_hits (bucket)
       select $1 from recent where n < $2
       returning id`,
      [key, max, windowSec],
    );
    if (!rows.length) return true;
    if (Math.random() < 0.02) {
      await sql
        .query(`delete from rate_limit_hits where created_at < now() - interval '1 day'`)
        .catch(() => undefined);
    }
    return false;
  } catch {
    // The memory window above already counted this hit.
    return false;
  }
}

/** Best client address from proxy headers. Vercel sets x-vercel-forwarded-for. */
export function clientIpFrom(headers: Headers): string {
  const first = (v: string | null) => (v ?? "").split(",")[0]?.trim() ?? "";
  const ip =
    first(headers.get("x-vercel-forwarded-for")) ||
    first(headers.get("x-real-ip")) ||
    first(headers.get("x-forwarded-for"));
  return ip.slice(0, 64) || "unknown";
}

export async function currentClientIp(): Promise<string> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    return request ? clientIpFrom(request.headers) : "unknown";
  } catch {
    return "unknown";
  }
}
