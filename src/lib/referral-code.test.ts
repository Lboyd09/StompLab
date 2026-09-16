import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeReferralCode, REFERRAL_BONUS, REFERRAL_CAP } from "./referral-code.ts";

describe("referral codes", () => {
  it("normalizes and caps bonus math", () => {
    assert.equal(normalizeReferralCode(" ab-cd_12 "), "ABCD12");
    assert.equal(normalizeReferralCode("too-long-to-keep-all-of-this").length, 12);
    assert.equal(REFERRAL_BONUS, 1);
    assert.equal(REFERRAL_CAP, 15);
  });
});
