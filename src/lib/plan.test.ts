import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ADMIN_EMAIL, assemblePlan, emptyPlan, isAdminEmail } from "./plan.ts";

describe("isAdminEmail", () => {
  it("matches only the exact admin gmail", () => {
    assert.equal(isAdminEmail(ADMIN_EMAIL), true);
    assert.equal(isAdminEmail("  LiamJamesB09@gmail.com  "), true);
    assert.equal(isAdminEmail("liamjamesb09@icloud.com"), false);
    assert.equal(isAdminEmail("someone@gmail.com"), false);
    assert.equal(isAdminEmail(""), false);
    assert.equal(isAdminEmail(null), false);
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
  it("unlocks only the exact admin email without a Polar row", () => {
    const plan = assemblePlan({
      userId: "admin-user",
      email: ADMIN_EMAIL,
      paid: false,
      freeUsed: 0,
      monthUsed: 0,
    });
    assert.equal(plan.admin, true);
    assert.equal(plan.paid, true);
    assert.equal(plan.canGear, true);
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
});
