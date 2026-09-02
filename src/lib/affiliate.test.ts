import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { amazonSearchUrl, shopQueryFor, sweetwaterSearchUrl } from "./affiliate.ts";

describe("affiliate urls", () => {
  it("adds the Amazon associate tag when provided", () => {
    const url = amazonSearchUrl("BOSS DS-1", "stomplab-20");
    assert.match(url, /amazon\.com\/s/);
    assert.match(url, /k=BOSS\+DS-1|k=BOSS%20DS-1/);
    assert.match(url, /tag=stomplab-20/);
  });
  it("builds a Sweetwater search with the campaign id", () => {
    const url = sweetwaterSearchUrl("Ibanez TS808", "abc123");
    assert.match(url, /sweetwater\.com/);
    assert.match(url, /utm_campaign=abc123/);
  });
  it("prefers the based-on original over a Line 6 name", () => {
    assert.equal(shopQueryFor("Deez One Vintage", "BOSS DS-1 Distortion"), "BOSS DS-1 Distortion");
    assert.equal(shopQueryFor("Thrifter Fuzz", "Line 6 Original"), "Thrifter Fuzz");
  });
});
