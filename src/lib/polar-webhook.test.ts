import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, describe, it } from "node:test";
import {
  WEBHOOK_TOLERANCE_SECONDS,
  checkPolarWebhook,
  claimWebhookEvent,
  releaseWebhookEvent,
  verifyPolarWebhook,
} from "./polar-webhook";
import {
  polarEventIsRefund,
  polarEventLapsedStatus,
  polarEventTime,
  subscriptionGrantsAccess,
} from "./polar";
import { makeTestDb } from "./test-db";

const SECRET = "whsec_test_secret";
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);

function sign(body: string, id: string, ts: string) {
  return `v1,${createHmac("sha256", SECRET).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

function headers(body: string, opts: { id?: string; ts?: number; sig?: string } = {}) {
  const id = opts.id ?? "evt_1";
  const ts = String(opts.ts ?? Math.floor(NOW / 1000));
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": ts,
    "webhook-signature": opts.sig ?? sign(body, id, ts),
  });
}

describe("Polar webhook signature", () => {
  before(() => {
    process.env.POLAR_WEBHOOK_SECRET = SECRET;
  });
  after(() => {
    delete process.env.POLAR_WEBHOOK_SECRET;
  });

  const body = JSON.stringify({ type: "order.paid", data: { id: "ord_12345678" } });

  it("accepts a fresh, correctly signed delivery", () => {
    assert.equal(verifyPolarWebhook(body, headers(body), NOW), true);
    const check = checkPolarWebhook(body, headers(body, { id: "evt_77" }), NOW);
    assert.deepEqual(check, { ok: true, id: "evt_77" });
  });

  it("rejects a delivery older than five minutes, and one dated in the future", () => {
    const old = Math.floor(NOW / 1000) - WEBHOOK_TOLERANCE_SECONDS - 5;
    const future = Math.floor(NOW / 1000) + WEBHOOK_TOLERANCE_SECONDS + 5;
    assert.deepEqual(checkPolarWebhook(body, headers(body, { ts: old }), NOW), { ok: false, reason: "stale" });
    assert.deepEqual(checkPolarWebhook(body, headers(body, { ts: future }), NOW), { ok: false, reason: "stale" });
    const edge = Math.floor(NOW / 1000) - WEBHOOK_TOLERANCE_SECONDS + 5;
    assert.equal(verifyPolarWebhook(body, headers(body, { ts: edge }), NOW), true);
  });

  it("no longer accepts an HMAC over the body alone", () => {
    const bodyOnly = `v1,${createHmac("sha256", SECRET).update(body).digest("base64")}`;
    assert.equal(verifyPolarWebhook(body, headers(body, { sig: bodyOnly }), NOW), false);
    const bare = createHmac("sha256", SECRET).update(body).digest("base64");
    assert.equal(verifyPolarWebhook(body, headers(body, { sig: bare }), NOW), false);
  });

  it("rejects a tampered body, a wrong secret, and missing headers", () => {
    assert.equal(verifyPolarWebhook(`${body} `, headers(body), NOW), false);
    const wrong = `v1,${createHmac("sha256", "other").update(`evt_1.${Math.floor(NOW / 1000)}.${body}`).digest("base64")}`;
    assert.equal(verifyPolarWebhook(body, headers(body, { sig: wrong }), NOW), false);
    assert.equal(verifyPolarWebhook(body, new Headers(), NOW), false);
    const noId = headers(body);
    noId.delete("webhook-id");
    assert.equal(verifyPolarWebhook(body, noId, NOW), false);
  });

  it("is closed when no secret is set", () => {
    delete process.env.POLAR_WEBHOOK_SECRET;
    assert.equal(verifyPolarWebhook(body, headers(body), NOW), false);
    process.env.POLAR_WEBHOOK_SECRET = SECRET;
  });
});

describe("Polar webhook dedupe", () => {
  it("accepts a webhook-id once, and again only after a failed run releases it", async () => {
    const { sql } = await makeTestDb();
    assert.equal(await claimWebhookEvent(sql, "evt_a", "order.paid"), true);
    assert.equal(await claimWebhookEvent(sql, "evt_a", "order.paid"), false);
    assert.equal(await claimWebhookEvent(sql, "evt_b", "order.paid"), true);
    await releaseWebhookEvent(sql, "evt_a");
    assert.equal(await claimWebhookEvent(sql, "evt_a", "order.paid"), true);
  });

  it("two deliveries of the same id at once: one wins", async () => {
    const { sql } = await makeTestDb();
    const results = await Promise.all([
      claimWebhookEvent(sql, "evt_race", "order.paid"),
      claimWebhookEvent(sql, "evt_race", "order.paid"),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
  });
});

describe("Polar event reading", () => {
  it("reads the event time from the object, then the envelope", () => {
    assert.equal(
      polarEventTime({ type: "subscription.updated", timestamp: "2026-10-17T10:00:00Z", data: { modified_at: "2026-10-17T11:00:00Z" } }),
      "2026-10-17T11:00:00.000Z",
    );
    assert.equal(polarEventTime({ timestamp: "2026-10-17T10:00:00Z", data: {} }), "2026-10-17T10:00:00.000Z");
    assert.equal(polarEventTime({ data: {} }), "");
  });

  it("canceled keeps access only until the period ends", () => {
    const now = NOW;
    const future = new Date(now + 86_400_000).toISOString();
    const past = new Date(now - 86_400_000).toISOString();
    assert.equal(subscriptionGrantsAccess({ status: "active", now }), true);
    assert.equal(subscriptionGrantsAccess({ status: "trialing", now }), true);
    assert.equal(subscriptionGrantsAccess({ status: "canceled", currentPeriodEnd: future, now }), true);
    assert.equal(subscriptionGrantsAccess({ status: "canceled", currentPeriodEnd: past, now }), false);
    for (const status of ["past_due", "unpaid", "revoked", "refunded", "incomplete", ""]) {
      assert.equal(subscriptionGrantsAccess({ status, currentPeriodEnd: future, now }), false, status);
    }
  });

  it("sees refunds and lapsed invoices", () => {
    assert.equal(polarEventIsRefund({ type: "order.refunded", data: { status: "refunded", id: "ord_1" } }), true);
    assert.equal(polarEventIsRefund({ type: "order.refunded", data: { status: "partially_refunded" } }), false);
    assert.equal(polarEventIsRefund({ type: "refund.updated", data: { status: "succeeded", revoke_benefits: true } }), true);
    assert.equal(polarEventIsRefund({ type: "refund.updated", data: { status: "succeeded", revoke_benefits: false } }), false);
    assert.equal(polarEventIsRefund({ type: "order.paid", data: {} }), false);
    assert.equal(polarEventLapsedStatus({ type: "subscription.past_due", data: {} }), "past_due");
    assert.equal(polarEventLapsedStatus({ type: "subscription.updated", data: { status: "unpaid" } }), "unpaid");
    assert.equal(polarEventLapsedStatus({ type: "subscription.updated", data: { status: "active" } }), "");
  });
});
