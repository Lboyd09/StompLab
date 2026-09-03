import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configuredAuthHosts, hostFromRaw, isPublicHostname } from "./site-origin.ts";

describe("site origin", () => {
  it("parses hosts from URLs and raw host headers", () => {
    assert.equal(hostFromRaw("https://stomplab.com/"), "stomplab.com");
    assert.equal(hostFromRaw("www.stomplab.app"), "www.stomplab.app");
    assert.equal(hostFromRaw("stomplab.vercel.app, other"), "stomplab.vercel.app");
  });

  it("accepts custom domains and Vercel hosts, rejects loopback", () => {
    assert.equal(isPublicHostname("stomplab.com"), true);
    assert.equal(isPublicHostname("hxstomp.app"), true);
    assert.equal(isPublicHostname("stomplab.vercel.app"), true);
    assert.equal(isPublicHostname("localhost"), false);
    assert.equal(isPublicHostname("127.0.0.1"), false);
    assert.equal(isPublicHostname("10.0.0.1"), false);
  });

  it("always trusts stomplab.vercel.app plus likely custom names", () => {
    const hosts = configuredAuthHosts();
    assert.ok(hosts.includes("stomplab.vercel.app"));
    assert.ok(hosts.includes("stomplab.com"));
    assert.ok(hosts.includes("www.stomplab.com"));
    assert.ok(hosts.includes("*.vercel.app"));
  });
});
