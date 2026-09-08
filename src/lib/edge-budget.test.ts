import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAbuseUserAgent,
  isCheap404Path,
  isScannerPath,
  jsonFingerprint,
  shouldPushSync,
} from "./edge-budget.ts";

describe("isScannerPath", () => {
  it("lets real Lab routes through", () => {
    for (const path of [
      "/",
      "/catalog",
      "/create",
      "/gear",
      "/guide",
      "/history",
      "/settings",
      "/login",
      "/upgrade",
      "/account",
      "/admin",
      "/preset/abc",
      "/equivalents",
      "/api/auth/get-session",
      "/api/keepalive",
      "/api/polar/webhook",
      "/api/visit",
      "/__grok/manifest.webmanifest",
      "/.well-known/security.txt",
      "/favicon.svg",
      "/tutorial/lab.png",
      "/_server",
      "/_server/fn",
      "/_tanstack/start",
    ]) {
      assert.equal(isScannerPath(path), false, path);
      assert.equal(isCheap404Path(path), false, path);
    }
  });

  it("drops wordpress, env, and php probes before SSR", () => {
    for (const path of [
      "/wp-admin",
      "/wp-admin/install.php",
      "/wp-login.php",
      "/blog/wp-login.php",
      "/xmlrpc.php",
      "/.env",
      "/.git/config",
      "/phpmyadmin",
      "/phpMyAdmin/index.php",
      "/vendor/phpunit/phpunit",
      "/actuator/health",
      "/server-status",
      "/autodiscover/autodiscover.xml",
      "/latest/meta-data",
      "/setup.cgi",
      "/backup.sql",
      "/config.php",
    ]) {
      assert.equal(isScannerPath(path), true, path);
      assert.equal(isCheap404Path(path), true, path);
    }
  });

  it("404s unknown document paths so they never SSR the Lab", () => {
    for (const path of ["/backup", "/test", "/random-bot-path", "/admin.php.bak", "/foo/bar"]) {
      assert.equal(isCheap404Path(path), true, path);
    }
  });
});

describe("isAbuseUserAgent", () => {
  it("lets browsers and Google through", () => {
    assert.equal(isAbuseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"), false);
    assert.equal(isAbuseUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), false);
  });
  it("drops scanners", () => {
    assert.equal(isAbuseUserAgent("curl/8.0.0"), true);
    assert.equal(isAbuseUserAgent("python-requests/2.32"), true);
    assert.equal(isAbuseUserAgent("Go-http-client/1.1"), true);
  });
});

describe("shouldPushSync", () => {
  it("does not push an unchanged preset list after a pull", () => {
    const presets = [{ id: "a", name: "Teen Spirit" }];
    const pulled = jsonFingerprint(presets);
    assert.equal(shouldPushSync(pulled, presets), false);
    assert.equal(shouldPushSync(pulled, [{ id: "a", name: "Teen Spirit", extra: 1 }]), true);
    assert.equal(shouldPushSync("", presets), true);
  });
});
