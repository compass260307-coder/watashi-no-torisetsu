// Fresh Chrome; compile the actual GTM hand-off code, deny every external request.
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
const measurementCode = compile('src/lib/verified-conversions.ts');
const measurement = {};
vm.runInNewContext(measurementCode, { exports: measurement });
const html = `<html><head><script>${measurement.MEASUREMENT_INIT_SCRIPT}</script><script>
window.directCalls=0;window.twq=function(){window.directCalls++;throw Error('Direct X forbidden')};
window.xConfig=(function(){var exports={};${configCode};return exports})();
window.measurement=(function(){var exports={};${measurementCode};return exports})();
window.pixel=(function(){var exports={};var require=function(n){if(n==='@/lib/x-pixel-config')return window.xConfig;if(n==='@/lib/verified-conversions')return window.measurement;throw Error(n)};${helperCode};return exports})();
</script></head><body>Offline GTM-only browser checks</body></html>`;
const server = createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); });
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = resolve('.codex_tmp', `x-gtm-browser-${Date.now()}`);
mkdirSync(profile, { recursive: true });
let browser;
try {
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: profile });
  const blocked = [];
  async function page(path = '/') {
    const p = await browser.newPage(); await p.setRequestInterception(true);
    p.on('request', (r) => { if (r.url().startsWith(origin)) void r.continue(); else { blocked.push(r.url()); void r.abort(); } });
    await p.goto(origin + path, { waitUntil: 'load' }); return p;
  }
  const events = (p) => p.evaluate(() => window.dataLayer.filter((e) => e.event !== 'measurement_ready'));
  const diagnosis = (p, mark = false) => p.evaluate(async (mark) => {
    const x = window.pixel; if (mark) x.markXDiagnosisSaved('offline-browser-diagnosis', 'ja');
    return x.trackXEventsOnce(x.X_DIAGNOSIS_COMPLETE_EVENT_IDS, { conversion_id: 'offline-browser-diagnosis' }, true);
  }, mark);
  const purchase = (p, id, currency = 'JPY') => p.evaluate(({id,currency}) => window.pixel.trackXEventsOnce(
    window.pixel.xPurchaseEventIds(currency), { conversion_id: id, value: 499, currency }), {id,currency});
  const a = await page();
  assert.deepEqual(await a.evaluate(() => ({cookie:document.cookie,local:Object.keys(localStorage),session:Object.keys(sessionStorage)})), {cookie:'',local:[],session:[]});
  assert.equal(await diagnosis(a), false); assert.equal(await diagnosis(a,true), true);
  assert.deepEqual(await events(a), [{event:'diagnosis_completed',event_id:'offline-browser-diagnosis',conversion_id:'offline-browser-diagnosis',x_transport:'gtm',measurement_version:1}]);
  await a.reload({waitUntil:'load'}); await diagnosis(a,true); assert.equal((await events(a)).length,0);
  assert.equal(await purchase(a,'cs_live_offlineBrowser'),true);
  assert.deepEqual(await events(a), [{event:'purchase_verified',event_id:'cs_live_offlineBrowser',conversion_id:'cs_live_offlineBrowser',value:499,currency:'JPY',x_transport:'gtm',measurement_version:1}]);
  await a.reload({waitUntil:'load'}); await purchase(a,'cs_live_offlineBrowser'); assert.equal((await events(a)).length,0);
  assert.equal(await purchase(a,'cs_live_offlineUsd','USD'),false); assert.equal((await events(a)).length,0);
  const b = await page(); assert.equal(await a.evaluate(() => Boolean(navigator.locks)),true);
  await Promise.all([purchase(a,'cs_live_offlineConcurrent'),purchase(b,'cs_live_offlineConcurrent')]);
  assert.equal((await events(a)).length+(await events(b)).length,1);
  const ko = await page('/ko');
  await ko.evaluate(() => window.pixel.markXDiagnosisSaved('offline-ko-result','ko'));
  await ko.goto(origin+'/me/common-result',{waitUntil:'load'});
  await ko.evaluate(() => window.pixel.trackXEventsOnce(window.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS,{conversion_id:'offline-ko-result'},true));
  assert.equal((await events(ko)).length,1);
  assert.equal(await purchase(ko,'cs_live_offlineKrw','KRW'),false);
  for (const p of [a,b,ko]) assert.equal(await p.evaluate(() => window.directCalls),0);
  assert.deepEqual(blocked,[]);
  console.log('Chrome GTM-only checks passed: verified gates, exact dataLayer values, reload/cross-tab dedupe, locales/currencies; zero direct X calls or external requests.');
} finally { await browser?.close(); await new Promise((done) => server.close(done)); }
