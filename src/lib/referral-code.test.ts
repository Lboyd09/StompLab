import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalEmail,
  invitePath,
  inviteUrl,
  normalizeReferralCode,
  REFERRAL_BONUS,
  REFERRAL_CAP,
  REFERRAL_SUBSCRIBE_PERCENT,
} from "./referral-code.ts";

describe("referral codes", () => {
  it("normalizes and caps bonus math", () => {
    assert.equal(normalizeReferralCode(" ab-cd_12 "), "ABCD12");
    assert.equal(normalizeReferralCode("too-long-to-keep-all-of-this").length, 12);
    assert.equal(REFERRAL_BONUS, 3);
    assert.equal(REFERRAL_CAP, 3);
    assert.equal(REFERRAL_SUBSCRIBE_PERCENT, 50);
  });

  it("opens Create account, not Sign in", () => {
    assert.equal(invitePath("ab12cd"), "/login?mode=up&ref=AB12CD");
    assert.equal(inviteUrl("https://stomplab.app", "ab12cd"), "https://stomplab.app/login?mode=up&ref=AB12CD");
    assert.equal(invitePath("ab12cd", "half"), "/login?mode=up&ref=AB12CD&perk=half");
    assert.equal(invitePath("ab12cd", "builds"), "/login?mode=up&ref=AB12CD&perk=builds");
    assert.equal(
      inviteUrl("https://stomplab.app", "ab12cd", "half"),
      "https://stomplab.app/login?mode=up&ref=AB12CD&perk=half",
    );
  });

  it("treats gmail aliases as the same person", () => {
    assert.equal(canonicalEmail("Liam.Boyd+lab@gmail.com"), "liamboyd@gmail.com");
    assert.equal(canonicalEmail("liamboyd@googlemail.com"), "liamboyd@gmail.com");
    assert.equal(canonicalEmail("a@icloud.com"), "a@icloud.com");
    assert.equal(canonicalEmail("stomplab1+friend@gmail.com"), "stomplab1@gmail.com");
    assert.equal(canonicalEmail("Stomp.Lab1@gmail.com"), "stomplab1@gmail.com");
  });
});
