// Offline only: the actual loader/helper run in a VM. No advertising endpoint,
// checkout, database or application API receives any request.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
const normalize = (value) => JSON.parse(JSON.stringify(value));
function moduleFrom(code, dependencies = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, ...globals, require: (name) => {
    assert.ok(name in dependencies, "Unmocked dependency: " + name);
    return dependencies[name];
  } });
  return exports;
}
const config = moduleFrom(source("src/lib/x-pixel-config.ts"));
const helperSource = source("src/lib/xPixel.ts");
const storage = (map = new Map()) => ({
  getItem: (key) => map.get(key) ?? null,
  setItem: (key, value) => map.set(key, value),
  removeItem: (key) => map.delete(key),
});
function env({ code = helperSource, local = new Map(), locks, session = new Map(), pixelConfig = config } = {}) {
  const calls = [];
  const window = { localStorage: storage(local), sessionStorage: storage(session),
    navigator: locks ? { locks } : {}, twq: (...args) => calls.push(args) };
  const verified = moduleFrom(source("src/lib/verified-conversions.ts"), {}, { window });
  const pixel = moduleFrom(code, { "@/lib/x-pixel-config": pixelConfig, "@/lib/verified-conversions": verified }, { window });
  return { calls, window, pixel, local, session };
}
const ids = ["rgg36"];
const purchaseIds = ["tw-rgg36-rgg3b"];
const params = { conversion_id: "offline-four-pixels", value: 499, currency: "JPY" };
const sentKey = (id, conversion = params.conversion_id) => "wt_x_sent_v1:" + id + ":" + conversion;
const groupKey = "wt_x_purchase_sent_v1:" + params.conversion_id;
function marker(e, at = Date.now()) {
  e.session.set(e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id, String(at));
}
async function send(e, diagnosis = false, currency = "JPY", active = () => true) {
  return e.pixel.trackXEventsOnce(diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds(currency),
    { ...params, currency }, diagnosis, active);
}
assert.deepEqual(normalize(config.ACTIVE_X_PIXELS.map((p) => p.id)), ids);
assert.equal(config.X_PIXEL_SCRIPT, undefined);
for (const path of ["src/app/layout.tsx", "src/lib/x-pixel-config.ts", "src/lib/xPixel.ts", "src/lib/verified-conversions.ts"]) {
  assert.doesNotMatch(source(path), /twq|static\.ads-twitter\.com|uwt\.js/, "No direct X code: " + path);
}
assert.doesNotMatch(source("src/app/layout.tsx"), /id="x-pixel"/);
for (const locale of ["ja", "ko", "en", "id"]) for (const currency of ["JPY", "USD", "KRW", "IDR", "THB"]) {
  const e = env(); e.pixel.markXDiagnosisSaved(params.conversion_id, locale);
  assert.equal(await send(e, true, currency), true);
  assert.equal(await send(e, false, currency), currency === "JPY");
  const events = e.window.dataLayer;
  assert.equal(events.length, currency === "JPY" ? 2 : 1);
  assert.equal(events[0].event, "diagnosis_completed");
  assert.equal(events[0].event_id, params.conversion_id);
  assert.equal(events[0].conversion_id, params.conversion_id);
  assert.equal(events[0].x_transport, "gtm");
  if (currency === "JPY") assert.deepEqual(normalize(events[1]), {
    event: "purchase_verified", event_id: params.conversion_id, conversion_id: params.conversion_id,
    value: 499, currency: "JPY", x_transport: "gtm", measurement_version: 1,
  });
  assert.equal(e.calls.length, 0);
  const reload = env({ local: e.local, session: e.session });
  marker(reload); await send(reload, true); await send(reload, false, currency);
  assert.equal(reload.window.dataLayer, undefined, "Reload must not replay hand-offs");
}
for (const at of [null, Date.now()-600001, Date.now()+60000]) {
  const e=env(); if(at)marker(e,at);
  assert.equal(await send(e,true),false); assert.equal(e.window.dataLayer,undefined);
}
for (const historical of [groupKey, sentKey(purchaseIds[0]), sentKey("tw-rezdw-1436v3")]) {
  const e = env({ local:new Map([[historical,"1"]]) }); await send(e);
  assert.equal(e.window.dataLayer,undefined,"Do not replay successful direct-X purchases");
}
{
  // A stage-1 dataLayer hand-off with a failed direct tag is not a GTM delivery.
  const e=env({local:new Map([[`wt_verified_handoff_v1:purchase_verified:${params.conversion_id}`,"1"]])});
  assert.equal(await send(e),true); assert.equal(e.window.dataLayer.length,1);
}
{
  const e=env(); delete e.window.twq;
  assert.equal(await send(e),true,"GTM hand-off must not wait for the removed loader");
  assert.equal(e.window.dataLayer.length,1);
}
{
  const e=env();marker(e);e.window.dataLayer={push(){throw Error("blocked consumer");}};
  assert.equal(await send(e,true),false);
  assert.equal(e.session.has(e.pixel.X_DIAGNOSIS_PENDING_PREFIX+params.conversion_id),true);
  const retry=env({local:e.local,session:e.session});assert.equal(await send(retry,true),true);
  assert.equal(retry.window.dataLayer.length,1);assert.equal(retry.calls.length,0);
}
{
  const local=new Map();let tail=Promise.resolve();const locks={request(_n,fn){const run=tail.then(fn);tail=run.catch(()=>{});return run;}};
  const a=env({local,locks}),b=env({local,locks});await Promise.all([send(a),send(b)]);
  assert.equal((a.window.dataLayer??[]).length+(b.window.dataLayer??[]).length,1);
}
{
  const e=env();for(const name of ["localStorage","sessionStorage"])Object.defineProperty(e.window,name,{get(){throw Error("denied");}});
  assert.equal(await send(e,true),false);assert.equal(await send(e),true);await send(e);
  assert.equal(e.window.dataLayer.length,1);assert.equal(e.calls.length,0);
}
{
  const window={};const m=moduleFrom(source("src/lib/verified-conversions.ts"));vm.runInNewContext(m.MEASUREMENT_INIT_SCRIPT,{window});
  assert.deepEqual(normalize(window.dataLayer),[{event:"measurement_ready",x_transport:"gtm",measurement_version:1}]);
}
console.log("GTM-only gates passed: locales/currencies, saved diagnosis, no loader dependence, historical direct purchases, retries, reload, cross-tab and storage failures. No direct X calls.");

