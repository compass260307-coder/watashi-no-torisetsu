// No network: exercise the production Proxy with controlled HEAD results.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as recovery from "../src/lib/static-asset-recovery.mjs";

function load(path, modules = {}, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const exports = {};
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert(name in modules, `Unexpected dependency ${name}`);
    return modules[name];
  }, ...globals });
  return exports;
}
const disclosure = load("../src/lib/checkout-commerce-disclosure.ts", {}, { URL });
let status = 404, fail = false;
const probes = [];
const { proxy } = load("../src/proxy.ts", {
  "next/server": { NextResponse },
  "@/lib/static-asset-recovery.mjs": recovery,
  "@/lib/checkout-commerce-disclosure": disclosure,
}, { Headers, AbortSignal, fetch: async (url, options) => {
  probes.push({ url, options });
  if (fail) throw new Error("offline");
  return { status };
} });
const asset = "https://example.test/_next/static/chunks/old-runtime.js?dpl=old";
let response = await proxy(new NextRequest(asset, { headers: { cookie: "preview=offline" } }));
assert.equal(response.status, 200);
assert.equal(await response.text(), recovery.MISSING_STATIC_ASSET_BOOTSTRAP);
assert.match(response.headers.get("cache-control"), /no-store/);
assert.equal(probes.length, 1);
assert.equal(probes[0].url, asset);
assert.equal(probes[0].options.method, "HEAD");
assert.equal(probes[0].options.headers.get("x-wt-static-asset-probe"), "1");
assert.equal(probes[0].options.headers.get("cookie"), "preview=offline");
for (const code of [200, 401, 403, 429, 500, 503]) {
  status = code;
  response = await proxy(new NextRequest(asset));
  assert.equal(response.headers.get("x-middleware-next"), "1");
}
fail = true;
assert.equal((await proxy(new NextRequest(asset))).headers.get("x-middleware-next"), "1");
fail = false;
const before = probes.length;
for (const request of [
  new NextRequest(asset, { method: "HEAD" }),
  new NextRequest(asset, { headers: { "x-wt-static-asset-probe": "1" } }),
  new NextRequest("https://example.test/_next/static/immutable/chunks/current.js"),
]) assert.equal((await proxy(request)).headers.get("x-middleware-next"), "1");
assert.equal(probes.length, before, "No recursive probes or overhead on current immutable assets");
response = await proxy(new NextRequest("https://example.test/legal/commerce", {
  headers: { cookie: "wt_checkout_commerce_locale=ko", referer: "https://checkout.stripe.com/" },
}));
assert.equal(response.status, 307);
assert.equal(new URL(response.headers.get("location")).pathname, "/ko/legal/commerce");
console.log("Static asset Proxy passed: 404 recovery, existing/protected/error assets preserved, bounded probe, immutable bypass, Korean commerce redirect.");
