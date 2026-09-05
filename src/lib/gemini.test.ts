import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyKey, collectResearchKeys, friendlyResearchError } from "./gemini.ts";

describe("classifyKey", () => {
  it("treats Google AI Studio keys as google", () => {
    assert.equal(classifyKey("AIzaSyAbcdefghijklmnop"), "google");
    assert.equal(classifyKey("AIzaSomethingElse"), "google");
  });
  it("treats empty as empty and anything else as gateway", () => {
    assert.equal(classifyKey(""), "empty");
    assert.equal(classifyKey("   "), "empty");
    assert.equal(classifyKey(undefined), "empty");
    assert.equal(classifyKey("vck_live_abc"), "gateway");
    assert.equal(classifyKey("eyJhbGciOi.oidc"), "gateway");
  });
});

describe("collectResearchKeys", () => {
  it("prefers named Google env vars", () => {
    const keys = collectResearchKeys({
      GEMINI_API_KEY: "AIzaSyNamed",
      AI_GATEWAY_API_KEY: "vck_live_gateway",
    } as NodeJS.ProcessEnv);
    assert.equal(keys.google, "AIzaSyNamed");
    assert.equal(keys.gateway, "vck_live_gateway");
  });
  it("routes an AIza key parked in AI_GATEWAY_API_KEY to Google", () => {
    const keys = collectResearchKeys({
      AI_GATEWAY_API_KEY: "AIzaSyParkedInGatewaySlot",
    } as NodeJS.ProcessEnv);
    assert.equal(keys.google, "AIzaSyParkedInGatewaySlot");
    assert.equal(keys.gateway, "");
  });
  it("does not send a Google key to the gateway when both slots are Google", () => {
    const keys = collectResearchKeys({
      GEMINI_API_KEY: "AIzaSyNamed",
      AI_GATEWAY_API_KEY: "AIzaSyAlsoGoogle",
    } as NodeJS.ProcessEnv);
    assert.equal(keys.google, "AIzaSyNamed");
    assert.equal(keys.gateway, "");
  });
  it("accepts GOOGLE_API_KEY and GOOGLE_GENERATIVE_AI_API_KEY", () => {
    assert.equal(
      collectResearchKeys({ GOOGLE_API_KEY: "AIzaSyGoogle" } as NodeJS.ProcessEnv).google,
      "AIzaSyGoogle",
    );
    assert.equal(
      collectResearchKeys({ GOOGLE_GENERATIVE_AI_API_KEY: "AIzaSyGen" } as NodeJS.ProcessEnv).google,
      "AIzaSyGen",
    );
  });
});

describe("friendlyResearchError", () => {
  it("hides the raw TLS chain error", () => {
    assert.match(
      friendlyResearchError(new Error("self-signed certificate in certificate chain")),
      /secure connection failed/i,
    );
  });
});
