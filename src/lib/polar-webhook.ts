import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db";

/** Polar signs `${webhook-id}.${webhook-timestamp}.${body}`. Older deliveries are replays. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function hmacB64(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

export type WebhookCheck =
  | { ok: true; id: string }
  | { ok: false; reason: "no-secret" | "headers" | "stale" | "signature" };

export function checkPolarWebhook(rawBody: string, headers: Headers, now = Date.now()): WebhookCheck {
  const secret = (process.env.POLAR_WEBHOOK_SECRET ?? "").trim();
  if (!secret) return { ok: false, reason: "no-secret" };
  const id = (headers.get("webhook-id") ?? "").trim();
  const ts = (headers.get("webhook-timestamp") ?? "").trim();
  const sigHeader = headers.get("webhook-signature") ?? headers.get("x-polar-signature") ?? "";
  if (!id || !ts || !sigHeader) return { ok: false, reason: "headers" };
  const seconds = Number(ts);
  if (!Number.isFinite(seconds)) return { ok: false, reason: "headers" };
  if (Math.abs(now / 1000 - seconds) > WEBHOOK_TOLERANCE_SECONDS) return { ok: false, reason: "stale" };

  const expected = Buffer.from(hmacB64(secret, `${id}.${ts}.${rawBody}`));
  for (const part of sigHeader.split(/\s+/)) {
    const m = /^v1[,=](.+)$/.exec(part.trim());
    if (!m) continue;
    const given = Buffer.from(m[1]);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true, id };
  }
  return { ok: false, reason: "signature" };
}

export function verifyPolarWebhook(rawBody: string, headers: Headers, now = Date.now()): boolean {
  return checkPolarWebhook(rawBody, headers, now).ok;
}

/**
 * Remember this webhook-id. True the first time, false for a replay. A handler
 * that fails calls `releaseWebhookEvent` so Polar's retry is processed, not swallowed.
 */
export async function claimWebhookEvent(sql: Sql, webhookId: string, eventType: string): Promise<boolean> {
  const rows = await sql.query<{ webhook_id: string }>(
    `insert into polar_webhook_events (webhook_id, event_type) values ($1, $2)
     on conflict (webhook_id) do nothing returning webhook_id`,
    [webhookId.slice(0, 200), eventType.slice(0, 80)],
  );
  if (rows.length && Math.random() < 0.02) {
    await sql
      .query(`delete from polar_webhook_events where received_at < now() - interval '30 days'`)
      .catch(() => undefined);
  }
  return rows.length > 0;
}

export async function releaseWebhookEvent(sql: Sql, webhookId: string): Promise<void> {
  await sql.query(`delete from polar_webhook_events where webhook_id = $1`, [webhookId.slice(0, 200)]);
}
