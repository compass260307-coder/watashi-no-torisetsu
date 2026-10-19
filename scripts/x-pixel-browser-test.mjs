// Fresh Chrome profile; real source, stub uwt.js, all external traffic blocked.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import vm from 'node:vm';
import puppeteer from 'puppeteer-core';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const configCode = compile('src/lib/x-pixel-config.ts');
const helperCode = compile('src/lib/xPixel.ts');
const config = {};
vm.runInNewContext(configCode, { exports: config });
const html = `<html><head><script>${config.X_PIXEL_SCRIPT}</script><script>
window.xConfig=(function(){var exports={};${configCode};return exports})();
window.pixel=(function(){var exports={};var require=function(n){if(n==='@/lib/x-pixel-config')return window.xConfig;throw Error(n)};${helperCode};return exports})();
</script></head><body>Offline five-pixel browser checks</body></html>`;
const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end(html); });
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = resolve('.codex_tmp', `x-four-browser-${Date.now()}`);
mkdirSync(profile, { recursive: true });
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: profile });
  const blocked = []; let loads = 0;
  async function page() {
    const p = await browser.newPage(); await p.setRequestInterception(true);
    p.on('request', (r) => {
      if (r.url() === 'https://static.ads-twitter.com/uwt.js') {
        loads++; void r.respond({ contentType: 'text/javascript', body: `window.calls=[];window.twq.exe=function(){window.calls.push(Array.from(arguments))};window.twq.queue.forEach(function(a){window.twq.exe.apply(null,a)});window.twq.queue=[];` });
      } else if (r.url().startsWith(origin)) void r.continue();
      else { blocked.push(r.url()); void r.abort(); }
    });
    await p.goto(origin, { waitUntil: 'load' }); return p;
  }
  const a = await page();
  assert.deepEqual(await a.evaluate(() => ({ cookie: document.cookie, local: Object.keys(localStorage), session: Object.keys(sessionStorage) })), { cookie: '', local: [], session: [] });
  assert.deepEqual(await a.evaluate(() => window.calls), ['rgg36', 'rgob2', 'rgskb', 'rgtx5', 'rhj3s'].map((id) => ['config', id]));
  const events = (p) => p.evaluate(() => window.calls.filter((c) => c[0] === 'event'));
  const diagnosis = (p, mark = false) => p.evaluate(async (mark) => {
    const x = window.pixel;
    if (mark) sessionStorage.setItem(x.X_DIAGNOSIS_PENDING_PREFIX + 'offline-browser-diagnosis', String(Date.now()));
    return x.trackXEventsOnce(x.X_DIAGNOSIS_COMPLETE_EVENT_IDS, { conversion_id: 'offline-browser-diagnosis' }, true);
  }, mark);
  assert.equal(await diagnosis(a), false);
  assert.equal(await diagnosis(a, true), true);
  assert.deepEqual(await events(a), ['tw-rgg36-rgg9b', 'tw-rgob2-rgobn', 'tw-rgskb-rgski', 'tw-rgtx5-rgu2v', 'tw-rhj3s-rhj43'].map((id) => ['event', id, {}]));
  await diagnosis(a); assert.equal((await events(a)).length, 5);
  await a.reload({ waitUntil: 'load' }); await diagnosis(a); assert.equal((await events(a)).length, 0);
  const purchase = (p, id, currency = 'JPY') => p.evaluate(async ({ id, currency }) => {
    const x = window.pixel;
    return x.trackXEventsOnce(x.xPurchaseEventIds(currency), { conversion_id: id, value: 499, currency });
  }, { id, currency });
  assert.equal(await purchase(a, 'offline-browser-payment'), true);
  assert.deepEqual(await events(a), [
    ['event', 'tw-rgg36-rgg3b', { conversion_id: 'offline-browser-payment', value: 499, currency: 'JPY' }],
    ...['tw-rgob2-rgobj', 'tw-rgskb-rgskd', 'tw-rgtx5-rgtx9', 'tw-rhj3s-rhj45'].map((id) => ['event', id, {}]),
  ]);
  await a.reload({ waitUntil: 'load' }); await purchase(a, 'offline-browser-payment'); assert.equal((await events(a)).length, 0);
  await purchase(a, 'offline-browser-usd', 'USD'); assert.equal((await events(a)).length, 4);
  const b = await page(); await a.reload({ waitUntil: 'load' });
  assert.equal(await a.evaluate(() => Boolean(navigator.locks)), true);
  await Promise.all([purchase(a, 'offline-browser-two-tabs'), purchase(b, 'offline-browser-two-tabs')]);
  assert.equal((await events(a)).length + (await events(b)).length, 5);
  assert.equal(loads, 5);
  assert.deepEqual(blocked, []);
  console.log('Fresh Chrome checks passed: empty cookies/storage, 5 configs/diagnosis/JPY purchases, 4 non-JPY purchases, reload and cross-tab dedupe. No external requests sent.');
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }
