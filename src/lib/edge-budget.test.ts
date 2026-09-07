import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isScannerPath, jsonFingerprint, shouldPushSync } from "./edge-budget.ts";

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
      "/__grok/manifest.webmanifest",
      "/.well-known/security.txt",
      "/favicon.svg",
      "/tutorial/lab.png",
    ]) {
      assert.equal(isScannerPath(path), false, path);
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
    }
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
