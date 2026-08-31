import { createFileRoute } from "@tanstack/react-router";
import { grantPaidByEmail } from "@/lib/billing";
import { extractOrder, polarEventIsPaid } from "@/lib/polar";
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
        // checkout.created / order.created / confirmed MUST NOT unlock.
        if (!polarEventIsPaid(payload)) {
          return new Response("ok");
        }
        const order = extractOrder(payload);
        const email = order.email;
        if (!email || !order.orderId) return new Response("ok");
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