const load = (path, deps, globals) => moduleFrom(source(path), deps, globals);
const meta = load("src/lib/meta-purchase.ts");
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function purchaseComponent(claim, alreadySent = false, responseOk = true) {
  const e = env();
  const effects = []; const requests = []; let state = null;
  if (alreadySent) {
    e.window.localStorage.setItem(meta.metaPurchaseStorageKey("full_access", claim.checkoutSessionId), "1");
    e.window.localStorage.setItem(meta.tiktokPurchaseStorageKey("full_access", claim.checkoutSessionId), "1");
  }
  e.window.ttq = { track() {} };
  const component = load("src/components/MetaPurchaseDataLayer.tsx", {
    react: { useEffect: (effect) => effects.push(effect), useState: () => [state, (value) => { state = value; }] },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "@/components/XTrack": { XTrack: "offline-XTrack" },
    "@/lib/xPixel": e.pixel, "@/lib/meta-purchase": meta,
  }, {
    window: e.window, localStorage: e.window.localStorage,
    fetch: async (url, options) => {
      assert.equal(url, "/api/checkout/meta-purchase");
      requests.push(JSON.parse(options.body));
      return { ok: responseOk, json: async () => claim };
    },
  });
  const props = { checkoutSessionId: claim.checkoutSessionId, product: "full_access", claimToken: "offline" };
  component.MetaPurchaseDataLayer(props);
  effects.shift()();
  await flush();
  return { ...e, requests, element: component.MetaPurchaseDataLayer(props) };
}
for (const currency of ["JPY", "USD", "KRW", "IDR", "THB"]) {
  const value = currency === "USD" ? 4.99 : 499;
  const e = await purchaseComponent({ checkoutSessionId: "cs_live_offline", value, currency }, true);
  assert.equal(e.requests[0].action, "prepare", "Meta/TikTok sent flags must not skip X");
  assert.deepEqual(normalize(e.element.props.params), { conversion_id: "cs_live_offline", value, currency });
  assert.deepEqual(Array.from(e.element.props.eventIds), Array.from(e.pixel.xPurchaseEventIds(currency)));
  await e.pixel.trackXEventsOnce(e.element.props.eventIds, e.element.props.params);
  await e.pixel.trackXEventsOnce(e.element.props.eventIds, e.element.props.params);
  assert.equal(e.calls.length, 0);
  assert.equal((e.window.dataLayer ?? []).length, currency === "JPY" ? 1 : 0);

}
{
  const claim = { checkoutSessionId: "cs_live_offline_discount", value: 321, currency: "JPY" };
  const e = await purchaseComponent(claim, true);
  await e.pixel.trackXEventsOnce(e.element.props.eventIds, e.element.props.params);
  assert.deepEqual(normalize(e.window.dataLayer[0]), { event: "purchase_verified", event_id: claim.checkoutSessionId,
    conversion_id: claim.checkoutSessionId, value: 321, currency: "JPY", x_transport: "gtm", measurement_version: 1
  }, "GTM receives the actual verified amount");
  assert.equal(e.calls.length, 0);
}
for (const claim of [
  { checkoutSessionId: "cs_test_offline", value: 499, currency: "JPY" },
  { checkoutSessionId: "cs_live_offline", currency: "JPY" },
  { checkoutSessionId: "cs_live_offline", value: NaN, currency: "JPY" },
  { checkoutSessionId: "cs_live_offline", value: -1, currency: "JPY" },
  { checkoutSessionId: "cs_live_offline", value: 499 },
]) {
  const e = await purchaseComponent(claim, true);
  assert.equal(e.element, null, "Do not fabricate missing payment data or track test purchases");
  assert.equal(e.calls.length, 0);
}
{
  const e = await purchaseComponent({ checkoutSessionId: "cs_live_offline", value: 499, currency: "JPY" }, true, false);
  assert.equal(e.element, null, "Failed payment verification must not mount X purchase tracking");
  assert.equal(e.calls.length, 0);
}

