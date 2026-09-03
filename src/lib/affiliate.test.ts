import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { amazonSearchUrl, isShoppableGear, shopQueryFor, shopQueryForUserItem, sweetwaterSearchUrl } from "./affiliate.ts";

describe("affiliate urls", () => {
  it("adds the Amazon associate tag when provided", () => {
    const url = amazonSearchUrl("BOSS DS-1", "stomplab-20");
    assert.match(url, /amazon\.com\/s/);
    assert.match(url, /k=BOSS\+DS-1|k=BOSS%20DS-1/);
    assert.match(url, /tag=stomplab-20/);
    assert.match(url, /linkCode=ll2/);
  });
  it("still builds a Sweetwater URL but the shop UI does not use it", () => {
    const url = sweetwaterSearchUrl("Ibanez TS808", "abc123");
    assert.match(url, /sweetwater\.com/);
    assert.match(url, /utm_campaign=abc123/);
  });
  it("shops the based-on original, never a Line 6 nickname", () => {
    assert.equal(shopQueryFor("Deez One Vintage", "BOSS DS-1 Distortion"), "BOSS DS-1 Distortion");
    assert.equal(shopQueryFor("Scream 808", "Ibanez TS808"), "Ibanez TS808");
    assert.equal(shopQueryFor("Thrifter Fuzz", "Line 6 Original"), "");
    assert.equal(shopQueryFor("Cali Rectifire", "Mesa Dual Rectifier"), "Mesa Dual Rectifier");
  });
  it("refuses Line 6 computer-generated names", () => {
    assert.equal(isShoppableGear("Line 6 Original"), false);
    assert.equal(isShoppableGear("HX Stomp"), false);
    assert.equal(isShoppableGear("Helix"), false);
    assert.equal(isShoppableGear("BOSS DS-1 Distortion"), true);
    assert.equal(shopQueryForUserItem("Fender Telecaster"), "Fender Telecaster");
    assert.equal(shopQueryForUserItem("Line 6 Helix Floor"), "");
  });
});
