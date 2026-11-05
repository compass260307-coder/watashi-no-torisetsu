// Browser regression: no production requests, credentials, writes or analytics.
import assert from "node:assert/strict";
import http from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import { STATIC_ASSET_RECOVERY_SCRIPT, MISSING_STATIC_ASSET_BOOTSTRAP } from "../src/lib/static-asset-recovery.mjs";

// Compile the actual purchase component and Stripe redirect, not a substitute purchase button.
const root = resolve(import.meta.dirname, '..');
mkdirSync(resolve(root, '.codex_tmp'), { recursive: true });
const output = mkdtempSync(resolve(root, '.codex_tmp/static-recovery-browser-'));
const require = createRequire(import.meta.url);
const { webpack } = require('next/dist/compiled/webpack/webpack');
writeFileSync(resolve(output, 'loader.cjs'), `const ts = require(${JSON.stringify(require.resolve('typescript'))});
module.exports = source => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;`);
writeFileSync(resolve(output, 'entry.tsx'), `import {createRoot} from 'react-dom/client';
import {FullAccessCta} from '@/components/result/FullAccessCta';
createRoot(document.getElementById('root')).render(<FullAccessCta ownerToken="offline" locale="ja" source="paywall_direct">購入する</FullAccessCta>);`);
await new Promise((accept, reject) => {
  webpack({ mode: 'development', target: 'web', entry: resolve(output, 'entry.tsx'),
    output: { path: output, filename: 'checkout.js' }, devtool: false,
    resolve: { extensions: ['.tsx', '.ts', '.mjs', '.js'], alias: { '@': resolve(root, 'src') } },
    module: { rules: [{ test: /\.tsx?$/, use: [resolve(output, 'loader.cjs')], exclude: /node_modules/ }] },
    plugins: [new webpack.DefinePlugin({ 'process.env': JSON.stringify({ NODE_ENV: 'development' }) })],
  }, (error, stats) => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : accept());
});

const requests = [];
const server = http.createServer((req, res) => {
  const recorded = { method: req.method, url: req.url };
  requests.push(recorded);
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === '/checkout.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    return res.end(readFileSync(resolve(output, 'checkout.js')));
  }
  if (url.pathname === '/_next/static/legacy-checkout.js') {
    res.writeHead(req.method === 'HEAD' ? 404 : 200, {
      'Content-Type': 'application/javascript', 'Cache-Control': 'no-store',
    });
    return res.end(req.method === 'HEAD' ? '' : MISSING_STATIC_ASSET_BOOTSTRAP);
  }
  if (url.pathname === '/api/checkout/create-full-access-session') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      recorded.body = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: '/mock-stripe', amount: 499, currency: 'JPY' }));
    });
    return;
  }
  if (url.pathname === '/mock-stripe') return res.end('Mock Stripe checkout');
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/image.png" || url.pathname === "/api/example") {
    res.writeHead(url.pathname.includes("server-error") ? 503 : 404, { "Content-Type": "text/plain" });
    return res.end("Not Found");
  }
  const initial = url.searchParams.get("initial");
  if (url.searchParams.has('legacy')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const stale = !url.searchParams.has('_wt_asset_refresh');
    return res.end(stale
      // An already-cached page has the old guard and cannot receive the new inline script.
      ? '<!doctype html><script>window.__wtAssetRecovery=true</script><script src="/_next/static/legacy-checkout.js" defer></script><body>Old result' + (url.searchParams.has('draft') ? '<textarea id="old-draft">unsaved before recovery loaded</textarea>' : '') + '</body>'
      : '<!doctype html><div id="root"></div><script src="/checkout.js"></script>');
  }
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
  await page.setRequestInterception(true);
  page.on('request', request => request.url().startsWith(origin + '/') ? request.continue() : request.abort());
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
  // Cached old HTML + missing runtime: the server bootstrap restores the saved result,
  // retains the owner URL/query/hash and lets the buyer reach a mocked checkout exactly once.
  await page.evaluate(() => sessionStorage.clear());
  await page.evaluate(() => {
    localStorage.setItem('torisetsu_owner_token', 'offline');
    document.cookie = 'offline_owner=offline; path=/; SameSite=Lax';
  });
  await page.goto(`${origin}/me/offline?legacy=1&utm_source=x#purchase`);
  await page.waitForSelector('#root button');
  const restored = new URL(page.url());
  assert.equal(restored.pathname, '/me/offline'); assertions++;
  assert.equal(restored.searchParams.get('utm_source'), 'x'); assertions++;
  assert.equal(restored.hash, '#purchase'); assertions++;
  assert(restored.searchParams.has('_wt_asset_refresh')); assertions++;
  assert.equal(await page.evaluate(() => localStorage.getItem('torisetsu_owner_token')), 'offline'); assertions++;
  assert((await page.evaluate(() => document.cookie)).includes('offline_owner=offline')); assertions++;
  const attemptsBefore = requests.filter(r => r.url === '/api/checkout/create-full-access-session').length;
  await Promise.all([page.waitForNavigation(), page.click('#root button')]);
  assert.equal(new URL(page.url()).pathname, '/mock-stripe'); assertions++;
  assert.equal(requests.filter(r => r.url === '/api/checkout/create-full-access-session').length, attemptsBefore + 1); assertions++;
  const purchase = requests.findLast(r => r.url === '/api/checkout/create-full-access-session').body;
  assert.equal(purchase.owner_token, 'offline'); assertions++;
  assert.equal(purchase.product, 'full_access'); assertions++;
  assert.equal(purchase.locale, 'ja'); assertions++;
  assert(purchase.checkout_attempt_id); assertions++;

  // Multiple failures, including a runtime that remains unavailable, cannot cause a loop.
  await page.goto(`${origin}/me/offline?initial=js`);
  await page.waitForSelector('#wt-asset-recovery');
  assert(!new URL(page.url()).searchParams.has('_wt_asset_refresh')); assertions++;

  // Saved-result routes refresh on a confirmed 404, but unsaved inputs must survive.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${origin}/me/offline`);
  await page.type('#answer', 'unsaved answer');
  await page.evaluate(() => {
    const s=document.createElement('script');s.src='/_next/static/draft.js';document.head.appendChild(s);
  });
  await page.waitForSelector('#wt-asset-recovery');
  assert.equal(await page.$eval('#answer', el=>el.value), 'unsaved answer'); assertions++;
  assert(!new URL(page.url()).searchParams.has('_wt_asset_refresh')); assertions++;
  await Promise.all([page.waitForNavigation(), page.click('#wt-asset-recovery button:first-of-type')]);
  assert(new URL(page.url()).searchParams.has('_wt_asset_refresh')); assertions++;

  // An older runtime can have controlled inputs whose current value equals defaultValue.
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${origin}/me/offline?legacy=1&draft=1`);
  await page.waitForSelector('#wt-asset-recovery');
  assert.equal(await page.$eval('#old-draft', el=>el.value), 'unsaved before recovery loaded'); assertions++;
  assert(!new URL(page.url()).searchParams.has('_wt_asset_refresh')); assertions++;

  for (const locale of ['en', 'ko', 'id']) {
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${origin}/${locale}/me/offline?legacy=1&session_id=offline-session#paid`);
    await page.waitForSelector('#root button');
    const url = new URL(page.url());
    assert.equal(url.pathname, `/${locale}/me/offline`); assertions++;
    assert.equal(url.searchParams.get('session_id'), 'offline-session'); assertions++;
    assert.equal(url.hash, '#paid'); assertions++;
  }
  console.log(`Static asset recovery: ${assertions} browser checks passed`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
