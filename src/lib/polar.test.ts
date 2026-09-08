import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractOrder,
  isRealPolarOrderId,
  polarCheckoutIsReady,
  polarCheckoutNeedsPoll,
  polarConfigured,
  polarEventIsPaid,
  polarEventIsSubscriptionGrant,
  polarEventIsSubscriptionRevoke,
  polarFriendlyError,
  polarPortalUrlFromPayload,
  polarSetup,
  polarStatusIsPaid,
  purchaseLooksPaid,
  polarAdminStatsFromLists,
} from "./polar.ts";

describe("polarEventIsPaid", () => {
  it("never grants on checkout.created", () => {
    assert.equal(
      polarEventIsPaid({ type: "checkout.created", data: { id: "checkout_abc12345", status: "open" } }),
      false,
    );
  });
  it("never grants on order.created (pending)", () => {
    assert.equal(
      polarEventIsPaid({ type: "order.created", data: { id: "order_abc12345", status: "pending" } }),
      false,
    );
  });
  it("never treats confirmed/complete as paid until an order exists", () => {
    assert.equal(polarStatusIsPaid({ status: "confirmed" }), false);
    assert.equal(polarStatusIsPaid({ status: "complete" }), false);
    assert.equal(polarStatusIsPaid({ status: "open" }), false);
    assert.equal(
      polarEventIsPaid({ type: "checkout.updated", data: { id: "checkout_abc12345", status: "confirmed" } }),
      false,
    );
    assert.equal(polarCheckoutNeedsPoll({ status: "complete" }), true);
    assert.equal(
      polarCheckoutIsReady({
        status: "complete",
        order_id: "order_abc12345",
      }),
      true,
    );
    assert.equal(polarCheckoutIsReady({ status: "confirmed" }), false);
    assert.equal(
      polarCheckoutIsReady({
        status: "confirmed",
        order_id: "order_abc12345",
      }),
      true,
    );
  });
  it("grants on order.paid", () => {
    assert.equal(
      polarEventIsPaid({ type: "order.paid", data: { id: "order_abc12345", status: "paid" } }),
      true,
    );
  });
  it("grants on checkout succeeded/paid only", () => {
    assert.equal(
      polarEventIsPaid({
        type: "checkout.updated",
        data: { id: "checkout_abc12345", status: "succeeded", order_id: "order_abc12345" },
      }),
      true,
    );
    assert.equal(polarStatusIsPaid({ status: "paid" }), true);
    assert.equal(polarStatusIsPaid({ status: "succeeded" }), true);
  });
});

describe("extractOrder", () => {
  it("does not use a checkout id as the order id", () => {
    const order = extractOrder({
      type: "checkout.created",
      data: { id: "checkout_abc12345", status: "open", customer_email: "a@b.com" },
    });
    assert.equal(order.orderId, "");
    assert.equal(order.checkoutId, "checkout_abc12345");
  });
  it("reads order.id on order.paid", () => {
    const order = extractOrder({
      type: "order.paid",
      data: {
        id: "order_real_999",
        checkout_id: "checkout_abc12345",
        customer_email: "a@b.com",
        metadata: { user_id: "user-1" },
        amount: 1900,
      },
    });
    assert.equal(order.orderId, "order_real_999");
    assert.equal(order.checkoutId, "checkout_abc12345");
    assert.equal(order.userId, "user-1");
    assert.equal(order.email, "a@b.com");
  });
  it("reads subscription.id on subscription.active", () => {
    const order = extractOrder({
      type: "subscription.active",
      data: {
        id: "sub_real_99999",
        status: "active",
        customer_email: "a@b.com",
        metadata: { user_id: "user-1", interval: "month" },
        recurring_interval: "month",
      },
    });
    assert.equal(order.subscriptionId, "sub_real_99999");
    assert.equal(order.email, "a@b.com");
    assert.equal(order.interval, "month");
    assert.equal(order.orderId, "");
  });
  it("reads checkout.order_id on a succeeded checkout", () => {
    const order = extractOrder({
      type: "checkout.updated",
      data: {
        id: "checkout_abc12345",
        order_id: "order_real_999",
        status: "succeeded",
        customer_email: "a@b.com",
      },
    });
    assert.equal(order.orderId, "order_real_999");
    assert.equal(order.checkoutId, "checkout_abc12345");
  });
});

