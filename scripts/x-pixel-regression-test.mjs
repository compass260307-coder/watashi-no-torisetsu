// Entirely offline: every advertising call, fetch and Stripe/DB dependency is
// replaced with an in-memory stub. No order or real conversion is created.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");
function load(path, dependencies = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(source(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, {
    exports, console, ...globals,
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      if (name.startsWith("node:")) return require(name);
      throw new Error(`Unmocked dependency: ${name}`);
    },
  }, { filename: path });
  return exports;
}
const storage = (map = new Map()) => ({
  getItem: (key) => map.get(key) ?? null,
  setItem: (key, value) => map.set(key, value),
  removeItem: (key) => map.delete(key),
});
function environment({ local = new Map(), locks } = {}) {
  const calls = [];
  const window = {
    sessionStorage: storage(), localStorage: storage(local),
    navigator: locks ? { locks } : {},
    twq: (...args) => calls.push(args),
  };
  const pixel = load("src/lib/xPixel.ts", {}, { window });
  return { window, pixel, calls, local };
}
const normalize = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

// The real inline loader is evaluated with a fake DOM, never downloaded.
{
  const script = source("src/app/layout.tsx").match(/const X_PIXEL_SCRIPT = `([^`]+)`;/)[1];
  let loaders = 0;
  const window = {};
  const document = {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => { loaders++; } } }],
  };
  const context = vm.createContext({ window, document });
  vm.runInContext(script.replaceAll(";twq(", ";window.twq("), context);
  assert.equal(loaders, 1);
  assert.deepEqual(Array.from(window.twq.queue, (args) => Array.from(args)), [
    ["config", "rg1zg"], ["config", "rezdw"], ["config", "rgg36"],
  ]);
  vm.runInContext(script.replaceAll(";twq(", ";window.twq("), context);
  assert.equal(loaders, 1, "Replaying the inline script must not load uwt.js twice");
  const existingCalls = [];
  vm.runInContext(script.replaceAll(";twq(", ";window.twq("), vm.createContext({
    window: { twq: (...args) => existingCalls.push(args) }, document,
  }));
  assert.equal(loaders, 1, "An existing twq must reuse its loader");
  assert.deepEqual(normalize(existingCalls), [
    ["config", "rg1zg"], ["config", "rezdw"], ["config", "rgg36"],
  ]);
}
{
  const ssr = load("src/lib/xPixel.ts");
  assert.equal(ssr.trackX(ssr.X_RGG36_DIAGNOSIS_EVENT_ID, {}), false);
  assert.equal(await ssr.trackXEventsOnce(ssr.X_DIAGNOSIS_COMPLETE_EVENT_IDS, { conversion_id: "offline-ssr" }, true), false);
  assert.equal(ssr.wasXPurchaseSent("offline-ssr"), false);
}
{
  const e = environment();
  const ids = e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS;
  const params = { conversion_id: "offline-diagnosis" };
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, true), false);
  assert.equal(e.calls.length, 0, "A result view alone is not a completion");
  for (const timestamp of [Date.now() - 11 * 60_000, Date.now() + 60_000]) {
    e.window.sessionStorage.setItem(marker, String(timestamp));
    assert.equal(await e.pixel.trackXEventsOnce(ids, params, true), false);
  }
  e.window.sessionStorage.setItem(marker, String(Date.now()));
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, true), true);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids));
  assert.deepEqual(normalize(e.calls[2]), ["event", "tw-rgg36-rgg37", {}]);
  assert.deepEqual(normalize(e.calls.slice(0, 2).map((call) => call[2])), [params, params], "Existing diagnosis payloads are unchanged");
  assert.equal(e.window.sessionStorage.getItem(marker), null);
  await e.pixel.trackXEventsOnce(ids, params, true);
  assert.equal(e.calls.length, 3, "Remount/Strict Mode must not repeat any tag");
  const reload = environment({ local: e.local });
  await reload.pixel.trackXEventsOnce(ids, params, true);
  assert.equal(reload.calls.length, 0, "Reload must use persistent per-event keys");
}
{
  const e = environment();
  const ids = e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS;
  const params = { conversion_id: "offline-retry" };
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  e.window.sessionStorage.setItem(marker, String(Date.now()));
  let failAdditional = true;
  e.window.twq = (...args) => {
    if (args[1] === e.pixel.X_ADDITIONAL_DIAGNOSIS_EVENT_ID && failAdditional) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, true), false);
  assert.ok(e.window.sessionStorage.getItem(marker), "Keep marker until all destinations succeed");
  failAdditional = false;
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, true), true);
  assert.deepEqual(e.calls.map((call) => call[1]).sort(), Array.from(ids).sort());
}
{
  const e = environment();
  const params = { conversion_id: "offline-new-diagnosis-retry" };
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === e.pixel.X_RGG36_DIAGNOSIS_EVENT_ID) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, params, true), false);
  assert.equal(e.calls.length, 2);
  assert.ok(e.window.sessionStorage.getItem(marker));
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(reload.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, params, true), true);
  assert.deepEqual(normalize(reload.calls), [["event", "tw-rgg36-rgg37", {}]], "Reload retries only the unsent new diagnosis tag");
}
{
  const e = environment();
  const id = e.pixel.X_PURCHASE_EVENT_ID;
  const params = { conversion_id: "offline-loader", value: 499, currency: "JPY" };
  delete e.window.twq;
  assert.equal(await e.pixel.trackXEventsOnce([id], params), false);
  e.window.twq = (...args) => e.calls.push(args);
  assert.equal(await e.pixel.trackXEventsOnce([id], params), true);
  assert.equal(e.calls.length, 1, "Missing loader must not prematurely mark the event sent");
}
{
  // Two independent module instances represent two tabs sharing localStorage.
  const local = new Map();
  let queue = Promise.resolve();
  const locks = { request: (_name, action) => {
    const result = queue.then(action); queue = result.catch(() => {}); return result;
  } };
  const first = environment({ local, locks });
  const second = environment({ local, locks });
  const params = { conversion_id: "offline-two-tabs", value: 499, currency: "JPY" };
  const ids = first.pixel.xPurchaseEventIds(params.currency);
  await Promise.all([
    first.pixel.trackXEventsOnce(ids, params), second.pixel.trackXEventsOnce(ids, params),
  ]);
  assert.equal(first.calls.length + second.calls.length, 3);
  assert.equal(first.pixel.wasXPurchaseSent(params.conversion_id), true);
  assert.equal(second.pixel.wasXPurchaseSent(params.conversion_id), true);
}
{
  const e = environment();
  const blockedStorage = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } };
  e.window.localStorage = blockedStorage;
  e.window.sessionStorage = blockedStorage;
  const params = { conversion_id: "offline-no-storage", value: 4.99, currency: "USD" };
  const ids = e.pixel.xPurchaseEventIds(params.currency);
  assert.deepEqual(Array.from(ids), [e.pixel.X_ADDITIONAL_PURCHASE_EVENT_ID]);
  await e.pixel.trackXEventsOnce(ids, params);
  await e.pixel.trackXEventsOnce(ids, params);
  assert.equal(e.calls.length, 1, "In-memory dedupe still covers remounts");
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, params, true), false);
}

const meta = load("src/lib/meta-purchase.ts");
// Replacing the event must not resend an old payment under the new event ID.
for (const marker of ["group", "previous-event"]) {
  const e = environment();
  const params = { conversion_id: "offline-cutover", value: 499, currency: "JPY" };
  const oldKey = `wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`;
  e.local.set(marker === "group" ? `wt_x_purchase_sent_v1:${params.conversion_id}` : oldKey, "1");
  e.local.set(`wt_x_sent_v1:${e.pixel.X_PURCHASE_EVENT_ID}:${params.conversion_id}`, "1");
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), params), true);
  assert.equal(e.calls.length, 0, "Old hand-offs suppress both purchase destinations on reload");
}
{
  const e = environment();
  const params = { conversion_id: "offline-partial-cutover", value: 499, currency: "JPY" };
  e.local.set(`wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`, "1");
  await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), params);
  assert.deepEqual(e.calls.map((call) => call[1]), [e.pixel.X_PURCHASE_EVENT_ID], "Only the unsent original account is retried");
  const fresh = { ...params, conversion_id: "offline-new-payment" };
  await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), fresh);
  assert.deepEqual(e.calls.slice(1).map((call) => call[1]), ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b"]);
  assert.equal(e.calls.some((call) => call[1] === "tw-rezdw-1436v3"), false);
}
{
  const e = environment();
  const effects = []; const timers = new Map(); let nextTimer = 0;
  const component = load("src/components/XTrack.tsx", {
    react: { useEffect: (effect) => effects.push(effect) },
    "@/lib/xPixel": e.pixel,
  }, {
    setTimeout: (action) => { timers.set(++nextTimer, action); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  });
  const params = { conversion_id: "offline-react-effect", value: 499, currency: "JPY" };
  const props = { eventIds: e.pixel.xPurchaseEventIds("JPY"), params };
  delete e.window.twq;
  component.XTrack(props);
  const cleanup = effects.shift()();
  await flush();
  assert.equal(timers.size, 1, "Retry a loader that is not available yet");
  cleanup();
  assert.equal(timers.size, 0, "Unmount cancels the retry");
  e.window.twq = (...args) => e.calls.push(args);
  for (let i = 0; i < 2; i++) {
    component.XTrack(props);
    const unmount = effects.shift()();
    await flush();
    unmount();
  }
  assert.equal(e.calls.length, 3, "Effect replay/remount must send only one event per account");
}
{
  const e = environment();
  const params = { conversion_id: "offline-new-purchase-retry", value: 1234, currency: "JPY" };
  const ids = e.pixel.xPurchaseEventIds(params.currency);
  e.window.twq = (...args) => {
    if (args[1] === e.pixel.X_RGG36_PURCHASE_EVENT_ID) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params), false);
  assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false, "Do not complete the purchase group before the new tag succeeds");
  assert.deepEqual(normalize(e.calls.map((call) => call[2])), [params, params], "Existing purchase payloads are unchanged");
  const reload = environment({ local: e.local });
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params), true);
  assert.deepEqual(normalize(reload.calls), [["event", "tw-rgg36-rgg3b", params]], "Reload retries only the new purchase tag, using the actual amount");
  await reload.pixel.trackXEventsOnce(ids, params);
  assert.equal(reload.calls.length, 1);
}
// Exercise the actual prepare route with an in-memory verified Stripe session.
async function preparedClaim(currency, amount, confirmed = true) {
  const session = { id: "cs_live_offline", product: "full_access", locale: "ja", amountTotal: amount, currency };
  const api = load("src/app/api/checkout/meta-purchase/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
    "@/lib/api-security": { readJsonObject: async () => ({ ok: true, value: { checkout_session_id: session.id, claim_token: "offline", action: "prepare" } }), consumeRateLimit: async () => ({ allowed: true }) },
    "@/lib/origin-check": { checkOrigin: () => ({ ok: true }) },
    "@/lib/meta-purchase": meta,
    "@/lib/paid-checkout-session": { isCheckoutSessionId: meta.isCheckoutSessionId, verifyMetaPurchaseClaimToken: () => true, verifyPaidMetaPurchaseCheckoutSession: async () => confirmed ? session : null },
    "@/lib/supabase-server": { supabaseAdmin: { from: () => { throw Error("prepare must not write to DB"); } } },
  });
  return api.POST({});
}
for (const [currency, minor, value] of [["jpy", 499, 499], ["jpy", 1234, 1234], ["krw", 4900, 4900], ["usd", 499, 4.99], ["idr", 4900000, 49000], ["thb", 9900, 99]]) {
  const result = await preparedClaim(currency, minor);
  assert.equal(result.status, 200);
  assert.equal(result.body.value, value);
  assert.equal(result.body.currency, currency.toUpperCase());
}
assert.equal((await preparedClaim("jpy", 499, false)).status, 400);

// Exercise the real purchase component with stubbed hooks and fetch. The JSX
// runtime returns descriptors; it never mounts a tag or executes an ad script.
async function purchaseComponent(claim, alreadySent = false) {
  const e = environment();
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
      return { ok: true, json: async () => claim };
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
  assert.equal(e.calls.length, currency === "JPY" ? 3 : 1);
}
{
  const claim = { checkoutSessionId: "cs_live_offline_discount", value: 321, currency: "JPY" };
  const e = await purchaseComponent(claim, true);
  await e.pixel.trackXEventsOnce(e.element.props.eventIds, e.element.props.params);
  assert.deepEqual(normalize(e.calls[2]), ["event", "tw-rgg36-rgg3b", {
    conversion_id: claim.checkoutSessionId, value: 321, currency: "JPY",
  }], "The new purchase tag receives the verified settlement amount, not a fixed catalog price");
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
console.log("X pixel offline regression checks passed; no external requests or conversion events sent.");
