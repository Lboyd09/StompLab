import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractOrder,
  isRealPolarOrderId,
  polarCheckoutIsReady,
  polarCheckoutNeedsPoll,
  polarEventIsPaid,
  polarEventIsSubscriptionGrant,
  polarEventIsSubscriptionRevoke,
  polarFriendlyError,
  polarPortalUrlFromPayload,
  polarStatusIsPaid,
  purchaseLooksPaid,
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
