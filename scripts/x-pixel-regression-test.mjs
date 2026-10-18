// Offline only: the actual loader/helper run in a VM. No advertising endpoint,
// checkout, database or application API receives any request.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
function env({ code = helperSource, local = new Map(), locks, session = new Map() } = {}) {
  const calls = [];
  const window = { localStorage: storage(local), sessionStorage: storage(session),
    navigator: locks ? { locks } : {}, twq: (...args) => calls.push(args) };
  const pixel = moduleFrom(code, { "@/lib/x-pixel-config": config }, { window });
  return { calls, window, pixel, local, session };
}
const ids = ["rgg36", "rgob2", "rgskb", "rgtx5"];
const diagnosisIds = ["tw-rgg36-rgg9b", "tw-rgob2-rgobn", "tw-rgskb-rgski", "tw-rgtx5-rgu2v"];
const purchaseIds = ["tw-rgg36-rgg3b", "tw-rgob2-rgobj", "tw-rgskb-rgskd", "tw-rgtx5-rgtx9"];
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
assert.ok(source("src/app/layout.tsx").includes('import { X_PIXEL_SCRIPT } from "@/lib/x-pixel-config"'));
{
  const window = {}; let loads = 0;
  const document = { createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => loads++ } }] };
  const context = vm.createContext({ window, document });
  vm.runInContext(config.X_PIXEL_SCRIPT, context);
  assert.equal(loads, 1);
  assert.deepEqual(Array.from(window.twq.queue, (args) => Array.from(args)), ids.map((id) => ["config", id]));
  vm.runInContext(config.X_PIXEL_SCRIPT, context);
  assert.equal(loads, 1);
  // Preserve the pre-existing rgtx5-only guard.
  assert.deepEqual(Array.from(window.twq.queue, (args) => Array.from(args)), [...ids, ...ids.slice(0, 3)].map((id) => ["config", id]));
}
{
  const p = moduleFrom(helperSource, { "@/lib/x-pixel-config": config });
  assert.equal(p.trackX(diagnosisIds[0], {}), false);
  assert.equal(await p.trackXEventsOnce(diagnosisIds, params, true), false);
  assert.equal(p.wasXPurchaseSent(params.conversion_id), false);
}
{
  const e = env();
  assert.deepEqual(normalize(e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS), diagnosisIds);
  assert.deepEqual(normalize(e.pixel.xPurchaseEventIds("JPY")), purchaseIds);
  for (const currency of ["USD", "KRW", "THB", "IDR", "EUR"]) {
    assert.deepEqual(normalize(e.pixel.xPurchaseEventIds(currency)), purchaseIds.slice(1));
  }
  assert.equal(await send(e, true), false);
  assert.equal(e.calls.length, 0);
  for (const at of [Date.now() - 600001, Date.now() + 60000]) {
    marker(e, at); assert.equal(await send(e, true), false);
  }
  marker(e); assert.equal(await send(e, true), true);
  assert.deepEqual(normalize(e.calls), diagnosisIds.map((id) => ["event", id, {}]));
  assert.equal(e.session.has(e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id), false);
  await send(e, true); assert.equal(e.calls.length, 4);
  const reload = env({ local: e.local }); await send(reload, true);
  assert.equal(reload.calls.length, 0);
}
for (const currency of ["JPY", "USD", "KRW", "THB", "IDR", "EUR"]) {
  const e = env(); assert.equal(await send(e, false, currency), true);
  const wanted = currency === "JPY" ? purchaseIds : purchaseIds.slice(1);
  assert.deepEqual(normalize(e.calls), wanted.map((id) => ["event", id,
    id === purchaseIds[0] ? { ...params, currency } : {}]));
  assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), true);
  await send(e, false, currency); assert.equal(e.calls.length, wanted.length);
  const reload = env({ local: e.local }); await send(reload, false, currency);
  assert.equal(reload.calls.length, 0);
}
// Each retained destination can fail and retry independently.
for (const diagnosis of [false, true]) for (const failed of diagnosis ? diagnosisIds : purchaseIds) {
  const e = env(); if (diagnosis) marker(e);
  e.window.twq = (...args) => { if (args[1] === failed) throw Error("offline blocked"); e.calls.push(args); };
  assert.equal(await send(e, diagnosis), false);
  assert.equal(e.calls.length, 3);
  if (!diagnosis) assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = env({ local: e.local, session: e.session });
  assert.equal(await send(reload, diagnosis), true);
  assert.deepEqual(reload.calls.map((c) => c[1]), [failed]);
}
// Pre-cutover hand-offs must never be replayed.
for (const historical of [groupKey, sentKey("tw-rezdw-1436v3")]) {
  const e = env({ local: new Map([[historical, "1"]]) });
  assert.equal(await send(e), true); assert.equal(e.calls.length, 0);
}
{
  const e = env({ local: new Map([[sentKey("tw-rgtx5-rgtxe"), "1"]]) }); marker(e);
  assert.equal(await send(e, true), true);
  assert.deepEqual(e.calls.map((c) => c[1]), diagnosisIds.slice(0, 3));
}
for (const diagnosis of [false, true]) {
  const e = env(); if (diagnosis) marker(e);
  assert.equal(await send(e, diagnosis, "JPY", () => false), false);
  assert.equal(e.calls.length, 0);
}
{
  const e = env();
  for (const id of ["rg1zg", "rezdw", "rgi5k", "rgkns", "rgkqm", "rgm4u", "rgyo2", "rh5rd", "rh617"]) {
    assert.equal(e.pixel.trackX("tw-" + id + "-removed", {}), false);
  }
  assert.equal(e.calls.length, 0);
}
{
  const local = new Map(); let tail = Promise.resolve();
  const locks = { request: (_name, fn) => { const run = tail.then(fn); tail = run.catch(() => {}); return run; } };
  const a = env({ local, locks }), b = env({ local, locks });
  await Promise.all([send(a), send(b)]);
  assert.equal(a.calls.length + b.calls.length, 4);
}
{
  const e = env();
  for (const name of ["localStorage", "sessionStorage"]) Object.defineProperty(e.window, name, {
    get() { throw Error("offline storage denied"); },
  });
  assert.equal(await send(e, true), false);
  assert.equal(await send(e), true);
  await send(e); assert.equal(e.calls.length, 4);
}
let differentialCases = 0;
if (process.env.X_PIXEL_BASELINE_REF) {
  const oldCode = execFileSync("git", ["show", process.env.X_PIXEL_BASELINE_REF + ":src/lib/xPixel.ts"], { encoding: "utf8", cwd: root });
  for (const diagnosis of [false, true]) for (const currency of ["JPY", "USD", "KRW", "THB", "IDR"])
    for (const mode of ["fresh", "missing-marker", "expired", "cancelled", "prior-group", "prior-event", ...ids]) {
      const old = env({ code: oldCode }), current = env();
      for (const e of [old, current]) {
        if (diagnosis && mode !== "missing-marker") marker(e, Date.now() - (mode === "expired" ? 600001 : 0));
        if (mode === "prior-group") e.local.set(groupKey, "1");
        if (mode === "prior-event") e.local.set(sentKey(diagnosis ? diagnosisIds[0] : purchaseIds[0]), "1");
        if (ids.includes(mode)) e.window.twq = (...args) => {
          if (args[1].startsWith("tw-" + mode + "-")) throw Error("offline blocked");
          e.calls.push(args);
        };
        await send(e, diagnosis, currency, () => mode !== "cancelled");
      }
      const retained = (calls) => normalize(calls.filter((c) => /^tw-(rgg36|rgob2|rgskb|rgtx5)-/.test(c[1])));
      assert.deepEqual(retained(current.calls), retained(old.calls), diagnosis + "/" + currency + "/" + mode);
      differentialCases++;
    }
}
console.log("Offline X checks passed: 4 configs, exact event IDs/payloads, currencies, markers, historical dedupe, per-destination retries, reload, cross-tab and storage failures; " +
  differentialCases + " production-baseline comparisons. No external events sent.");

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
  assert.equal(e.calls.length, currency === "JPY" ? 4 : 3);

}
{
  const claim = { checkoutSessionId: "cs_live_offline_discount", value: 321, currency: "JPY" };
  const e = await purchaseComponent(claim, true);
  await e.pixel.trackXEventsOnce(e.element.props.eventIds, e.element.props.params);
  assert.deepEqual(normalize(e.calls[0]), ["event", "tw-rgg36-rgg3b", {
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
{
  const e = await purchaseComponent({ checkoutSessionId: "cs_live_offline", value: 499, currency: "JPY" }, true, false);
  assert.equal(e.element, null, "Failed payment verification must not mount X purchase tracking");
  assert.equal(e.calls.length, 0);
}

console.log("Actual purchase component checks passed: verified live settlements only, actual amounts/currencies, X after Meta/TikTok ack, invalid/test/failed claims excluded; all fetches stubbed.");
