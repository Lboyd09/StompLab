#!/usr/bin/env node
/**
 * Rasterize the cream SL sticker (the physical mark Liam printed) into
 * favicon / PWA / apple / OG assets. Oswald, same as the in-app lockup.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const CREAM = "#F3EFE6";
const INK = "#141414";
const FONT =
  "https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&display=swap";

function wrap(body, size) {
  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="${FONT}"/>
<style>
  html,body{margin:0;padding:0;background:${CREAM}}
  *{box-sizing:border-box}
  .tile{width:${size}px;height:${size}px;background:${CREAM};color:${INK};
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:Oswald,Arial Black,Arial,sans-serif}
</style></head><body>${body}</body></html>`;
}

function stickerHtml(size) {
  const sl = Math.round(size * 0.42);
  const word = Math.max(9, Math.round(size * 0.092));
  const gap = Math.max(2, Math.round(size * 0.028));
  return wrap(
    `<div class="tile">
      <div style="font-size:${sl}px;font-weight:700;letter-spacing:-0.06em;line-height:0.82">SL</div>
      <div style="margin-top:${gap}px;font-size:${word}px;font-weight:600;letter-spacing:0.22em;line-height:1">STOMP LAB</div>
    </div>`,
    size,
  );
}

function slOnlyHtml(size) {
  const sl = Math.round(size * 0.52);
  return wrap(
    `<div class="tile" style="display:grid;place-items:center;font-size:${sl}px;font-weight:700;letter-spacing:-0.08em">SL</div>`,
    size,
  );
}

const OG = `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="${FONT}"/>
<style>
  html,body{margin:0;padding:0;background:${CREAM}}
  .og{width:1200px;height:630px;background:${CREAM};display:flex;flex-direction:column;
    align-items:flex-start;justify-content:center;padding:72px 88px;box-sizing:border-box;
    color:${INK};font-family:Oswald,Arial,sans-serif}
  .row{display:flex;align-items:center;gap:32px}
  .mark{width:168px;height:168px;background:${CREAM};border:2.5px solid ${INK};border-radius:36px;
    display:grid;place-items:center;font-size:86px;font-weight:700;letter-spacing:-0.08em;line-height:1}
  .word{font-size:96px;font-weight:700;letter-spacing:0.14em;line-height:0.9}
  .tag{margin-top:40px;font-family:Arial,Helvetica,sans-serif;font-size:26px;letter-spacing:0.02em;
    color:#3a3a3a;max-width:820px;line-height:1.4;font-weight:400}
</style></head><body>
  <div class="og">
    <div class="row"><div class="mark">SL</div><div class="word">STOMP LAB</div></div>
    <div class="tag">Research any song. Get a Line 6 preset that sounds like the record.</div>
  </div>
</body></html>`;

function pngToIco(png16, png32) {
  const images = [
    { png: png16, size: 16 },
    { png: png32, size: 32 },
  ];
  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;
  const entries = images.map((img) => {
    const e = { size: img.size, bytes: img.png.length, offset };
    offset += img.png.length;
    return e;
  });
  const buf = Buffer.alloc(offset);
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(images.length, 4);
  let cursor = 6;
  for (const e of entries) {
    buf.writeUInt8(e.size, cursor);
    buf.writeUInt8(e.size, cursor + 1);
    buf.writeUInt8(0, cursor + 2);
    buf.writeUInt8(0, cursor + 3);
    buf.writeUInt16LE(1, cursor + 4);
    buf.writeUInt16LE(32, cursor + 6);
    buf.writeUInt32LE(e.bytes, cursor + 8);
    buf.writeUInt32LE(e.offset, cursor + 12);
    cursor += 16;
  }
  images.forEach((img, i) => img.png.copy(buf, entries[i].offset));
  return buf;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function shot(html, width, height, type = "png") {
  await page.setViewportSize({ width, height });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const buf = await page.screenshot({
    type,
    quality: type === "jpeg" ? 88 : undefined,
    omitBackground: false,
  });
  return Buffer.from(buf);
}

const sticker512 = await shot(stickerHtml(512), 512, 512);
const sticker192 = await shot(stickerHtml(192), 192, 192);
const sticker180 = await shot(stickerHtml(180), 180, 180);
const sl32 = await shot(slOnlyHtml(32), 32, 32);
const sl16 = await shot(slOnlyHtml(16), 16, 16);
const og = await shot(OG, 1200, 630, "jpeg");

writeFileSync(join(publicDir, "icon-512.png"), sticker512);
writeFileSync(join(publicDir, "icon-192.png"), sticker192);
writeFileSync(join(publicDir, "apple-touch-icon.png"), sticker180);
writeFileSync(join(publicDir, "favicon-32.png"), sl32);
writeFileSync(join(publicDir, "favicon-16.png"), sl16);
writeFileSync(join(publicDir, "favicon.ico"), pngToIco(sl16, sl32));
writeFileSync(join(publicDir, "og.jpg"), og);

await browser.close();
console.log("wrote brand icons");
