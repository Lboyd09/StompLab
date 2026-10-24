import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Preset } from "@/data/types";
import { HISTORY_CAP, mergeHistory, storageOwnerKey, upsertInto, writeHistoryWithTrim } from "./storage.ts";

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

function row(id: string, song: string, createdAt: number, extra: Partial<Preset> = {}): Preset {
  return {
    id,
    createdAt,
    source: "song",
    song,
    artist: "Band",
    instrument: "guitar",
    stompModel: "hx-stomp",
    name: song,
    tempo: 100,
    summary: "",
    originalGear: [],
    recommendedGear: [],
    blocks: [],
    snapshots: [],
    footswitches: [],
    programming: [],
    tips: [],
    ...extra,
  };
}

describe("history merge with the account", () => {
  it("keeps a build made here that the account does not have yet", () => {
    const local = [row("new", "Fresh", 300), row("a", "Old", 100)];
    const remote = [row("a", "Old", 100)];
    assert.deepEqual(mergeHistory(local, remote).map((p) => p.id).sort(), ["a", "new"]);
  });
  it("keeps account rows this device never had", () => {
    const merged = mergeHistory([row("a", "Old", 100)], [row("b", "Other", 200), row("a", "Old", 100)]);
    assert.deepEqual(merged.map((p) => p.id).sort(), ["a", "b"]);
  });
  it("the newer save of the same preset wins", () => {
    const remote = [row("a", "Song", 100, { updatedAt: 400, tempo: 120 })];
    assert.equal(mergeHistory([row("a", "Song", 100, { updatedAt: 500, tempo: 90 })], remote)[0].tempo, 90);
    assert.equal(mergeHistory([row("a", "Song", 100, { updatedAt: 300, tempo: 90 })], remote)[0].tempo, 120);
  });
});

describe("history write when the browser is full", () => {
  it("drops the oldest entries and tries once more", () => {
    const list = Array.from({ length: 8 }, (_, i) => row(`p${i}`, `Song ${i}`, i));
    let calls = 0;
    const res = writeHistoryWithTrim(list, (value) => {
      calls += 1;
      if (calls === 1) throw new Error("QuotaExceededError");
      assert.ok(JSON.parse(value).length < list.length);
    });
    assert.equal(calls, 2);
    assert.equal(res.saved, true);
    assert.equal(res.kept.length, 6);
    assert.ok(!res.kept.some((p) => p.id === "p0" || p.id === "p1"));
  });
  it("never throws when the browser refuses every write", () => {
    const res = writeHistoryWithTrim([row("a", "A", 1), row("b", "B", 2)], () => {
      throw new Error("blocked");
    });
    assert.equal(res.saved, false);
  });
});

describe("upsertInto", () => {
  it("replaces the same id in memory", () => {
    const next = upsertInto([row("a", "A", 1, { tempo: 80 })], row("a", "A", 1, { tempo: 99 }));
    assert.equal(next.length, 1);
    assert.equal(next[0].tempo, 99);
  });
});