console.log("Actual purchase component checks passed: verified live settlements only, actual amounts/currencies, GTM after Meta/TikTok ack, invalid/test/failed claims excluded; all fetches stubbed.");

// Execute the real signed prepare handler and Stripe session verifier. Only
// Stripe retrieval, rate limiting and DB are stubbed; no application DB writes.
const crypto = await import('node:crypto');
let stripeSession;
const paidCheckout = load('src/lib/paid-checkout-session.ts', {
  'server-only': {}, 'node:crypto': crypto,
  '@/lib/stripe-server': { getStripe: () => ({ checkout: { sessions: { retrieve: async () => stripeSession } } }) },
  '@/lib/meta-purchase': meta,
  '@/lib/access-products': {
    hoshiyomiChatCreditTarget: () => 0, purchaseIncludesDestinyFeatures: () => false,
    purchaseIncludesFriendFeatures: () => false, purchaseIncludesHoshiyomiChat: () => false,
    purchaseIncludesTarotFeatures: () => false,
  },
}, { process: { env: { RATE_LIMIT_SECRET: 'offline-test-signing-secret' } }, Buffer });
const route = load('src/app/api/checkout/meta-purchase/route.ts', {
  'node:crypto': crypto, 'next/server': { NextResponse: Response },
  '@/lib/api-security': { consumeRateLimit: async () => ({ allowed: true }), readJsonObject: async (request) => ({ ok: true, value: await request.json() }) },
  '@/lib/meta-purchase': meta, '@/lib/origin-check': { checkOrigin: () => ({ ok: true }) },
  '@/lib/paid-checkout-session': paidCheckout,
  '@/lib/supabase-server': { supabaseAdmin: { from: () => { throw Error('DB access forbidden in prepare test'); } } },
});
const sessionId = 'cs_live_offlineServerKo';
const claimToken = paidCheckout.createMetaPurchaseClaimToken(sessionId);
const request = (token = claimToken) => new Request('https://offline.test/api/checkout/meta-purchase', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ checkout_session_id: sessionId, claim_token: token, action: 'prepare', checkoutLocale: 'ko' }),
});
for (const locale of ['ko', 'ja', 'en', 'id']) {
  stripeSession = { id: sessionId, status: 'complete', payment_status: 'paid', mode: 'payment', amount_total: 4900, currency: 'krw', metadata: { locale, product: 'full_access' } };
  const response = await route.POST(request()); assert.equal(response.status, 200);
  const claim = await response.json(); assert.equal(claim.checkoutLocale, locale);
  assert.equal(claim.currency, 'KRW'); assert.equal(claim.value, 4900);
  const e = await purchaseComponent(claim, true);
  await e.pixel.trackXEventsOnce(e.element.props.eventIds, e.element.props.params);
  assert.equal(e.calls.length, 0, 'KRW must not send michi or any retired destination');
}
for (const change of [{ status: 'open' }, { payment_status: 'unpaid' }, { mode: 'subscription' }]) {
  stripeSession = { id: sessionId, status: 'complete', payment_status: 'paid', mode: 'payment', amount_total: 4900, currency: 'krw', metadata: { locale: 'ko', product: 'full_access' }, ...change };
  assert.equal((await route.POST(request())).status, 400);
}
assert.equal((await route.POST(request('invalid'))).status, 403);
const diagnosisSource = source('src/components/diagnosis/DiagnosisPageContent.tsx');
assert.match(diagnosisSource, /if \(res\.ok && typeof data\.userId === "string"\)\s*\{\s*markXDiagnosisSaved\(data\.userId, locale\)/);
console.log('Signed prepare route + Stripe verifier checks passed: trusted session locale, paid/complete/payment gate, actual KRW amount, invalid token, no database writes.');
