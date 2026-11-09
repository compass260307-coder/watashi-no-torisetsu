import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";
import { PDFDocument } from "pdf-lib";

function compile(path, imports, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // Keep PDF arrays in pdf-lib's realm while injecting only local test services.
  const execute = vm.runInThisContext(`(function(exports, require, process, console) {\n${output}\n})`, { filename: path });
  execute(exports,
    name => {
      assert(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    globals.process ?? { env: {} },
    { error() {} },
  );
  return exports;
}

const { reportPdfCachePath } = compile("src/lib/report-pdf-cache.ts", {
  "node:crypto": crypto,
  "@/lib/supabase-server": {},
});
const user = { id: "test-owner", diagnosis_completed_at: "2026-11-01", display_name: "Test" };
const latest = "2026-11-02";
const oldKeyParts = [user.diagnosis_completed_at, user.display_name, 1, latest];
const document = await PDFDocument.create();
document.addPage().drawText("SOCIAL MIRROR REPORT");
document.addPage().drawText("Friend report content");
const validPdf = await document.save();

function setup({ locale = "ja", status = 200, documentReady = true, found = true,
  entitled = true, environment = "production", cache = new Map() } = {}) {
  const calls = { launched: 0, closed: 0, pdf: 0, writes: 0, reads: [], url: null, selector: null };
  const page = {
    async goto(url) { calls.url = url; return { ok: () => status >= 200 && status < 300, status: () => status }; },
    async waitForSelector(selector) {
      calls.selector = selector;
      if (!documentReady) throw new Error("Login/error page has no report document");
    },
    async evaluate() {},
    async pdf() { calls.pdf++; return validPdf; },
  };
  const route = compile("src/app/tako-report/[token]/pdf/route.ts", {
    "next/server": { NextResponse },
    "pdf-lib": { PDFDocument },
    "@/lib/supabase-server": { supabaseAdmin: {
      from(table) {
        return {
          select() { return this; }, eq() { return this; }, order() { return this; },
          maybeSingle: async () => ({ data: found ? user : null }),
          limit: async () => {
            assert.equal(table, "friend_perceptions");
            return { data: [{ created_at: latest }], count: 1 };
          },
        };
      },
    } },
    "@/lib/entitlements": { hasTakoAccess: async () => entitled },
    "@/lib/pdf-browser": { launchPdfBrowser: async () => {
      calls.launched++;
      return { newPage: async () => page, close: async () => { calls.closed++; } };
    } },
    "@/lib/site-url": { resolveSiteUrl: () => "https://public.example.test" },
    "@/lib/report-pdf-cache": {
      reportPdfCachePath,
      getCachedReportPdf: async key => { calls.reads.push(key); return cache.get(key) ?? null; },
      putCachedReportPdf: async (key, bytes) => { calls.writes++; cache.set(key, bytes); },
    },
  }, { process: { env: {
    NODE_ENV: "production", VERCEL_ENV: environment, VERCEL_URL: "protected-deployment.vercel.app",
  } } });
  return {
    calls, cache,
    request: () => route.GET(new Request(`https://request.example.test/tako-report/test-token/pdf?locale=${locale}`), {
      params: Promise.resolve({ token: "test-token" }),
    }),
  };
}

for (const locale of ["ja", "ko", "en", "id"]) {
  const oldKey = reportPdfCachePath("tako", user.id, locale, oldKeyParts);
  const harness = setup({ locale, cache: new Map([[oldKey, Buffer.from("cached login page")]]) });
  const response = await harness.request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await PDFDocument.load(await response.arrayBuffer())).getPageCount(), 2);
  assert.notEqual(harness.calls.reads[0], oldKey, "Previously cached login PDFs must be regenerated");
  const printUrl = new URL(harness.calls.url);
  assert.equal(printUrl.origin, "https://public.example.test");
  assert.equal(printUrl.pathname, `${locale === "en" || locale === "id" ? `/${locale}` : ""}/tako-report/test-token/print`);
  assert.equal(printUrl.searchParams.get("locale"), locale === "ja" ? null : locale);
  assert.equal(harness.calls.selector, 'main article[data-tako-report-document="ready"]');
  assert.equal(harness.calls.closed, 1);
  assert.equal(harness.calls.writes, 1);
  assert.equal((await harness.request()).status, 200);
  assert.equal(harness.calls.launched, 1, "Verified PDF is reused on the next request");
}
console.log("PASS: all four locales use the public production origin, regenerate old cache entries, and reuse verified PDFs.");

for (const settings of [{ status: 401 }, { status: 500 }, { documentReady: false }]) {
  const harness = setup(settings);
  const response = await harness.request();
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "pdf_failed" });
  assert.equal(harness.calls.pdf, 0);
  assert.equal(harness.calls.writes, 0);
  assert.equal(harness.calls.closed, 1);
}
console.log("PASS: HTTP errors and HTTP 200 login/incomplete pages never become PDFs or cache entries; Chromium always closes.");

for (const environment of ["preview", "development"]) {
  const harness = setup({ environment });
  assert.equal((await harness.request()).status, 200);
  assert.equal(new URL(harness.calls.url).origin, "https://request.example.test");
}
for (const settings of [{ found: false }, { entitled: false }]) {
  const harness = setup(settings);
  const response = await harness.request();
  assert.equal(response.status, settings.found === false ? 404 : 303);
  if (settings.entitled === false) assert.equal(response.headers.get("location"), "https://public.example.test/tako/test-token");
  assert.equal(harness.calls.launched, 0);
  assert.equal(harness.calls.reads.length, 0);
  assert.equal(harness.calls.writes, 0);
}
console.log("PASS: preview/development stay on the request origin; owner and paid-access checks still run before cache access.");
