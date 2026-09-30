// Browser regression: no production requests, credentials, writes or analytics.
import assert from "node:assert/strict";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { STATIC_ASSET_RECOVERY_SCRIPT } from "../src/lib/static-asset-recovery.mjs";

const requests = [];
const server = http.createServer((req, res) => {
  requests.push({ method: req.method, url: req.url });
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/image.png" || url.pathname === "/api/example") {
    res.writeHead(url.pathname.includes("server-error") ? 503 : 404, { "Content-Type": "text/plain" });
    return res.end("Not Found");
  }
  const initial = url.searchParams.get("initial");
  const asset = initial === "css"
    ? '<link rel="stylesheet" href="/_next/static/gone.css?dpl=old">'
    : initial === "js" ? '<script src="/_next/static/gone.js?dpl=old" defer></script>' : "";
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!doctype html><html><head><script>${STATIC_ASSET_RECOVERY_SCRIPT}</script>${asset}</head><body><input id="answer"><p id="content">Working page</p></body></html>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let assertions = 0;
try {
  const page = await browser.newPage();
  const headCount = () => requests.filter((r) => r.method === "HEAD").length;
  await page.goto(origin);
  assert.equal(headCount(), 0); assertions++;

  for (const kind of ["js", "css"]) {
    await page.goto(`${origin}/?initial=${kind}`);
    await page.waitForSelector("#wt-asset-recovery");
    assert.equal(await page.$eval("#content", (e) => e.textContent), "Working page"); assertions++;
  }

  await page.goto(`${origin}/?private-token=must-not-be-recorded`);
  await page.type("#answer", "unsaved answer");
  const docsBefore = requests.filter((r) => r.url.includes("private-token")).length;
  await page.evaluate(() => {
    for (let i = 0; i < 6; i++) {
      const script = document.createElement("script");
      script.src = `/_next/static/missing-${i}.js?dpl=old`;
      document.head.appendChild(script);
    }
  });
  await page.waitForSelector("#wt-asset-recovery");
  await pause(300);
  assert.equal(await page.$$eval("#wt-asset-recovery", (els) => els.length), 1); assertions++;
  assert.equal(await page.$eval("#answer", (e) => e.value), "unsaved answer"); assertions++;
  assert.equal(requests.filter((r) => r.url.includes("private-token")).length, docsBefore); assertions++;
  const record = await page.evaluate(() => sessionStorage.getItem("wt_missing_static_assets_v1"));
  assert.equal(JSON.parse(record).length, 3); assertions++;
  assert(!record.includes("private-token")); assertions++;
  assert(JSON.parse(record).every((v) => v.deployment === "old")); assertions++;
  await page.click("#wt-asset-recovery button:last-child");
  assert.equal(await page.$("#wt-asset-recovery"), null); assertions++;

  await page.goto(origin);
  const beforeFalsePositives = headCount();
  await page.evaluate(() => {
    const image = document.createElement("img"); image.src = "/image.png"; document.body.appendChild(image);
    fetch("/api/example");
    const external = document.createElement("script");
    external.src = "https://example.invalid/_next/static/ad.js";
    document.body.appendChild(external); external.dispatchEvent(new Event("error"));
    throw new Error("Ordinary application error");
  }).catch(() => {});
  await pause(300);
  assert.equal(headCount(), beforeFalsePositives); assertions++;
  assert.equal(await page.$("#wt-asset-recovery"), null); assertions++;

  await page.goto(origin);
  await page.evaluate(() => {
    const script = document.createElement("script"); script.src = "/_next/static/server-error.js"; document.body.appendChild(script);
  });
  await pause(300);
  assert.equal(await page.$("#wt-asset-recovery"), null); assertions++;

  await page.goto(origin);
  await page.setOfflineMode(true);
  await page.evaluate(() => {
    const script = document.createElement("script"); script.src = "/_next/static/offline.js"; document.body.appendChild(script);
  });
  await pause(300);
  assert.equal(await page.$("#wt-asset-recovery"), null); assertions++;
  await page.setOfflineMode(false);

  await page.goto(origin);
  await page.evaluate(() => { void import("/_next/static/dynamic.js?dpl=old"); });
  await page.waitForSelector("#wt-asset-recovery");
  assertions++;
  await Promise.all([page.waitForNavigation(), page.click("#wt-asset-recovery button:first-of-type")]);
  assert.equal(await page.$("#wt-asset-recovery"), null); assertions++;
  console.log(`Static asset recovery: ${assertions} browser checks passed`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