describe("isRealPolarOrderId", () => {
  it("rejects empty and checkout-prefixed ids", () => {
    assert.equal(isRealPolarOrderId(""), false);
    assert.equal(isRealPolarOrderId("short"), false);
    assert.equal(isRealPolarOrderId("checkout_abc12345"), false);
    assert.equal(isRealPolarOrderId("order_abc12345"), true);
  });
});

describe("purchaseLooksPaid", () => {
  it("rejects stolen checkout.created rows", () => {
    assert.equal(purchaseLooksPaid({ type: "checkout.created", data: { id: "checkout_abc12345" } }), false);
    assert.equal(purchaseLooksPaid({ type: "order.paid", data: { id: "order_abc12345", status: "paid" } }), true);
  });
  it("grants on subscription.active", () => {
    assert.equal(polarEventIsSubscriptionGrant({ type: "subscription.active", data: { id: "sub_abc12345", status: "active" } }), true);
    assert.equal(purchaseLooksPaid({ type: "subscription.active", data: { id: "sub_abc12345", status: "active" } }), true);
  });
  it("does not grant on subscription.canceled", () => {
    assert.equal(
      polarEventIsPaid({ type: "subscription.canceled", data: { id: "sub_abc12345", status: "canceled" } }),
      false,
    );
    assert.equal(
      polarEventIsSubscriptionGrant({ type: "subscription.canceled", data: { id: "sub_abc12345", status: "canceled" } }),
      false,
    );
  });
  it("revokes on subscription.revoked", () => {
    assert.equal(
      polarEventIsSubscriptionRevoke({ type: "subscription.revoked", data: { id: "sub_abc12345", status: "revoked" } }),
      true,
    );
  });
});

describe("polarPortalUrlFromPayload", () => {
  it("reads customer_portal_url and polar_cst tokens", () => {
    assert.equal(
      polarPortalUrlFromPayload({ customer_portal_url: "https://polar.sh/portal/abc" }),
      "https://polar.sh/portal/abc",
    );
    assert.equal(
      polarPortalUrlFromPayload({ data: { customer_portal_url: "https://sandbox.polar.sh/portal/x" } }),
      "https://sandbox.polar.sh/portal/x",
    );
    assert.match(
      polarPortalUrlFromPayload({ token: "polar_cst_abc123" }),
      /customer-portal\?customer_session_token=polar_cst_abc123/,
    );
    assert.equal(polarPortalUrlFromPayload({ url: "/relative" }), "");
  });
});

describe("polarFriendlyError", () => {
  it("maps 401/Unauthorized to Polar key copy, not a raw Unauthorized", () => {
    const msg = polarFriendlyError(401, "Unauthorized");
    assert.match(msg, /Polar rejected the checkout key/);
    assert.equal(/unauthorized/i.test(msg), false);
  });
  it("maps missing product ids", () => {
    assert.match(polarFriendlyError(422, "Product not found"), /does not recognize this product/);
    assert.match(polarFriendlyError(404, ""), /does not recognize this product/);
  });
  it("maps a rejected Polar return URL to domain copy", () => {
    assert.match(polarFriendlyError(422, "Invalid success_url"), /real domain/);
    assert.match(polarFriendlyError(422, "customer email is required"), /needs the email/);
  });
});

