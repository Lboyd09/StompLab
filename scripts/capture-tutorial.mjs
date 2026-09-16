#!/usr/bin/env node
/** Recapture cream-UI tutorial PNGs from the running Lab. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("/workspace/public/tutorial", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  localStorage.setItem("stomplab.tutorial.v15", "1");
  localStorage.setItem("stomplab.tutorial.v14", "1");
  localStorage.setItem("stomplab.tutorial.v13", "1");
  localStorage.setItem("stomplab.tutorial.v12", "1");
  localStorage.setItem("stomplab.tutorial.v11", "1");
  localStorage.setItem("stomplab.tutorial.v10", "1");
  localStorage.setItem("stomplab.tutorial.v9", "1");
  localStorage.setItem("stomplab.tutorial.v8", "1");
  localStorage.setItem("stomplab.tutorial.v7", "1");
  localStorage.setItem("stomplab.tutorial.v6", "1");
  localStorage.setItem("stomplab.onboarded.v3", "1");
});
page.setDefaultTimeout(20000);

async function dismissTour() {
  await page.evaluate(() => {
    try {
      localStorage.setItem("stomplab.tutorial.v15", "1");
      localStorage.setItem("stomplab.tutorial.v14", "1");
      localStorage.setItem("stomplab.onboarded.v3", "1");
    } catch {
      /* ignore */
    }
  });
  const skip = page.getByRole("button", { name: "Skip tour" });
  try {
    if (await skip.isVisible({ timeout: 800 })) {
      await skip.click({ force: true });
    }
  } catch {
    /* already gone */
  }
  await page
    .locator('[role="dialog"][aria-modal="true"]')
    .waitFor({ state: "hidden", timeout: 4000 })
    .catch(() => undefined);
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"][aria-modal="true"]').forEach((el) => {
      el.parentElement?.remove();
    });
  });
  await page.waitForTimeout(200);
}

async function shot(sel, dest, maxHeight = 0) {
  const loc = page.locator(sel).first();
  await loc.waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  if (maxHeight) {
    const box = await loc.boundingBox();
    if (!box) throw new Error(`no box for ${sel}`);
    await page.screenshot({
      path: dest,
      animations: "disabled",
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.width, 1200),
        height: Math.min(box.height, maxHeight),
      },
    });
  } else {
    await loc.screenshot({ path: dest, animations: "disabled" });
  }
  console.log("wrote", dest);
}

const base = process.argv[2] || "http://127.0.0.1:8080";
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("stomplab.tutorial.v15", "1");
  localStorage.setItem("stomplab.tutorial.v14", "1");
  localStorage.setItem("stomplab.onboarded.v3", "1");
});
await page.reload({ waitUntil: "networkidle" });
await dismissTour();
await page.getByRole("heading", { name: /get the tone/i }).waitFor();
await shot('[data-tutorial="lab"]', "/workspace/public/tutorial/lab.png");

await page.goto(`${base}/preset/featured-sandman`, { waitUntil: "networkidle" });
await dismissTour();
await shot('[data-tutorial="replica"]', "/workspace/public/tutorial/replica.png");

await page.goto(`${base}/catalog`, { waitUntil: "networkidle" });
await dismissTour();
await shot('[data-tutorial="catalog"]', "/workspace/public/tutorial/catalog.png", 780);

await page.goto(`${base}/create`, { waitUntil: "networkidle" });
await dismissTour();
await shot('[data-tutorial="create"]', "/workspace/public/tutorial/create.png", 820);

await browser.close();
