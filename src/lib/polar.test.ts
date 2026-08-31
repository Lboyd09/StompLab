import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractOrder,
  isRealPolarOrderId,
  polarEventIsPaid,
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
  it("never treats confirmed/complete as paid", () => {
    assert.equal(polarStatusIsPaid({ status: "confirmed" }), false);
    assert.equal(polarStatusIsPaid({ status: "complete" }), false);
    assert.equal(polarStatusIsPaid({ status: "open" }), false);
    assert.equal(
      polarEventIsPaid({ type: "checkout.updated", data: { id: "checkout_abc12345", status: "confirmed" } }),
      false,
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
});