describe("polarSetup", () => {
  const keys = [
    "POLAR_ACCESS_TOKEN",
    "POLAR_OAT",
    "POLAR_PRODUCT_ID_MONTHLY",
    "POLAR_PRODUCT_ID_YEARLY",
    "POLAR_PRODUCT_ID",
    "POLAR_MONTHLY_PRODUCT_ID",
    "POLAR_YEARLY_PRODUCT_ID",
    "POLAR_PRODUCT_MONTHLY",
    "POLAR_PRODUCT_YEARLY",
  ] as const;

  function snap() {
    return Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  }

  function restore(prev: Record<string, string | undefined>) {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }

  it("lists token / monthly / yearly independently and stays ready with only yearly", () => {
    const prev = snap();
    try {
      process.env.POLAR_ACCESS_TOKEN = "polar_tok";
      delete process.env.POLAR_OAT;
      delete process.env.POLAR_PRODUCT_ID_MONTHLY;
      delete process.env.POLAR_PRODUCT_ID;
      delete process.env.POLAR_MONTHLY_PRODUCT_ID;
      delete process.env.POLAR_PRODUCT_MONTHLY;
      process.env.POLAR_PRODUCT_ID_YEARLY = "prod_year";
      const s = polarSetup();
      assert.equal(s.token, true);
      assert.equal(s.monthly, false);
      assert.equal(s.yearly, true);
      assert.equal(s.ready, true);
      assert.equal(polarConfigured(), true);
    } finally {
      restore(prev);
    }
  });

  it("accepts POLAR_YEARLY_PRODUCT_ID as an alias", () => {
    const prev = snap();
    try {
      process.env.POLAR_ACCESS_TOKEN = "polar_tok";
      delete process.env.POLAR_PRODUCT_ID_YEARLY;
      delete process.env.POLAR_PRODUCT_YEARLY;
      process.env.POLAR_YEARLY_PRODUCT_ID = "prod_year_alias";
      const s = polarSetup();
      assert.equal(s.yearly, true);
      assert.equal(s.ready, true);
    } finally {
      restore(prev);
    }
  });

  it("is not ready when the token is missing even if product ids are set", () => {
    const prev = snap();
    try {
      delete process.env.POLAR_ACCESS_TOKEN;
      delete process.env.POLAR_OAT;
      process.env.POLAR_PRODUCT_ID_MONTHLY = "prod_month";
      process.env.POLAR_PRODUCT_ID_YEARLY = "prod_year";
      const s = polarSetup();
      assert.equal(s.token, false);
      assert.equal(s.monthly, true);
      assert.equal(s.yearly, true);
      assert.equal(s.ready, false);
    } finally {
      restore(prev);
    }
  });
});

describe("polarAdminStatsFromLists", () => {
  it("sums paid customer orders and skips owner Polar tests", () => {
    const stats = polarAdminStatsFromLists(
      {
        items: [
          {
            id: "ord_paid",
            created_at: "2026-09-01T00:00:00Z",
            amount: 699,
            paid: true,
            customer: { email: "fan@example.com" },
            metadata: { user_id: "u1" },
          },
          {
            id: "ord_year",
            created_at: "2026-09-02T00:00:00Z",
            amount: 7500,
            status: "paid",
            customer_email: "other@example.com",
          },
          {
            id: "ord_owner",
            amount: 699,
            paid: true,
            customer: { email: "stomplab1@gmail.com" },
          },
          {
            id: "ord_open",
            amount: 699,
            paid: false,
            status: "pending",
            customer: { email: "pending@example.com" },
          },
        ],
      },
      {
        items: [
          {
            id: "sub_m",
            status: "active",
            amount: 699,
            recurring_interval: "month",
            customer: { email: "fan@example.com" },
          },
          {
            id: "sub_y",
            status: "active",
            amount: 7500,
            recurring_interval: "year",
            customer: { email: "other@example.com" },
          },
          {
            id: "sub_owner",
            status: "active",
            amount: 699,
            recurring_interval: "month",
            customer: { email: "stomplab1@gmail.com" },
          },
        ],
      },
      ["stomplab1@gmail.com"],
    );
    assert.equal(stats.source, "polar");
    assert.equal(stats.revenueCents, 699 + 7500);
    assert.equal(stats.subscribedCount, 2);
    assert.equal(stats.mrrCents, 699 + Math.round(7500 / 12));
    assert.equal(stats.purchases.length, 2);
    assert.equal(stats.purchases[0]?.email, "fan@example.com");
  });

  it("reads Polar { items } and raw arrays the same way", () => {
    const fromArray = polarAdminStatsFromLists(
      [{ id: "o1", amount: 699, paid: true, customer: { email: "a@b.com" } }],
      [{ id: "s1", status: "trialing", amount: 699, recurring_interval: "month", customer: { email: "a@b.com" } }],
    );
    assert.equal(fromArray.revenueCents, 699);
    assert.equal(fromArray.subscribedCount, 1);
    const empty = polarAdminStatsFromLists({ items: [] }, { items: [] });
    assert.equal(empty.revenueCents, 0);
    assert.equal(empty.subscribedCount, 0);
    assert.equal(empty.source, "polar");
  });
});
