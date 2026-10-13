// Offline browser harness: execute the real loader/helper with a stub uwt.js.
// No app API, Stripe, database or advertising endpoint receives a request.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import puppeteer from "puppeteer-core";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const loader = readFileSync(new URL("src/app/layout.tsx", root), "utf8").match(/const X_PIXEL_SCRIPT = `([^`]+)`;/)[1];
const helper = ts.transpileModule(readFileSync(new URL("src/lib/xPixel.ts", root), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const html = `<html><head><script>${loader}</script><script>var exports={};${helper};window.pixel=exports;</script></head><body>Offline X pixel checks</body></html>`;
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html" }); response.end(html);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = resolve(".codex_tmp", `x-rh5rd-browser-${Date.now()}`);
mkdirSync(profile, { recursive: true });
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true, userDataDir: profile,
  });
  let stubLoads = 0; const blocked = [];
  async function newPage() {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url() === "https://static.ads-twitter.com/uwt.js") {
        stubLoads++;
        void request.respond({ contentType: "text/javascript", body: `window.calls=[];window.twq.exe=function(){window.calls.push(Array.from(arguments));};window.twq.queue.forEach(function(args){window.twq.exe.apply(null,args);});window.twq.queue=[];` });
      } else if (request.url().startsWith(origin)) void request.continue();
      else { blocked.push(request.url()); void request.abort(); }
    });
    await page.goto(origin, { waitUntil: "load" });
    await page.waitForFunction(() => typeof window.twq?.exe === "function");
    return page;
  }
  const page = await newPage();
  assert.deepEqual(await page.evaluate(() => window.calls), ["rg1zg", "rezdw", "rgg36", "rgi5k", "rgkns", "rgkqm", "rgm4u", "rgob2", "rgskb", "rgtx5", "rgyo2", "rh5rd"].map((id) => ["config", id]));
  const events = (target) => target.evaluate(() => window.calls.filter((call) => call[0] === "event"));
  async function diagnosis(target, saved = false) {
    return target.evaluate(async (saved) => {
      const p = window.pixel;
      if (saved) sessionStorage.setItem(p.X_DIAGNOSIS_PENDING_PREFIX + "browser-diagnosis", String(Date.now()));
      return p.trackXEventsOnce(p.X_DIAGNOSIS_COMPLETE_EVENT_IDS, { conversion_id: "browser-diagnosis" }, true);
    }, saved);
  }
  assert.equal(await diagnosis(page), false);
  assert.equal((await events(page)).length, 0);
  assert.equal(await diagnosis(page, true), true);
  assert.equal(await diagnosis(page), true);
  assert.equal((await events(page)).length, 12);
  assert.deepEqual((await events(page)).at(-1), ["event", "tw-rh5rd-rh5sh", {}]);
  await page.reload({ waitUntil: "load" });
  await diagnosis(page);
  assert.equal((await events(page)).length, 0);

  async function purchase(target, access, id = "browser-payment") {
    return target.evaluate(async ({ access, id }) => {
      const p = window.pixel;
      return p.trackXEventsOnce(p.xPurchaseEventIds("JPY"), { conversion_id: id, value: 499, currency: "JPY" }, false, () => true, access);
    }, { access, id });
  }
  assert.equal(await purchase(page, false), false);
  assert.equal((await events(page)).length, 11);
  assert.equal((await events(page)).some((call) => call[1] === "tw-rh5rd-rh5sg"), false);
  await page.reload({ waitUntil: "load" });
  assert.equal(await purchase(page, false), false);
  assert.equal((await events(page)).length, 0);
  assert.equal(await purchase(page, true), true);
  assert.deepEqual(await events(page), [["event", "tw-rh5rd-rh5sg", {}]]);
  await purchase(page, true);
  assert.equal((await events(page)).length, 1);
  await page.reload({ waitUntil: "load" });
  await purchase(page, true);
  assert.equal((await events(page)).length, 0);

  const second = await newPage();
  assert.equal(await page.evaluate(() => Boolean(navigator.locks)), true);
  await Promise.all([purchase(page, true, "browser-two-tabs"), purchase(second, true, "browser-two-tabs")]);
  assert.equal((await events(page)).length + (await events(second)).length, 12);
  assert.equal(stubLoads, 5, "Each of five documents loads the stub exactly once");
  assert.deepEqual(blocked, []);
  console.log("Chrome offline X pixel checks passed: 12 configs, gated diagnosis/purchase, reload and cross-tab dedupe; no external requests sent.");
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
