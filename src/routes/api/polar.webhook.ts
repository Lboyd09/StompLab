import { createFileRoute } from "@tanstack/react-router";
import { grantPaidByEmail, markSubscriptionCanceled, revokeSubscriptionByEmail } from "@/lib/billing";
import {
  extractOrder,
  polarEventIsPaid,
  polarEventIsSubscriptionCanceled,
  polarEventIsSubscriptionGrant,
  polarEventIsSubscriptionRevoke,
} from "@/lib/polar";
import { verifyPolarWebhook } from "@/lib/polar-webhook";

export const Route = createFileRoute("/api/polar/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verifyPolarWebhook(raw, request.headers)) {
          return new Response("invalid signature", { status: 401 });
        }
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const order = extractOrder(payload);
        if (polarEventIsSubscriptionRevoke(payload)) {
          try {
            await revokeSubscriptionByEmail(order.email, order.subscriptionId, payload);
          } catch {
            return new Response("revoke failed", { status: 500 });
          }
          return new Response("ok");
        }
        if (polarEventIsSubscriptionCanceled(payload)) {
          try {
            await markSubscriptionCanceled({
              email: order.email,
              subscriptionId: order.subscriptionId,
              periodEnd: order.currentPeriodEnd,
              raw: payload,
            });
          } catch {
            return new Response("cancel failed", { status: 500 });
          }
          return new Response("ok");
        }
        // checkout.created / order.created / confirmed MUST NOT unlock.
        if (!polarEventIsPaid(payload) && !polarEventIsSubscriptionGrant(payload)) {
          return new Response("ok");
        }
        const email = order.email;
        if (!email || (!order.orderId && !order.subscriptionId)) return new Response("ok");
        try {
          await grantPaidByEmail(email, order, payload);
        } catch {
          return new Response("grant failed", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
