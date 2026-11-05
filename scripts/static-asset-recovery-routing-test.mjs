// Run against a local production build: STATIC_RECOVERY_BASE_URL=http://127.0.0.1:3187 node scripts/static-asset-recovery-routing-test.mjs
import assert from "node:assert/strict";

const base = new URL(process.env.STATIC_RECOVERY_BASE_URL ?? "http://127.0.0.1:3187");
assert(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname), "Local server only");
for (const path of ["/_next/static/chunks/missing-legacy-checkout.js", "/_next/static/immutable/chunks/missing-runtime.js"]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/javascript/);
  for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) {
    assert.match(response.headers.get(header), /no-store/);
  }
  assert((await response.text()).includes("window.__wtRecoverMissingAssetV2();"));
  const probe = await fetch(new URL(path, base), { method: "HEAD" });
  assert.equal(probe.status, 404);
  assert.equal(await probe.text(), "");
}
const html = await (await fetch(new URL("/diagnosis", base))).text();
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
assert(scripts.length > 0);
for (const path of scripts) {
  const url = new URL(path, base);
  assert.equal(url.origin, base.origin);
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert(!(await response.text()).endsWith("window.__wtRecoverMissingAssetV2();\n"));
}
for (const path of ["/_next/static/missing.png", "/_next/static/missing.css", "/unrelated-missing.js"]) {
  assert.equal((await fetch(new URL(path, base))).status, 404);
}
console.log(`Production routing passed: missing JS recovery, no-store, HEAD 404, ${scripts.length} real scripts unchanged, unrelated 404s preserved.`);
