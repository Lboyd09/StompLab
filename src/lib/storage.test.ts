import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HISTORY_CAP, storageOwnerKey } from "./storage.ts";

describe("history isolation", () => {
  it("scopes local history to the signed-in user id", () => {
    assert.equal(storageOwnerKey(null), "anon");
    assert.equal(storageOwnerKey(""), "anon");
    assert.equal(storageOwnerKey("user-a"), "user-a");
    assert.equal(storageOwnerKey("user-b"), "user-b");
    assert.notEqual(storageOwnerKey("user-a"), storageOwnerKey("user-b"));
  });
  it("keeps a long history instead of dropping after 60", () => {
    assert.equal(HISTORY_CAP, 400);
    assert.ok(HISTORY_CAP > 60);
  });
});
