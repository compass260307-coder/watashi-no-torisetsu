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
  assert.equal(script.match(/https:\/\/static\.ads-twitter\.com\/uwt\.js/g).length, 1);
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
    ["config", "rg1zg"], ["config", "rezdw"], ["config", "rgg36"], ["config", "rgi5k"], ["config", "rgkns"], ["config", "rgkqm"], ["config", "rgm4u"], ["config", "rgob2"], ["config", "rgskb"], ["config", "rgtx5"],
  ]);
  vm.runInContext(script.replaceAll(";twq(", ";window.twq("), context);
  assert.equal(loaders, 1, "Replaying the inline script must not load uwt.js twice");
  assert.equal(Array.from(window.twq.queue).filter(args => args[0] === "config" && args[1] === "rgtx5").length, 1, "Replaying the script must not configure rgtx5 twice");
  const existingCalls = [];
  vm.runInContext(script.replaceAll(";twq(", ";window.twq("), vm.createContext({
    window: { twq: (...args) => existingCalls.push(args) }, document,
  }));
  assert.equal(loaders, 1, "An existing twq must reuse its loader");
  assert.deepEqual(normalize(existingCalls), [
    ["config", "rg1zg"], ["config", "rezdw"], ["config", "rgg36"], ["config", "rgi5k"], ["config", "rgkns"], ["config", "rgkqm"], ["config", "rgm4u"], ["config", "rgob2"], ["config", "rgskb"], ["config", "rgtx5"],
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
  assert.deepEqual(normalize(e.calls[2]), ["event", "tw-rgg36-rgg9b", {}]);
  assert.deepEqual(normalize(e.calls.slice(0, 2).map((call) => call[2])), [params, params], "Existing diagnosis payloads are unchanged");
  assert.deepEqual(normalize(e.calls[3]), ["event", "tw-rgi5k-rgi5r", params]);
  assert.deepEqual(normalize(e.calls[4]), ["event", "tw-rgkns-rgkoe", {}]);
  assert.deepEqual(normalize(e.calls[5]), ["event", "tw-rgkqm-rgkr4", {}]);
  assert.deepEqual(normalize(e.calls[6]), ["event", "tw-rgm4u-rgm58", {}]);
  assert.deepEqual(normalize(e.calls[7]), ["event", "tw-rgob2-rgobn", {}]);
  assert.deepEqual(normalize(e.calls[8]), ["event", "tw-rgskb-rgski", {}]);
  assert.equal(e.window.sessionStorage.getItem(marker), null);
  await e.pixel.trackXEventsOnce(ids, params, true);
  assert.deepEqual(normalize(e.calls[9]), ["event", "tw-rgtx5-rgtxe", {}]);
  assert.equal(e.calls.length, 10, "Remount/Strict Mode must not repeat any tag");
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
  assert.equal(e.calls.length, 9);
  assert.ok(e.window.sessionStorage.getItem(marker));
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(reload.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, params, true), true);
  assert.deepEqual(normalize(reload.calls), [["event", "tw-rgg36-rgg9b", {}]], "Reload retries only the unsent new diagnosis tag");
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
  assert.equal(first.calls.length + second.calls.length, 10);
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
  assert.deepEqual(Array.from(ids), [e.pixel.X_ADDITIONAL_PURCHASE_EVENT_ID, e.pixel.X_RGI5K_PURCHASE_EVENT_ID, e.pixel.X_RGKNS_PURCHASE_EVENT_ID, e.pixel.X_RGKQM_PURCHASE_EVENT_ID, e.pixel.X_RGM4U_PURCHASE_EVENT_ID, e.pixel.X_RGOB2_PURCHASE_EVENT_ID, e.pixel.X_RGSKB_PURCHASE_EVENT_ID, e.pixel.X_RGTX5_PURCHASE_EVENT_ID]);
  await e.pixel.trackXEventsOnce(ids, params);
  await e.pixel.trackXEventsOnce(ids, params);
  assert.equal(e.calls.length, 8, "In-memory dedupe still covers remounts");
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, params, true), false);
}

