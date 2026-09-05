import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_EMAIL, BUSINESS_EMAIL, PUBLIC_SUPPORT_EMAIL, assemblePlan, emptyPlan, formatUsd, hideOwnerRow, isAdminEmail, isOwnerAccount, normalizeEmail, resolveAccountEmail, PRICE_MONTHLY_USD, PRICE_YEARLY_USD, yearlySavingsUsd, buildsUsedCopy } from "./plan.ts";

describe("isAdminEmail", () => {
  it("unlocks only the Stomp Lab gmail, never personal Gmail", () => {
    assert.equal(isAdminEmail(BUSINESS_EMAIL), true);
    assert.equal(isAdminEmail("  StompLab1@gmail.com  "), true);
    assert.equal(isAdminEmail("stomplab1@gmail.com"), true);
    assert.equal(isAdminEmail(ADMIN_EMAIL), false);
    assert.equal(isAdminEmail("  LiamJamesB09@gmail.com  "), false);
    assert.equal(isAdminEmail("liamjamesb09@icloud.com"), false);
    assert.equal(isAdminEmail("someone@gmail.com"), false);
    assert.equal(isAdminEmail(""), false);
    assert.equal(isAdminEmail(null), false);
    assert.equal(normalizeEmail("  LiamJamesB09@Gmail.com "), ADMIN_EMAIL);
    assert.equal(isOwnerAccount(ADMIN_EMAIL), true);
    assert.equal(isOwnerAccount(BUSINESS_EMAIL), true);
    assert.equal(isOwnerAccount(PUBLIC_SUPPORT_EMAIL), true);
    assert.equal(isOwnerAccount("player@example.com"), false);
    assert.equal(hideOwnerRow(ADMIN_EMAIL), true);
    assert.equal(hideOwnerRow(PUBLIC_SUPPORT_EMAIL), true);
    assert.equal(hideOwnerRow("", "admin-id", ["admin-id"]), true);
    assert.equal(hideOwnerRow("", "unmatched", []), true);
    assert.equal(hideOwnerRow("buyer@example.com", "u2", ["admin-id"]), false);
    assert.equal(hideOwnerRow("", "u2", ["admin-id"]), false);
  });
  it("falls back to the session email when the user row is missing", () => {
    assert.equal(resolveAccountEmail(null, "stomplab1@gmail.com"), "stomplab1@gmail.com");
    assert.equal(resolveAccountEmail("", "  Liam@X.COM "), "liam@x.com");
    assert.equal(resolveAccountEmail("  a@b.com ", "other@x.com"), "a@b.com");
    assert.equal(resolveAccountEmail(undefined, undefined), null);
    assert.equal(resolveAccountEmail("", ""), null);
  });
});

describe("assemblePlan", () => {
  it("gives signed-in free users history, not gear or a shared library", () => {
    const plan = assemblePlan({
      userId: "u1",
      email: "player@icloud.com",
      paid: false,
      freeUsed: 1,
      monthUsed: 1,
    });
    assert.equal(plan.paid, false);
    assert.equal(plan.admin, false);
    assert.equal(plan.canHistory, true);
    assert.equal(plan.canGear, false);
    assert.equal(plan.canSharedLibrary, false);
    assert.equal(plan.canResearch, true);
    assert.equal(plan.freeRemaining, 2);
  });
  it("does not unlock iCloud as admin even if paid is smuggled", () => {
    const plan = assemblePlan({
      userId: "icloud-user",
      email: "liamjamesb09@icloud.com",
      paid: false,
      freeUsed: 0,
      monthUsed: 0,
    });
    assert.equal(plan.admin, false);
    assert.equal(plan.paid, false);
    assert.equal(plan.canGear, false);
  });
  it("does not unlock personal Gmail as admin", () => {
    const plan = assemblePlan({
      userId: "personal",
      email: ADMIN_EMAIL,
      paid: false,
      freeUsed: 0,
      monthUsed: 0,
    });
    assert.equal(plan.admin, false);
    assert.equal(plan.paid, false);
    assert.equal(isOwnerAccount(ADMIN_EMAIL), true);
  });
  it("unlocks the business gmail as admin", () => {
    const plan = assemblePlan({
      userId: "biz",
      email: "stomplab1@gmail.com",
      paid: false,
      freeUsed: 0,
      monthUsed: 0,
    });
    assert.equal(plan.admin, true);
    assert.equal(plan.paid, true);
  });
  it("unlocks only the Stomp Lab email without a Polar row and with no monthly cap", () => {
    const plan = assemblePlan({
      userId: "admin-user",
      email: BUSINESS_EMAIL,
      paid: false,
      freeUsed: 0,
      monthUsed: 999,
    });
    assert.equal(plan.admin, true);
    assert.equal(plan.paid, true);
    assert.equal(plan.canGear, true);
    assert.equal(plan.canResearch, true);
    assert.equal(plan.canCreate, true);
    assert.equal(plan.monthLimit, 0);
    assert.equal(plan.blockedReason, null);
    assert.match(buildsUsedCopy(plan), /unlimited/i);
    assert.equal(plan.canSharedLibrary, false);
  });
  it("hides history until sign-in", () => {
    assert.equal(emptyPlan().canHistory, false);
    assert.equal(emptyPlan().canResearch, false);
  });
  it("blocks research after 3 free builds", () => {
    const plan = assemblePlan({
      userId: "u1",
      email: "a@b.com",
      paid: false,
      freeUsed: 3,
      monthUsed: 3,
    });
    assert.equal(plan.canResearch, false);
    assert.equal(plan.canCreate, false);
    assert.equal(plan.canHistory, true);
    assert.equal(plan.blockedReason, "paywall");
  });
  it("gives paid subscribers 50 builds a month on either interval", () => {
    const monthly = assemblePlan({
      userId: "u1",
      email: "a@b.com",
      paid: true,
      freeUsed: 3,
      monthUsed: 12,
      planInterval: "month",
    });
    const yearly = assemblePlan({
      userId: "u1",
      email: "a@b.com",
      paid: true,
      freeUsed: 3,
      monthUsed: 12,
      planInterval: "year",
    });
    assert.equal(monthly.monthLimit, 50);
    assert.equal(yearly.monthLimit, 50);
    assert.equal(monthly.canResearch, true);
    assert.equal(monthly.planInterval, "month");
    assert.equal(yearly.planInterval, "year");
  });
});

describe("prices", () => {
  it("is $6.99 a month and $75 a year", () => {
    assert.equal(PRICE_MONTHLY_USD, 6.99);
    assert.equal(PRICE_YEARLY_USD, 75);
    assert.equal(formatUsd(6.99), "$6.99");
    assert.equal(formatUsd(75), "$75");
    assert.equal(yearlySavingsUsd(), 8.88);
  });
});
