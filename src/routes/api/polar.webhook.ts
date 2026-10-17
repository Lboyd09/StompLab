import { createFileRoute } from "@tanstack/react-router";
import {
  grantPaidByEmail,
  markSubscriptionCanceled,
  markSubscriptionLapsed,
  revokeForRefund,
  revokeSubscription,
} from "@/lib/billing";
import { getSql } from "@/lib/db";
import {
  extractOrder,
  polarEventIsPaid,
  polarEventIsRefund,
  polarEventIsSubscriptionCanceled,
  polarEventIsSubscriptionGrant,
  polarEventIsSubscriptionRevoke,
  polarEventLapsedStatus,
  polarEventTime,
  polarEventType,
} from "@/lib/polar";
import { checkPolarWebhook, claimWebhookEvent, releaseWebhookEvent } from "@/lib/polar-webhook";

type Payload = Record<string, unknown>;

/** Apply one verified event. Throws when the change could not be stored (Polar will retry). */
async function handleEvent(payload: Payload): Promise<void> {
  const order = extractOrder(payload);
  const eventAt = polarEventTime(payload) || null;
  if (polarEventIsSubscriptionRevoke(payload)) {
    await revokeSubscription({
      email: order.email,
      subscriptionId: order.subscriptionId,
      orderId: order.orderId,
      eventAt,
      raw: payload,
    });
    return;
  }
  if (polarEventIsRefund(payload)) {
    await revokeForRefund({
      email: order.email,
      subscriptionId: order.subscriptionId,
      orderId: order.orderId,
      eventAt,
      raw: payload,
    });
    return;
  }
  const lapsed = polarEventLapsedStatus(payload);
  if (lapsed) {
    await markSubscriptionLapsed({
      email: order.email,
      subscriptionId: order.subscriptionId,
      status: lapsed,
      eventAt,
    });
    return;
  }
  if (polarEventIsSubscriptionCanceled(payload)) {
    await markSubscriptionCanceled({
      email: order.email,
      subscriptionId: order.subscriptionId,
      periodEnd: order.currentPeriodEnd,
      eventAt,
      raw: payload,
    });
    return;
  }
  // checkout.created / order.created / confirmed MUST NOT unlock.
  if (!polarEventIsPaid(payload) && !polarEventIsSubscriptionGrant(payload)) return;
  if (!order.email || (!order.orderId && !order.subscriptionId)) return;
  await grantPaidByEmail(order.email, order, payload, eventAt);
}

export const Route = createFileRoute("/api/polar/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const check = checkPolarWebhook(raw, request.headers);
        if (!check.ok) return new Response("invalid signature", { status: 401 });
        let payload: Payload = {};
        try {
          payload = JSON.parse(raw) as Payload;
        } catch {
          return new Response("bad json", { status: 400 });
        }
        let sql: Awaited<ReturnType<typeof getSql>>;
        try {
          sql = await getSql();
          if (!(await claimWebhookEvent(sql, check.id, polarEventType(payload)))) {
            return new Response("ok");
          }
        } catch {
          return new Response("busy", { status: 500 });
        }
        try {
          await handleEvent(payload);
        } catch (err) {
          console.error("[polar] webhook failed", polarEventType(payload), err instanceof Error ? err.message : err);
          await releaseWebhookEvent(sql, check.id).catch(() => undefined);
          return new Response("failed", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
