import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FEATURED } from "@/data/featured";
import type { Preset } from "@/data/types";
import { withStompModel } from "./preset-utils";
import {
  addToSetlist,
  cleanSetlists,
  exportSetlist,
  moveItem,
  newSetlist,
  removeItem,
  setlistFileName,
} from "./setlist";
import { unzipStore } from "./zip";

const sandman = FEATURED.find((p) => p.id === "featured-sandman")!;
const numb = FEATURED.find((p) => p.id === "featured-numb")!;
const higher = FEATURED.find((p) => p.id !== "featured-sandman" && p.id !== "featured-numb" && p.id !== "featured-teen-spirit")!;

function song(name: string, base: Preset = sandman): Preset {
  return { ...base, id: `pst-${name.toLowerCase().replace(/\W+/g, "")}`, source: "song", song: name, name, createdAt: 1 };
}

describe("setlist", () => {
  it("adds, moves and removes songs in order", () => {
    let set = newSetlist("Sunday");
    set = addToSetlist(set, song("Oceans"));
    set = addToSetlist(set, song("Way Maker"));
    set = addToSetlist(set, song("Goodness of God"));
    assert.deepEqual(set.items.map((i) => i.title), ["Oceans", "Way Maker", "Goodness of God"]);
    set = moveItem(set, 2, -1);
    assert.deepEqual(set.items.map((i) => i.title), ["Oceans", "Goodness of God", "Way Maker"]);
    assert.equal(moveItem(set, 0, -1), set, "first song cannot move up");
    assert.equal(moveItem(set, 2, 1), set, "last song cannot move down");
    set = removeItem(set, set.items[0].id);
    assert.deepEqual(set.items.map((i) => i.title), ["Goodness of God", "Way Maker"]);
  });

  it("names files with the set position and a safe title", () => {
    assert.equal(setlistFileName(0, "Oceans", "hlx"), "01 Oceans.hlx");
    assert.equal(setlistFileName(9, 'AC/DC: "Back" ', "pgp"), "10 ACDC Back.pgp");
  });

  it("exports one snapshot-mode file per song, in order, as a zip", () => {
    let set = newSetlist("Sunday");
    set = addToSetlist(set, song("Oceans"));
    set = addToSetlist(set, withStompModel({ ...numb }, "hx-stomp"));
    const out = exportSetlist(set, [], "hx-stomp", { paid: true });
    assert.deepEqual(out.skipped, []);
    const files = unzipStore(out.zip!);
    assert.deepEqual(files.map((f) => f.name), ["01 Oceans.hlx", "02 Comfortably Numb.hlx"]);
    const hlx = JSON.parse(new TextDecoder().decode(files[0].data));
    assert.ok(hlx.data?.tone, "a real .hlx");
  });

  it("writes .pgp on POD Go", () => {
    const set = addToSetlist(newSetlist("Gig"), song("Oceans"));
    const out = exportSetlist(set, [], "pod-go", { paid: true });
    assert.deepEqual(unzipStore(out.zip!).map((f) => f.name), ["01 Oceans.pgp"]);
  });

  it("uses the latest History version of a song", () => {
    const first = song("Oceans");
    const set = addToSetlist(newSetlist("Sunday"), first);
    const edited = { ...first, tempo: 67 };
    const out = exportSetlist(set, [edited], "hx-stomp", { paid: true });
    const hlx = JSON.parse(new TextDecoder().decode(unzipStore(out.zip!)[0].data));
    assert.match(JSON.stringify(hlx), /67/);
  });

  it("keeps the download rules: a locked rig is skipped for a free plan, demos are not", () => {
    let set = newSetlist("Sunday");
    set = addToSetlist(set, withStompModel({ ...higher }, "hx-stomp"));
    set = addToSetlist(set, withStompModel({ ...sandman }, "hx-stomp"));
    const out = exportSetlist(set, [], "hx-stomp", { paid: false });
    assert.equal(out.skipped.length, 1);
    assert.deepEqual(unzipStore(out.zip!).map((f) => f.name), [`02 ${sandman.song}.hlx`]);
  });

  it("drops malformed rows from storage or the server", () => {
    const good = addToSetlist(newSetlist("A"), song("Oceans"));
    assert.deepEqual(cleanSetlists([null, { id: 1 }, good, "x"]).map((s) => s.id), [good.id]);
    assert.deepEqual(cleanSetlists("nope"), []);
  });
});
