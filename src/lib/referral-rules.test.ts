import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUSINESS_EMAIL } from "./plan.ts";
import {
  canonicalEmail,
  invitePath,
  isPermanentInviteError,
  mergeInviteResult,
  normalizeReferralCode,
  REFERRAL_BONUS,
  REFERRAL_CAP,
  REFERRAL_SUBSCRIBE_PERCENT,
} from "./referral-code.ts";
import {
  USER_CREATED_AT_QUERY,
  REFERRAL_NEW_ACCOUNT_MS,
  decideRedeem,
  inviteAgeBlocked,
  mapRedeemSqlError,
  parseUserCreatedAt,
  polarIntervalIsMonth,
  polarIntervalIsYear,
  referrerCountsAsPaid,
  resolveMonthlySubId,
  friendCheckoutGetsReferralDiscount,
} from "./referral-rules.ts";

const NOW = Date.parse("2026-09-20T19:00:00Z");

function baseRedeem(over: Partial<Parameters<typeof decideRedeem>[0]> = {}) {
  return decideRedeem({
    code: "AB12CD34",
    userId: "friend-1",
    email: "friend@icloud.com",
    referrerId: "admin-1",
    referrerEmail: BUSINESS_EMAIL,
    siblingIds: ["friend-1"],
    existingReferrerId: null,
    createdAt: new Date(NOW - 60_000),
    customBuilds: 0,
    referrerUsed: 0,
    now: NOW,
    ...over,
  });
}

describe("Better Auth createdAt", () => {
  it("queries quoted camelCase createdAt, never created_at", () => {
    assert.match(USER_CREATED_AT_QUERY, /u\."createdAt" as created_at/);
    assert.match(USER_CREATED_AT_QUERY, /from "user"/);
    assert.equal(/select created_at\b/i.test(USER_CREATED_AT_QUERY), false);
    assert.equal(/u\.created_at/i.test(USER_CREATED_AT_QUERY), false);
  });

  it("parses Date, ISO, unix seconds, and unknown as 0", () => {
    assert.equal(parseUserCreatedAt(new Date("2026-09-20T12:00:00Z")), Date.parse("2026-09-20T12:00:00Z"));
    assert.equal(parseUserCreatedAt("2026-09-20T12:00:00.000Z"), Date.parse("2026-09-20T12:00:00.000Z"));
    assert.equal(parseUserCreatedAt(1_000_000_000), 1_000_000_000_000);
    assert.equal(parseUserCreatedAt(1_700_000_000_000), 1_700_000_000_000);
    assert.equal(parseUserCreatedAt(null), 0);
    assert.equal(parseUserCreatedAt(undefined), 0);
    assert.equal(parseUserCreatedAt(""), 0);
    assert.equal(parseUserCreatedAt("nope"), 0);
  });

  it("allows unknown age and the first 48 hours, blocks after", () => {
    assert.equal(inviteAgeBlocked(0, NOW), false);
    assert.equal(inviteAgeBlocked(NOW - 47 * 60 * 60 * 1000, NOW), false);
    assert.equal(inviteAgeBlocked(NOW - REFERRAL_NEW_ACCOUNT_MS - 1, NOW), true);
    assert.equal(REFERRAL_NEW_ACCOUNT_MS, 48 * 60 * 60 * 1000);
  });
});

