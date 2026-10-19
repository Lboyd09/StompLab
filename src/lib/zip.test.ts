import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crc32, unzipStore, zipStore } from "./zip.ts";

describe("zip writer", () => {
  it("computes the standard CRC32", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
    assert.equal(crc32(new Uint8Array()), 0);
  });

  it("round-trips files in order with UTF-8 names", () => {
    const zip = zipStore([
      { name: "01 Oceans.hlx", data: '{"a":1}' },
      { name: "02 Way Maker.hlx", data: "{}" },
      { name: "03 Café.pgp", data: new Uint8Array([1, 2, 3]) },
    ]);
    const files = unzipStore(zip);
    assert.deepEqual(
      files.map((f) => f.name),
      ["01 Oceans.hlx", "02 Way Maker.hlx", "03 Café.pgp"],
    );
    assert.equal(new TextDecoder().decode(files[0].data), '{"a":1}');
    assert.deepEqual([...files[2].data], [1, 2, 3]);
  });

  it("writes local headers, a central directory and an end record", () => {
    const zip = zipStore([{ name: "a.txt", data: "hi" }]);
    const view = new DataView(zip.buffer);
    assert.equal(view.getUint32(0, true), 0x04034b50);
    assert.equal(view.getUint16(8, true), 0, "stored, no compression");
    assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
    assert.equal(zip.length, 30 + 5 + 2 + 46 + 5 + 22);
  });

  it("handles an empty archive", () => {
    assert.deepEqual(unzipStore(zipStore([])), []);
  });
});
