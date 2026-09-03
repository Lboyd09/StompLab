import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCheckoutId, parseNext } from "./next-path.ts";

describe("parseNext", () => {
  it("keeps upgrade even when a checkout id is on the query", () => {
    assert.equal(parseNext("/upgrade?checkout_id=abc"), "/upgrade");
    assert.equal(parseNext("/upgrade"), "/upgrade");
    assert.equal(parseNext("/account"), "/account");
    assert.equal(parseNext("/evil"), "/");
  });
});

describe("parseCheckoutId", () => {
  it("accepts Polar ids and rejects junk", () => {
    assert.equal(parseCheckoutId("ch_abcDEF1234"), "ch_abcDEF1234");
    assert.equal(parseCheckoutId("no"), undefined);
    assert.equal(parseCheckoutId("https://evil.example"), undefined);
  });
});
