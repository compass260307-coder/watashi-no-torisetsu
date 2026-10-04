import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, '.codex_tmp/full-access-cost/browser');
mkdirSync(output, { recursive: true });
const require = createRequire(import.meta.url);
const { webpack } = require('next/dist/compiled/webpack/webpack');
writeFileSync(resolve(output, 'loader.cjs'), `const ts = require(${JSON.stringify(require.resolve('typescript'))});
module.exports = function(source) { return ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText; };`);
writeFileSync(resolve(output, 'entry.tsx'), `
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useFullAccessStatus } from '@/lib/use-course-navigation-access';
import { invalidateFullAccessStatus, requestFullAccessStatus } from '@/lib/full-access-status-client';
import { PaidUnlockWatcher } from '@/components/result/PaidUnlockWatcher';
function Consumer({ token, index }) {
  const access = useFullAccessStatus(token);
  return <pre data-consumer={index}>{JSON.stringify(access)}</pre>;
}
function App() {
  const [token, setToken] = useState(localStorage.getItem('torisetsu_owner_token'));
  const [key, setKey] = useState(0);
  const [watcher, setWatcher] = useState(new URLSearchParams(location.search).get('paid') === '1');
  window.qa = {
    rerender: () => setKey(k => k + 1),
    navigate: () => { history.pushState(null, '', '/tako/' + token); setKey(k => k + 1); },
    login: (next) => { if(next) localStorage.setItem('torisetsu_owner_token', next); else localStorage.removeItem('torisetsu_owner_token'); invalidateFullAccessStatus(); setToken(next); },
    purchase: () => { history.replaceState(null, '', '/me/' + token + '?paid=1'); setWatcher(true); },
    request: requestFullAccessStatus,
  };
  return <><div key={key}>{[0,1,2].map(index => <Consumer key={index} token={token} index={index}/>)}</div>
    {watcher && token ? <PaidUnlockWatcher ownerToken={token}/> : null}</>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);
`);
await new Promise((accept, reject) => {
  webpack({ mode: 'development', target: 'web', entry: resolve(output, 'entry.tsx'),
    output: { path: output, filename: 'bundle.js' }, devtool: false,
    resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': resolve(root, 'src') } },
    module: { rules: [{ test: /\.tsx?$/, use: [resolve(output, 'loader.cjs')], exclude: /node_modules/ }] },
    plugins: [new webpack.DefinePlugin({ 'process.env.NODE_ENV': JSON.stringify('development') })],
  }, (error, stats) => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : accept());
});
const empty = { full: false, selfReport: false, friend: false, premiumBundle: false, astrologer: false, unmei: false, tarot: false };
const full = { full: true, selfReport: true, friend: true, premiumBundle: false, astrologer: true, unmei: true, tarot: true };
const statuses = new Map([['token-a', empty], ['token-b', empty]]);
const calls = [];
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(readFileSync(resolve(output, 'bundle.js'))); return; }
  if (url.pathname === '/api/checkout/full-access-status') {
    const token = url.searchParams.get('owner_token'); calls.push(token);
    response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'private, no-store');
    response.end(JSON.stringify(statuses.get(token) ?? empty)); return;
  }
  response.setHeader('Content-Type', 'text/html');
  response.end('<!DOCTYPE html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
});
await new Promise(accept => server.listen(0, '127.0.0.1', accept));
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.CHROME_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
let browser;
const errors = [];
try {
  browser = await puppeteer.launch({ executablePath, headless: true, userDataDir: resolve(output, 'profile') });
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', req => req.url().startsWith(base) ? req.continue() : req.abort());
  await page.evaluateOnNewDocument(() => { if (!localStorage.getItem('torisetsu_owner_token') && !sessionStorage.getItem('qa-initialized')) { localStorage.setItem('torisetsu_owner_token', 'token-a'); sessionStorage.setItem('qa-initialized', '1'); } });
  const waitStatus = async (expected, target = page) => target.waitForFunction(value => {
    const nodes = [...document.querySelectorAll('[data-consumer]')];
    return nodes.length === 3 && nodes.every(n => n.textContent === JSON.stringify(value));
  }, {}, expected);
  await page.goto(`${base}/me/token-a`); await waitStatus(empty);
  assert.equal(calls.length, 1, 'React StrictMode + 3 mounted consumers dedupe');
  await page.evaluate(() => window.qa.rerender()); await waitStatus(empty); assert.equal(calls.length, 1);
  await page.evaluate(() => window.qa.navigate()); await waitStatus(empty); assert.equal(calls.length, 1);
  await page.reload(); await waitStatus(empty); assert.equal(calls.length, 1, 'real browser reload retains session cache');
  const tab = await browser.newPage(); await tab.goto(`${base}/second-tab`); await waitStatus(empty, tab);
  const beforeFocus = calls.length;
  await tab.bringToFront(); await page.bringToFront(); await waitStatus(empty); assert.equal(calls.length, beforeFocus);
  // An unpaid cache is present when the real purchase watcher mounts.
  statuses.set('token-a', full);
  await page.evaluate(() => window.qa.purchase());
  await page.waitForFunction(() => !location.search.includes('paid=1'));
  await waitStatus(full);
  await waitStatus(full, tab);
  assert.ok(calls.length > beforeFocus, 'purchase fetches current state');
  const beforeReload = calls.length;
  await page.reload(); await waitStatus(full); assert.equal(calls.length, beforeReload);
  // Upsell confirmation invalidates independently of ordinary full access.
  statuses.set('token-a', { ...full, premiumBundle: true });
  await page.evaluate(() => { history.replaceState(null, '', '/me/token-a?upgraded=1'); window.qa.rerender(); });
  await waitStatus({ ...full, premiumBundle: true });
  await waitStatus({ ...full, premiumBundle: true }, tab);
  await page.evaluate(() => { history.replaceState(null, '', '/me/token-a'); window.qa.login(null); });
  await waitStatus(null); await waitStatus(null, tab);
  await page.evaluate(() => window.qa.login('token-b'));
  await waitStatus(empty);
  const last = calls.at(-1); assert.equal(last, 'token-b', 'new login fetches only B');
  await page.reload(); await waitStatus(empty);
  assert.deepEqual(errors, [], 'no browser/React runtime errors');
  console.log('Browser checks passed: React StrictMode/re-render, unpaid, full, upsell, purchase watcher, reload, navigation, focus, cross-tab update, logout -> B.');
  console.log(`Status HTTP calls: ${calls.length} across the complete scenario; no external services used.`);
} finally {
  await browser?.close();
  await new Promise(accept => server.close(accept));
}
