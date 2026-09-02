import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { storageOwnerKey } from "./storage.ts";

describe("history isolation", () => {
  it("scopes local history to the signed-in user id", () => {
    assert.equal(storageOwnerKey(null), "anon");
    assert.equal(storageOwnerKey(""), "anon");
    assert.equal(storageOwnerKey("user-a"), "user-a");
    assert.equal(storageOwnerKey("user-b"), "user-b");
    assert.notEqual(storageOwnerKey("user-a"), storageOwnerKey("user-b"));
  });
});
