import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. That header is the
 * only credential: the x-vercel-cron header is not secret and is never trusted.
 * With no CRON_SECRET set, nobody is authorized.
 */
export function cronAuthorized(request: Request, secret = process.env.CRON_SECRET ?? ""): boolean {
  const expected = secret.trim();
  if (!expected) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${expected}`);
  return given.length === want.length && timingSafeEqual(given, want);
}