const meta = load("src/lib/meta-purchase.ts");
// Keep completed purchases suppressed when correcting the rgi5k event mapping.
{
  const e = environment();
  const params = { conversion_id: "offline-rgi5k-mapping-cutover", value: 499, currency: "JPY" };
  for (const id of ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5r"]) {
    e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  }
  e.local.set(`wt_x_purchase_sent_v1:${params.conversion_id}`, "1");
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), params), true);
  assert.equal(e.calls.length, 0, "Correcting the ID must not replay a completed purchase");
}
// Replacing the event must not resend an old payment under the new event ID.
for (const marker of ["group", "previous-event"]) {
  const e = environment();
  const params = { conversion_id: "offline-cutover", value: 499, currency: "JPY" };
  const oldKey = `wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`;
  e.local.set(marker === "group" ? `wt_x_purchase_sent_v1:${params.conversion_id}` : oldKey, "1");
  e.local.set(`wt_x_sent_v1:${e.pixel.X_PURCHASE_EVENT_ID}:${params.conversion_id}`, "1");
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), params), true);
  assert.equal(e.calls.length, 0, "Old hand-offs suppress new purchase destinations on reload");
}
{
  const e = environment();
  const params = { conversion_id: "offline-partial-cutover", value: 499, currency: "JPY" };
  e.local.set(`wt_x_sent_v1:tw-rezdw-1436v3:${params.conversion_id}`, "1");
  await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), params);
  assert.deepEqual(e.calls.map((call) => call[1]), [e.pixel.X_PURCHASE_EVENT_ID], "Only the unsent original account is retried");
  const fresh = { ...params, conversion_id: "offline-new-payment" };
  await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), fresh);
  assert.deepEqual(e.calls.slice(1).map((call) => call[1]), ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu", "tw-rgkqm-rgkr6", "tw-rgm4u-rgm4y", "tw-rgob2-rgobj", "tw-rgskb-rgskd", "tw-rgtx5-rgtx9"]);
  assert.equal(e.calls.some((call) => call[1] === "tw-rezdw-1436v3"), false);
}
for (const diagnosis of [true, false]) {
  const e = environment();
  const effects = []; const timers = new Map(); let nextTimer = 0;
  const component = load("src/components/XTrack.tsx", {
    react: { useEffect: (effect) => effects.push(effect) },
    "@/lib/xPixel": e.pixel,
  }, {
    setTimeout: (action) => { timers.set(++nextTimer, action); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  });
  const params = { conversion_id: `offline-react-effect-${diagnosis}`, value: 499, currency: "JPY" };
  if (diagnosis) e.window.sessionStorage.setItem(e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id, String(Date.now()));
  const props = {
    eventIds: diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY"),
    params,
    requireDiagnosisCompletion: diagnosis,
  };
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
  assert.equal(e.calls.length, 10, "Effect replay/remount must send only one event per account");
  assert.deepEqual(normalize(e.calls.at(-5)), ["event", diagnosis ? "tw-rgkqm-rgkr4" : "tw-rgkqm-rgkr6", {}]);
  assert.deepEqual(normalize(e.calls.at(-4)), ["event", diagnosis ? "tw-rgm4u-rgm58" : "tw-rgm4u-rgm4y", {}]);
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
  assert.deepEqual(normalize(e.calls.slice(0, 3).map((call) => call[2])), [params, params, params], "Existing purchase payloads are unchanged");
  const reload = environment({ local: e.local });
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params), true);
  assert.deepEqual(normalize(reload.calls), [["event", "tw-rgg36-rgg3b", params]], "Reload retries only the new purchase tag, using the actual amount");
  await reload.pixel.trackXEventsOnce(ids, params);
  assert.equal(reload.calls.length, 1);
}
// rgi5k failures must not repeat any other account events.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgi5k-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? e.pixel.X_RGI5K_DIAGNOSIS_EVENT_ID : e.pixel.X_RGI5K_PURCHASE_EVENT_ID;
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.equal(e.calls.length, 9, "Existing events succeed even if rgi5k fails");
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, params]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Only the failed new destination is retried once");
}
// rgkns retries only its failed destination, retaining the original completion
// marker/group guard until the new empty-payload event is handed to twq.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgkns-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? "tw-rgkns-rgkoe" : "tw-rgkns-rgknu";
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids).filter((id) => id !== newId));
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, {}]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Reload/remount must not replay rgkns or any existing event");
}
// Adding an account must not turn a historical result view into a completion.
{
  const e = environment();
  const params = { conversion_id: "offline-rgkns-old-result" };
  for (const id of ["tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r"]) {
    e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  }
  assert.equal(await e.pixel.trackXEventsOnce(e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, params, true), false);
  assert.equal(e.calls.length, 0, "No new diagnosis tag without a fresh saved-completion marker");
}
// rgkqm failures must not repeat any other account events.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgkqm-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? "tw-rgkqm-rgkr4" : "tw-rgkqm-rgkr6";
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.equal(e.calls.length, 9);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids).filter((id) => id !== newId));
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, {}]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Only the failed rgkqm destination is retried once");
}
// Adding rgkqm must not replay a conversion already completed by all five accounts.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgkqm-existing-conversion-${diagnosis}`, value: 499, currency: "JPY" };
  const previousIds = diagnosis
    ? ["tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r", "tw-rgkns-rgkoe"]
    : ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu"];
  for (const id of previousIds) e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  if (!diagnosis) e.local.set(`wt_x_purchase_sent_v1:${params.conversion_id}`, "1");
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), !diagnosis);
  assert.equal(e.calls.length, 0, "No new event on historical result/purchase views");
}
// rgm4u failures must not repeat any other account events.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgm4u-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? "tw-rgm4u-rgm58" : "tw-rgm4u-rgm4y";
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.equal(e.calls.length, 9);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids).filter((id) => id !== newId));
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, {}]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Only the failed rgm4u destination is retried once");
}
// Adding rgm4u must not replay a conversion already completed by all six accounts.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgm4u-existing-conversion-${diagnosis}`, value: 499, currency: "JPY" };
  const previousIds = diagnosis
    ? ["tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r", "tw-rgkns-rgkoe", "tw-rgkqm-rgkr4"]
    : ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu", "tw-rgkqm-rgkr6"];
  for (const id of previousIds) e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  if (!diagnosis) e.local.set(`wt_x_purchase_sent_v1:${params.conversion_id}`, "1");
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), !diagnosis);
  assert.equal(e.calls.length, 0, "No new event on historical result/purchase views");
}
// rgob2 failures must not repeat any other account events.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgob2-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? "tw-rgob2-rgobn" : "tw-rgob2-rgobj";
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.equal(e.calls.length, 9);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids).filter((id) => id !== newId));
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, {}]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Only the failed rgob2 destination is retried once");
}
// Adding rgob2 must not replay a conversion already completed by all seven accounts.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgob2-existing-conversion-${diagnosis}`, value: 499, currency: "JPY" };
  const previousIds = diagnosis
    ? ["tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r", "tw-rgkns-rgkoe", "tw-rgkqm-rgkr4", "tw-rgm4u-rgm58"]
    : ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu", "tw-rgkqm-rgkr6", "tw-rgm4u-rgm4y"];
  for (const id of previousIds) e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  if (!diagnosis) e.local.set(`wt_x_purchase_sent_v1:${params.conversion_id}`, "1");
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), !diagnosis);
  assert.equal(e.calls.length, 0, "No new event on historical result/purchase views");
}
// rgskb failures must not repeat any other account events.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgskb-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? "tw-rgskb-rgski" : "tw-rgskb-rgskd";
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.equal(e.calls.length, 9);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids).filter((id) => id !== newId));
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, {}]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Only the failed rgskb destination is retried once");
}
// Adding rgskb must not replay a conversion already completed by all eight accounts.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgskb-existing-conversion-${diagnosis}`, value: 499, currency: "JPY" };
  const previousIds = diagnosis
    ? ["tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r", "tw-rgkns-rgkoe", "tw-rgkqm-rgkr4", "tw-rgm4u-rgm58", "tw-rgob2-rgobn"]
    : ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu", "tw-rgkqm-rgkr6", "tw-rgm4u-rgm4y", "tw-rgob2-rgobj"];
  for (const id of previousIds) e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  if (!diagnosis) e.local.set(`wt_x_purchase_sent_v1:${params.conversion_id}`, "1");
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), !diagnosis);
  assert.equal(e.calls.length, 0, "No new event on historical result/purchase views");
}
// rgtx5 failures must not repeat any other account events.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgtx5-retry-${diagnosis}`, value: 499, currency: "JPY" };
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  const newId = diagnosis ? "tw-rgtx5-rgtxe" : "tw-rgtx5-rgtx9";
  const marker = e.pixel.X_DIAGNOSIS_PENDING_PREFIX + params.conversion_id;
  if (diagnosis) e.window.sessionStorage.setItem(marker, String(Date.now()));
  e.window.twq = (...args) => {
    if (args[1] === newId) throw Error("blocked");
    e.calls.push(args);
  };
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), false);
  assert.equal(e.calls.length, 9);
  assert.deepEqual(e.calls.map((call) => call[1]), Array.from(ids).filter((id) => id !== newId));
  if (diagnosis) assert.ok(e.window.sessionStorage.getItem(marker));
  else assert.equal(e.pixel.wasXPurchaseSent(params.conversion_id), false);
  const reload = environment({ local: e.local });
  reload.window.sessionStorage = e.window.sessionStorage;
  assert.equal(await reload.pixel.trackXEventsOnce(ids, params, diagnosis), true);
  assert.deepEqual(normalize(reload.calls), [["event", newId, {}]]);
  await reload.pixel.trackXEventsOnce(ids, params, diagnosis);
  assert.equal(reload.calls.length, 1, "Only the failed rgtx5 destination is retried once");
}
// Adding rgtx5 must not replay a conversion already completed by all nine accounts.
for (const diagnosis of [true, false]) {
  const e = environment();
  const params = { conversion_id: `offline-rgtx5-existing-conversion-${diagnosis}`, value: 499, currency: "JPY" };
  const previousIds = diagnosis
    ? ["tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r", "tw-rgkns-rgkoe", "tw-rgkqm-rgkr4", "tw-rgm4u-rgm58", "tw-rgob2-rgobn", "tw-rgskb-rgski"]
    : ["tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu", "tw-rgkqm-rgkr6", "tw-rgm4u-rgm4y", "tw-rgob2-rgobj", "tw-rgskb-rgskd"];
  for (const id of previousIds) e.local.set(`wt_x_sent_v1:${id}:${params.conversion_id}`, "1");
  if (!diagnosis) e.local.set(`wt_x_purchase_sent_v1:${params.conversion_id}`, "1");
  const ids = diagnosis ? e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS : e.pixel.xPurchaseEventIds("JPY");
  assert.equal(await e.pixel.trackXEventsOnce(ids, params, diagnosis), !diagnosis);
  assert.equal(e.calls.length, 0, "No new event on historical result/purchase views");
}
// Actual loader + event helper: configs precede events while uwt.js is delayed.
{
  const e = environment();
  delete e.window.twq;
  let loaders = 0;
  const script = source("src/app/layout.tsx").match(/const X_PIXEL_SCRIPT = `([^`]+)`;/)[1];
  const document = {
    createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore: () => { loaders++; } } }],
  };
  vm.runInNewContext(script.replaceAll(";twq(", ";window.twq("), { window: e.window, document });
  const diagnosis = { conversion_id: "offline-queued-diagnosis" };
  e.window.sessionStorage.setItem(e.pixel.X_DIAGNOSIS_PENDING_PREFIX + diagnosis.conversion_id, String(Date.now()));
  const purchase = { conversion_id: "offline-queued-purchase", value: 499, currency: "JPY" };
  const send = async () => {
    await e.pixel.trackXEventsOnce(e.pixel.X_DIAGNOSIS_COMPLETE_EVENT_IDS, diagnosis, true);
    await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), purchase);
  };
  await send();
  await send();
  const queued = Array.from(e.window.twq.queue, (args) => Array.from(args));
  assert.deepEqual(queued.slice(0, 10), [
    ["config", "rg1zg"], ["config", "rezdw"], ["config", "rgg36"], ["config", "rgi5k"], ["config", "rgkns"], ["config", "rgkqm"], ["config", "rgm4u"], ["config", "rgob2"], ["config", "rgskb"], ["config", "rgtx5"],
  ]);
  assert.deepEqual(queued.slice(10).map((call) => call[1]), [
    "tw-rg1zg-rg1zv", "tw-rezdw-reze3", "tw-rgg36-rgg9b", "tw-rgi5k-rgi5r", "tw-rgkns-rgkoe", "tw-rgkqm-rgkr4", "tw-rgm4u-rgm58", "tw-rgob2-rgobn", "tw-rgskb-rgski", "tw-rgtx5-rgtxe",
    "tw-rg1zg-rg1zz", "tw-rezdw-rgdz4", "tw-rgg36-rgg3b", "tw-rgi5k-rgi5m", "tw-rgkns-rgknu", "tw-rgkqm-rgkr6", "tw-rgm4u-rgm4y", "tw-rgob2-rgobj", "tw-rgskb-rgskd", "tw-rgtx5-rgtx9",
  ]);
  assert.deepEqual(normalize(queued.filter((call) => call[1] === "tw-rgkqm-rgkr4" || call[1] === "tw-rgkqm-rgkr6")), [
    ["event", "tw-rgkqm-rgkr4", {}], ["event", "tw-rgkqm-rgkr6", {}],
  ]);
  assert.deepEqual(normalize(queued.filter((call) => call[1] === "tw-rgm4u-rgm58" || call[1] === "tw-rgm4u-rgm4y")), [
    ["event", "tw-rgm4u-rgm58", {}], ["event", "tw-rgm4u-rgm4y", {}],
  ]);
  assert.deepEqual(normalize(queued.filter((call) => call[1] === "tw-rgob2-rgobn" || call[1] === "tw-rgob2-rgobj")), [
    ["event", "tw-rgob2-rgobn", {}], ["event", "tw-rgob2-rgobj", {}],
  ]);
  assert.deepEqual(normalize(queued.filter((call) => call[1] === "tw-rgskb-rgski" || call[1] === "tw-rgskb-rgskd")), [
    ["event", "tw-rgskb-rgski", {}], ["event", "tw-rgskb-rgskd", {}],
  ]);
  assert.deepEqual(normalize(queued.filter(call => call[1] === "tw-rgtx5-rgtxe" || call[1] === "tw-rgtx5-rgtx9")), [
    ["event", "tw-rgtx5-rgtxe", {}], ["event", "tw-rgtx5-rgtx9", {}],
  ]);
  assert.equal(loaders, 1);
  // Simulate the library consuming its FIFO queue, then switching to live firing.
  e.window.twq.exe = (...args) => e.calls.push(args);
  for (const args of queued) e.window.twq.exe(...args);
  e.window.twq.queue.length = 0;
  await send();
  assert.equal(e.calls.length, 30, "No replay after the queued events have been consumed");
  const fresh = { ...purchase, conversion_id: "offline-ready-purchase" };
  await e.pixel.trackXEventsOnce(e.pixel.xPurchaseEventIds("JPY"), fresh);
  assert.deepEqual(normalize(e.calls.slice(-7)), [["event", "tw-rgi5k-rgi5m", fresh], ["event", "tw-rgkns-rgknu", {}], ["event", "tw-rgkqm-rgkr6", {}], ["event", "tw-rgm4u-rgm4y", {}], ["event", "tw-rgob2-rgobj", {}], ["event", "tw-rgskb-rgskd", {}], ["event", "tw-rgtx5-rgtx9", {}]]);
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
  assert.equal(e.calls.length, currency === "JPY" ? 10 : 8);
  assert.deepEqual(normalize(e.calls.at(-6)), ["event", "tw-rgkns-rgknu", {}]);
  assert.deepEqual(normalize(e.calls.at(-5)), ["event", "tw-rgkqm-rgkr6", {}]);
  assert.deepEqual(normalize(e.calls.at(-4)), ["event", "tw-rgm4u-rgm4y", {}]);
  assert.deepEqual(normalize(e.calls.at(-3)), ["event", "tw-rgob2-rgobj", {}]);
  assert.deepEqual(normalize(e.calls.at(-2)), ["event", "tw-rgskb-rgskd", {}]);
  assert.deepEqual(normalize(e.calls.at(-1)), ["event", "tw-rgtx5-rgtx9", {}]);
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
