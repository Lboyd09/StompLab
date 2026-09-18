import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DELETE_HOLD_DAYS, DELETE_CONFIRM_HOURS } from "./closed-accounts.ts";
import { canonicalEmail } from "./referral-code.ts";
import { LEGAL_VERSION, LEGAL_EFFECTIVE, TERMS_SECTIONS, PRIVACY_SECTIONS } from "./legal.ts";
import { TAGLINE } from "./copy.ts";

describe("closed account hold", () => {
  it("holds for 14 days and confirms by email", () => {
    assert.equal(DELETE_HOLD_DAYS, 14);
    assert.equal(DELETE_CONFIRM_HOURS, 24);
  });
  it("canonicalizes gmail so plus aliases cannot skip the hold", () => {
    assert.equal(canonicalEmail("Liam.Boyd+lab@gmail.com"), "liamboyd@gmail.com");
  });
});

describe("legal 2026-09-18", () => {
  it("matches the posted terms version and privacy hold", () => {
    assert.equal(LEGAL_VERSION, "2026-09-18");
    assert.match(LEGAL_EFFECTIVE, /September 18, 2026/);
    assert.ok(TERMS_SECTIONS.some((s) => s.id === "arbitration"));
    assert.ok(TERMS_SECTIONS.some((s) => /14 days/i.test(s.body.join(" "))));
    assert.ok(TERMS_SECTIONS.some((s) => /3 friends/i.test(s.body.join(" "))));
    assert.ok(PRIVACY_SECTIONS.some((s) => /14 days/i.test(s.body.join(" "))));
    assert.ok(PRIVACY_SECTIONS.some((s) => /confirmation/i.test(s.body.join(" "))));
  });
});

describe("one-liner", () => {
  it("is the product line", () => {
    assert.equal(TAGLINE, "Type a song. Get that guitar rig.");
  });
});
