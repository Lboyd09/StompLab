#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const errors = [];
function check(name, ok, extra) {
  if (!ok) errors.push(extra ? `${name}: ${extra}` : name);
  console.log(`${ok ? "ok" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

function overlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

await page.goto(`${BASE}/preset/featured-sandman-hx-stomp-xl`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const title = await page.locator("h1").first().textContent();
check("XL Sandman does not 404", !/Preset not found/i.test(title ?? ""), title?.trim());
check("song title present", /Enter Sandman/i.test(title ?? ""), title?.trim());

const chassis = page.locator(".hx-chassis-xl");
check("XL chassis rendered", await chassis.count().then((n) => n === 1));

const numbers = await page.locator(".hx-xl-board .hx-fs-cap").evaluateAll((els) =>
  els.map((el) => el.textContent?.trim()).filter(Boolean),
);
check("switches numbered 1–6", numbers.join(",") === "1,2,3,4,5,6", numbers.join(","));

const mode = await page.locator(".hx-xl-mode").textContent();
const tap = await page.locator(".hx-xl-tap").textContent();
check("MODE on bottom row", /MODE/i.test(mode ?? ""));
check("TAP on bottom row", /TAP/i.test(tap ?? ""));

const lcdBox = await page.locator(".hx-lcd").boundingBox();
const wellBox = await page.locator(".hx-well").boundingBox();
if (lcdBox && wellBox) {
  check("LCD does not overlap well", !overlap(lcdBox, wellBox), JSON.stringify({ lcdBox, wellBox }));
  check("well sits to the right of LCD", wellBox.x >= lcdBox.x + lcdBox.width - 8, `lcd.x=${lcdBox.x} well.x=${wellBox.x}`);
} else {
  check("LCD and well boxes", false, "missing");
}

await page.screenshot({ path: "/workspace/screenshots/qa-xl-sandman.png", fullPage: true });

// Header Stomp should convert replica to 3-switch without 404
await page.locator("header").getByRole("button", { name: "Stomp", exact: true }).click();
await page.waitForTimeout(700);
const afterStomp = await page.locator("h1").first().textContent();
check("Stomp toggle keeps preset", !/Preset not found/i.test(afterStomp ?? ""), afterStomp?.trim());
check("Stomp chassis after toggle", (await page.locator(".hx-chassis-stomp").count()) === 1);
check("URL became hx-stomp", page.url().includes("featured-sandman-hx-stomp") && !page.url().endsWith("-xl"));

await page.screenshot({ path: "/workspace/screenshots/qa-stomp-toggle.png", fullPage: true });

await page.locator("header").getByRole("button", { name: "Stomp XL", exact: true }).click();
await page.waitForTimeout(700);
check("XL chassis after toggle back", (await page.locator(".hx-chassis-xl").count()) === 1);
check("URL became hx-stomp-xl", page.url().includes("featured-sandman-hx-stomp-xl"));

// Assign: tap switch 4 (bottom-left, Intro) then tap a different section
const switch4 = page.getByRole("button", { name: /Switch 4/i }).first();
await switch4.click();
await page.waitForTimeout(200);
const assignH = await page.locator("h2").filter({ hasText: "Switch 4" }).count();
check("replica tap selects Switch 4 in assign panel", assignH >= 1);

await page.getByRole("button", { name: "Lead", exact: true }).click();
await page.waitForTimeout(200);
const switch4Label = await switch4.textContent();
check("assigning Lead updates switch 4", /LEAD/i.test(switch4Label ?? ""), switch4Label ?? "");

await page.getByRole("button", { name: "Reset to original" }).click();
await page.waitForTimeout(300);
const restored = await switch4.textContent();
check("reset restores original", /INTRO/i.test(restored ?? ""), restored ?? "");

// Search
await page.getByLabel("Search songs and catalog").fill("sandman");
await page.waitForTimeout(300);
const songHit = page.getByRole("button", { name: /Enter Sandman/i });
check("header search lists the song", (await songHit.count()) > 0);
await page.getByLabel("Search songs and catalog").fill("");
await page.locator("h1").first().click();
await page.waitForTimeout(200);

// Equivalents nav
const equiv = page.getByRole("link", { name: "Equivalents" });
check("Equivalents in desktop nav", (await equiv.count()) > 0);
await equiv.click();
await page.waitForTimeout(400);
check("Equivalents opens find tab", page.url().includes("tab=find") || (await page.getByText(/Pedal or amp/i).count()) > 0);

// Mobile overflow on XL sandman
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${BASE}/preset/featured-sandman-hx-stomp-xl`, { waitUntil: "networkidle" });
await mobile.waitForTimeout(600);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check("mobile no horizontal overflow", overflow <= 1, `overflow=${overflow}`);
await mobile.screenshot({ path: "/workspace/screenshots/qa-xl-sandman-mobile.png", fullPage: true });
await mobile.close();

await page.screenshot({ path: "/workspace/screenshots/qa-assign-reset.png", fullPage: true });
await browser.close();

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, errors: [] }));