describe("decideRedeem", () => {
  it("applies a fresh admin invite", () => {
    const hit = baseRedeem();
    assert.deepEqual(hit, { ok: true });
  });

  it("is idempotent for the same code after a successful claim", () => {
    const hit = baseRedeem({ existingReferrerId: "admin-1", referrerId: "admin-1" });
    assert.deepEqual(hit, { ok: true, already: true });
  });

  it("rejects a second different invite on the same account", () => {
    const hit = baseRedeem({ existingReferrerId: "other-1", referrerId: "admin-1" });
    assert.equal(hit.ok, false);
    if (!hit.ok) assert.match(hit.error, /already used/);
  });

  it("rejects a missing code", () => {
    const hit = baseRedeem({ referrerId: null });
    assert.equal(hit.ok, false);
    if (!hit.ok) assert.match(hit.error, /No account uses/);
  });

  it("rejects inviting yourself by user id, sibling id, or gmail alias", () => {
    assert.equal(baseRedeem({ referrerId: "friend-1" }).ok, false);
    assert.equal(baseRedeem({ siblingIds: ["friend-1", "admin-1"] }).ok, false);
    const alias = baseRedeem({
      email: "stomplab1+test@gmail.com",
      referrerEmail: "stomplab1@gmail.com",
      siblingIds: ["friend-1"],
    });
    assert.equal(alias.ok, false);
    if (!alias.ok) assert.match(alias.error, /can't invite yourself/);
  });

  it("does not count a gmail plus-alias of the admin inbox as a friend", () => {
    assert.equal(canonicalEmail("stomplab1+friend@gmail.com"), canonicalEmail(BUSINESS_EMAIL));
    assert.equal(canonicalEmail("Stomp.Lab1+qa@gmail.com"), "stomplab1@gmail.com");
  });

  it("rejects accounts older than 48 hours and anyone who already researched", () => {
    const old = baseRedeem({ createdAt: new Date(NOW - 49 * 60 * 60 * 1000) });
    assert.equal(old.ok, false);
    if (!old.ok) assert.match(old.error, /48 hours/);
    const used = baseRedeem({ customBuilds: 1 });
    assert.equal(used.ok, false);
    if (!used.ok) assert.match(used.error, /before you research/);
  });

  it("does not fail closed when createdAt is missing", () => {
    const hit = baseRedeem({ createdAt: null });
    assert.deepEqual(hit, { ok: true });
  });

  it("enforces the 3-friend cap", () => {
    const hit = baseRedeem({ referrerUsed: REFERRAL_CAP });
    assert.equal(hit.ok, false);
    if (!hit.ok) assert.match(hit.error, /maximum/);
    assert.equal(REFERRAL_CAP, 3);
    assert.equal(REFERRAL_BONUS, 3);
  });

  it("rejects junk codes", () => {
    const hit = baseRedeem({ code: "ab" });
    assert.equal(hit.ok, false);
    if (!hit.ok) assert.match(hit.error, /doesn't look right/);
  });
});

describe("paid invite perk", () => {
  it("treats the admin inbox as paid even without entitlements.paid", () => {
    assert.equal(referrerCountsAsPaid({ paid: false, email: BUSINESS_EMAIL }), true);
    assert.equal(referrerCountsAsPaid({ paid: false, email: "  StompLab1@gmail.com " }), true);
    assert.equal(referrerCountsAsPaid({ paid: true, email: "player@x.com" }), true);
    assert.equal(referrerCountsAsPaid({ paid: false, email: "player@x.com" }), false);
    assert.equal(referrerCountsAsPaid({ paid: false, email: "stomplab1+x@gmail.com" }), false);
    assert.equal(REFERRAL_SUBSCRIBE_PERCENT, 50);
  });

  it("only attaches Polar 50% to a monthly subscription", () => {
    assert.equal(polarIntervalIsMonth("month"), true);
    assert.equal(polarIntervalIsMonth("monthly"), true);
    assert.equal(polarIntervalIsYear("year"), true);
    assert.equal(
      resolveMonthlySubId({
        planInterval: "month",
        polarSubscriptionId: "sub_admin_monthly",
        subscriptionStatus: "active",
      }),
      "sub_admin_monthly",
    );
    assert.equal(
      resolveMonthlySubId({
        planInterval: "year",
        polarSubscriptionId: "sub_admin_yearly",
        subscriptionStatus: "active",
      }),
      "",
    );
    assert.equal(
      resolveMonthlySubId({
        planInterval: null,
        polarSubscriptionId: null,
        lookup: { id: "sub_looked_month", interval: "month", status: "active" },
      }),
      "sub_looked_month",
    );
    assert.equal(
      resolveMonthlySubId({
        planInterval: "month",
        polarSubscriptionId: "",
        lookup: { id: "sub_looked_month", interval: "month", status: "active" },
      }),
      "sub_looked_month",
    );
    assert.equal(
      resolveMonthlySubId({
        planInterval: null,
        polarSubscriptionId: null,
        lookup: { id: "sub_looked_year", interval: "year", status: "active" },
      }),
      "",
    );
    assert.equal(friendCheckoutGetsReferralDiscount("month", true), true);
    assert.equal(friendCheckoutGetsReferralDiscount("year", true), false);
    assert.equal(friendCheckoutGetsReferralDiscount("month", false), false);
  });
});

describe("invite links and claim errors", () => {
  it("opens Create account with the ref code", () => {
    assert.equal(invitePath("ab12cd"), "/login?mode=up&ref=AB12CD");
    assert.equal(invitePath("ab12cd", "half"), "/login?mode=up&ref=AB12CD&perk=half");
    assert.equal(normalizeReferralCode(" ab-cd_12 "), "ABCD12");
  });

  it("does not retry permanent redeem errors, and does not clobber success", () => {
    assert.equal(isPermanentInviteError("This account already used an invite."), true);
    assert.equal(isPermanentInviteError("You can't invite yourself."), true);
    assert.equal(isPermanentInviteError("Invites only work on a new account (first 48 hours)."), true);
    assert.equal(isPermanentInviteError("No account uses that code."), true);
    assert.equal(isPermanentInviteError("Could not apply that invite. Try again in a minute."), false);
    assert.deepEqual(
      mergeInviteResult({ ok: true, bonus: 3 }, { ok: false, error: "This account already used an invite." }),
      { ok: true, bonus: 3 },
    );
    assert.deepEqual(mergeInviteResult(null, { ok: false, error: "Nope" }), { ok: false, error: "Nope" });
  });

  it("maps the old created_at SQL miss to a real error, not a silent drop", () => {
    assert.match(
      mapRedeemSqlError('column "created_at" does not exist') ?? "",
      /Invite storage is updating/,
    );
    assert.equal(mapRedeemSqlError("duplicate key value violates unique constraint"), "This account already used an invite.");
    assert.equal(mapRedeemSqlError("network"), null);
  });
});
