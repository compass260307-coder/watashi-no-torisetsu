// No remote services: execute production capture, API handlers, session insert and Apps Script
// against in-memory browser/DB/Sheets adapters. Run: node scripts/acquisition-medium-test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const plain = (value) => JSON.parse(JSON.stringify(value));

function loader(stubs = {}) {
  const cache = new Map();
  function load(file) {
    file = resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const cjsModule = { exports: {} };
    cache.set(file, cjsModule);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name in stubs) return stubs[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".")) return load(resolve(dirname(file), name + ".ts"));
      return require(name);
    };
    new Function("require", "module", "exports", code)(localRequire, cjsModule, cjsModule.exports);
    return cjsModule.exports;
  }
  return load;
}
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}
function resetBrowser() {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
}
const load = loader();
const acq = load("src/lib/acquisition.ts");
const { classifyAcquisitionMedium: classify } = load("src/lib/acquisition-channel.ts");
const layout = readFileSync(resolve(root, "src/app/layout.tsx"), "utf8");
const scripts = ["ACQUISITION_CAPTURE_SCRIPT", "AD_CLICK_CAPTURE_SCRIPT"].map((name) =>
  layout.match(new RegExp("const " + name + " = `([\\s\\S]*?)`;"))[1],
);
function land(search, pathname = "/") {
  const context = { localStorage, sessionStorage, URLSearchParams, window: { location: { search, pathname } } };
  for (const script of scripts) vm.runInNewContext(script, context);
}
for (const path of ["/diagnosis", "/ko/diagnosis"]) {
  resetBrowser();
  land("?utm_source=tiktok&utm_campaign=launch&utm_medium=paid_social", path.replace("diagnosis", ""));
  const expected = { source: "tiktok", campaign: "launch", medium: "paid_social" };
  assert.deepEqual(acq.resolveAcquisitionForSave(""), expected); // client navigation
  land("", path); // reload with no UTM
  assert.deepEqual(acq.resolveAcquisitionForSave(""), expected);
  sessionStorage = storage(); // new tab: first-touch fallback
  assert.deepEqual(acq.resolveAcquisitionForSave(""), expected);
}
resetBrowser();
localStorage.setItem("wt_acq_source", "instagram");
localStorage.setItem("wt_ad_utm_medium", "cpc");
assert.equal(acq.resolveAcquisitionForSave("").medium, null); // legacy source must not borrow ad medium
land("?utm_source=google&utm_medium=cpc");
assert.deepEqual(acq.resolveAcquisitionForSave(""), { source: "google", campaign: null, medium: "cpc" });
assert.equal(localStorage.getItem("wt_acq_medium"), null); // no legacy backfill
sessionStorage = storage();
assert.deepEqual(acq.resolveAcquisitionForSave(""), { source: "instagram", campaign: null, medium: null });
resetBrowser();
land("?utm_source=instagram");
land("?utm_source=tiktok&utm_campaign=later&utm_medium=paid_social");
assert.equal(acq.readAcquisition().campaign, null);
assert.equal(acq.readAcquisition().medium, null);
assert.equal(acq.resolveAcquisitionForSave("").medium, "paid_social");
assert.deepEqual(acq.resolveAcquisitionForSave("?ref=line&camp=menu"), { source: "line", campaign: "menu", medium: null });
resetBrowser();
land("?liff.state=" + encodeURIComponent("/ko/diagnosis?utm_source=line&utm_medium=organic_social&utm_campaign=a"));
assert.equal(acq.resolveAcquisitionForSave("").medium, "organic_social");
assert.equal(acq.parseAcquisitionFromSearch("?utm_medium=cpc&state=" + encodeURIComponent("?utm_source=other")).source, null);
assert.equal(acq.parseAcquisitionFromSearch("?state=%E0%A4%A").medium, null);
assert.equal(new URLSearchParams(acq.encodeAcquisitionState({ source: "line", campaign: null, medium: "organic_social" })).get("utm_medium"), "organic_social");
resetBrowser();
localStorage.setItem("wt_ad_utm_source", "tiktok");
localStorage.setItem("wt_ad_utm_medium", "paid_social");
assert.equal(acq.resolveAcquisitionForSave("").medium, "paid_social");
resetBrowser();
localStorage.setItem("wt_ad_ttclid", "test-click");
assert.equal(classify(acq.resolveAcquisitionForSave("").medium), "不明");
for (const medium of ["paid_social", "cpc", "PPC", " paid_search ", "display"]) assert.equal(classify(medium), "広告");
for (const medium of ["organic", "organic_social", " ORGANIC_SEARCH "]) assert.equal(classify(medium), "自然流入");
for (const medium of [null, undefined, "", "  ", "social", "referral", "email", "direct", "unpaid", "paid-ish", "launch_campaign"]) assert.equal(classify(medium), "不明");
localStorage = sessionStorage = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); } };
land("?utm_medium=cpc");
assert.equal(acq.resolveAcquisitionForSave("?utm_medium=cpc").medium, "cpc");
assert.equal(acq.resolveAcquisitionForSave("").medium, null);
console.log("PASS capture: JP/KR navigation, reload, LIFF, legacy, tuple isolation, storage denial, classification");

const users = [];
let existing = null;
let reads = 0;
const db = {
  from(table) {
    assert.equal(table, "users");
    let insert, update, id, limit = Infinity, after, afterId;
    const query = {
      insert(value) { insert = value; return this; }, update(value) { update = value; return this; },
      select(columns) { if (columns.includes("acquisition_medium")) reads++; return this; },
      eq(column, value) { if (column === "id") id = value; return this; },
      not() { return this; }, order() { return this; }, limit(value) { limit = value; return this; },
      gt(column, value) { after = value; return this; },
      or(value) { after = value.match(/diagnosis_completed_at.gt.([^,]+)/)[1]; afterId = value.match(/id.gt.([^)]*)/)[1]; return this; },
      single() {
        if (insert) { const row = { ...insert, id: randomUUID() }; users.push(row); return { data: row, error: null }; }
        const row = users.find((r) => r.id === id);
        if (update) Object.assign(row, update);
        return { data: row, error: null };
      },
      maybeSingle() { return this.single(); },
      then(fn) {
        const rows = users.filter((r) => r.diagnosis_completed_at && (!after || r.diagnosis_completed_at > after || (r.diagnosis_completed_at === after && r.id > afterId)))
          .sort((a, b) => a.diagnosis_completed_at.localeCompare(b.diagnosis_completed_at) || a.id.localeCompare(b.id)).slice(0, limit);
        return Promise.resolve({ data: rows, error: null }).then(fn);
      },
    };
    return query;
  },
};
const serverStubs = {
  "@/lib/supabase-server": { supabaseAdmin: db }, "./supabase-server": { supabaseAdmin: db },
  "next/headers": { cookies: async () => ({ set() {} }) },
  "@/lib/origin-check": { checkOrigin: () => ({ ok: true }) },
  "@/lib/email": { sendDetailedReportEmail: () => { throw Error("unexpected email"); } },
  "@/lib/hoshiyomi/store": { ensureHoshiyomiCreditsFromPurchase: async () => ({ data: { total: 0 } }) },
  "@/lib/entitlements": Object.fromEntries(["hasHoshiyomiChatPurchase", "hasPremiumBundleAccess", "hasSelfReportAccess", "hasTarotAccess", "hasTakoAccess", "hasUnmeiAccess"].map((name) => [name, async () => false])),
};
const security = loader(serverStubs)("src/lib/api-security.ts");
serverStubs["@/lib/api-security"] = { ...security, consumeRateLimit: async () => ({ allowed: true }) };
const session = loader(serverStubs)("src/lib/session.ts");
serverStubs["@/lib/session"] = { ...session, getSession: async () => existing };
const { POST } = loader(serverStubs)("src/app/api/diagnosis/route.ts");
const { NextRequest } = require("next/server");
const answers = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [i + 1, 5]));
async function complete(locale, medium) {
  const response = await POST(new NextRequest("http://localhost/api/diagnosis", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers, locale, acquisitionSource: "test", acquisitionCampaign: "same", acquisitionMedium: medium }),
  }));
  assert.equal(response.status, 200);
  return response.json();
}
for (const locale of ["ja", "ko"]) {
  resetBrowser();
  land("?utm_source=test&utm_campaign=same&utm_medium=paid_social", locale === "ko" ? "/ko" : "/");
  await complete(locale, acq.resolveAcquisitionForSave("").medium);
  assert.equal(users.at(-1).acquisition_medium, "paid_social");
  assert.equal(users.at(-1).acquisition_locale, locale);
}
await complete("ja", " organic_search ");
assert.equal(users.at(-1).acquisition_medium, "organic_search");
await complete("ko", undefined);
assert.equal(users.at(-1).acquisition_medium, null);
existing = users.at(-1);
const originalCompleted = existing.diagnosis_completed_at;
await complete("ko", "cpc");
assert.equal(existing.acquisition_medium, null); // retest must not backfill
assert.equal(existing.diagnosis_completed_at, originalCompleted);
existing = { id: randomUUID(), type_id: "placeholder", scores: { O: 5, C: 5, E: 5, A: 5, N: 5 }, diagnosis_completed_at: null };
users.push(existing);
await complete("ko", "cpc");
assert.equal(existing.acquisition_medium, "cpc");
assert.equal(existing.acquisition_locale, "ko");
existing = null;
console.log("PASS save: actual diagnosis handler → createSession insert, JP/KR, normalization, retest, first placeholder completion");

// Exercise the timestamp tie breaker, not only different completion times.
users.forEach((row) => { row.diagnosis_completed_at = "2026-09-12T01:00:00.123456+00:00"; });
process.env.SHEETS_METRICS_KEY = "local-test-only";
const { GET } = loader(serverStubs)("src/app/api/metrics/diagnoses/route.ts");
async function exported(query = "after=2026-01-01T00:00:00Z&limit=999", authorized = true) {
  const response = await GET(new NextRequest("http://localhost/api/metrics/diagnoses?" + query, {
    headers: authorized ? { Authorization: "Bearer local-test-only" } : {},
  }));
  return { response, payload: await response.json() };
}
const beforeReads = reads;
const { payload } = await exported();
assert.equal(reads - beforeReads, 1);
assert.equal(payload.rows.length, users.length);
assert.deepEqual(payload.columns.slice(8), ["acq_medium", "acq_channel"]);
assert.equal(payload.rows.find((r) => r.acq_medium === "organic_search").acq_channel, "自然流入");
assert.equal(payload.rows.find((r) => r.acq_medium === "").acq_channel, "不明");
assert.ok(payload.rows.every((r) => !r.id && !r.session_token));
assert.equal((await exported(undefined, false)).response.status, 401);
assert.equal((await exported("after=invalid")).response.status, 400);
assert.equal((await exported("after=2026-01-01&after_id=bad")).response.status, 400);
const page = (await exported("after=2026-01-01&limit=2")).payload;
assert.equal(page.rows.length, 2);
assert.equal(page.hasMore, true);
const next = (await exported(`after=${encodeURIComponent(page.nextCursor.at)}&after_id=${page.nextCursor.id}&limit=999`)).payload;
assert.equal(page.rows.length + next.rows.length, users.length);
assert.equal(new Set([...page.rows, ...next.rows].map((r) => r.diagnosis_ref)).size, users.length);
console.log("PASS export: same DB query, append-only columns, classifications, auth, seek pagination, stable references");

class Sheet {
  constructor(headers, cols = headers.length) { this.cells = [headers.slice()]; this.cols = cols; this.maxRows = 100; }
  getLastRow() { return this.cells.length; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.cols; }
  insertRowsAfter(_, count) { this.maxRows += count; }
  insertColumnsAfter(_, count) { this.cols += count; }
  setFrozenRows() {}
  getRange(row, col, height = 1, width = 1) {
    assert.ok(col + width - 1 <= this.cols);
    const { cells } = this;
    return {
      getDisplayValues() { return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => String(cells[row - 1 + r]?.[col - 1 + c] ?? ""))); },
      isBlank() { return this.getDisplayValues().flat().every((x) => !x); },
      setValues(values) { assert.equal(values.length, height); values.forEach((valuesRow, r) => { assert.equal(valuesRow.length, width); cells[row - 1 + r] ??= []; valuesRow.forEach((value, c) => { cells[row - 1 + r][col - 1 + c] = value; }); }); return this; },
      setFontWeight() { return this; }, setBackground() { return this; },
    };
  }
}
const sheet = new Sheet(payload.columns.slice(0, 8));
sheet.cells.push(["historical", "2026-09-01", 1, "old-ref", "type", "ko", "tiktok", "campaign"]);
const props = new Map([["SHEETS_METRICS_KEY", "test"], ["DIAGNOSIS_CURSOR_AT", "2026-01-01T00:00:00Z"]]);
let fetches = 0, served = payload;
const context = vm.createContext({
  URLSearchParams, console,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k), getProperties: () => Object.fromEntries(props), setProperties: (data) => Object.entries(data).forEach(([k, v]) => props.set(k, v)) }) },
  UrlFetchApp: { fetch: () => { fetches++; return { getResponseCode: () => 200, getContentText: () => JSON.stringify(served) }; } },
});
const gas = readFileSync(resolve(root, "scripts/google-sheets-diagnosis-sync.gs"), "utf8");
vm.runInContext(gas, context);
const run = (code) => vm.runInContext(code, context);
run("syncJob_(RAW_SYNC_JOBS.diagnoses)");
assert.equal(fetches, 1);
assert.deepEqual(sheet.cells[0], payload.columns);
assert.equal(sheet.cells.length, users.length + 2);
assert.equal(sheet.cells[1].length, 8); // historical row not touched
assert.ok(sheet.cells.slice(2).every((row) => row.length === 10));
assert.equal(props.get("DIAGNOSIS_CURSOR_AT"), payload.nextCursor.at);
run("syncJob_(RAW_SYNC_JOBS.diagnoses)");
assert.equal(sheet.cells.length, users.length + 2); // retry dedup
served = { ...payload, columns: payload.columns.slice(0, 8), rows: [{ ...payload.rows[0], diagnosis_ref: "legacy-response", acq_medium: undefined, acq_channel: undefined }] };
run("syncJob_(RAW_SYNC_JOBS.diagnoses)");
assert.deepEqual(sheet.cells.at(-1).slice(8), ["", "不明"]);
served = { ...payload, columns: ["unexpected"] };
assert.throws(() => run("syncJob_(RAW_SYNC_JOBS.diagnoses)"), /列定義/);
assert.equal(run('safeCellValue_("=IMPORTDATA(test)")'), "'=IMPORTDATA(test)");
const salesBefore = require("node:child_process").execFileSync("git", ["show", "HEAD:scripts/google-sheets-diagnosis-sync.gs"], { cwd: root, encoding: "utf8" });
const oldContext = vm.createContext({}); vm.runInContext(salesBefore, oldContext);
assert.deepEqual(plain(run("RAW_SYNC_JOBS.sales")), plain(vm.runInContext("RAW_SYNC_JOBS.sales", oldContext)));
assert.equal(gas.slice(gas.indexOf("function createQuarterHourlyTrigger")), salesBefore.slice(salesBefore.indexOf("function createQuarterHourlyTrigger")));
new vm.Script(readFileSync(resolve(root, "scripts/google-sheets-acquisition-upgrade.gs"), "utf8"));
console.log("PASS sync: 8→10 columns, one fetch, old API compatibility, cursor, dedup, history unchanged, sales/trigger unchanged");
console.log("All acquisition-medium integration checks passed (local adapters; no remote writes).");

// Execute the one-time JP→KR migration against the inspected formula layout.
const jpId = "1J7257eFLp8nhO6aUtZyML6hoNltbjHKg4D-nLkxoKec";
const formulaSheet = (initialFormula = "", initialCols = 8) => {
  let formula = initialFormula, columns = initialCols, rows = 1000;
  return {
    getLastRow: () => formula ? 1 : 0, getMaxRows: () => rows, getMaxColumns: () => columns,
    insertRowsAfter: (_, count) => { rows += count; }, insertColumnsAfter: (_, count) => { columns += count; }, hideSheet() {},
    getRange: (range) => { assert.equal(range, "A1"); return { getFormula: () => formula, setFormula: (value) => { formula = value; } }; },
  };
};
const krSheet = formulaSheet(`=ARRAYFORMULA(IFERROR(IMPORTRANGE("${jpId}","'_KR共有データ'!A1:H10000"),'_作成時点データ'!A1:H1307))`);
let shared;
context.SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getId: () => jpId,
    getSheetByName: (name) => { assert.ok(["diagnoses_raw", "_KR診断共有"].includes(name)); return name === "diagnoses_raw" ? sheet : shared; },
    insertSheet: (name) => { assert.equal(name, "_KR診断共有"); shared = formulaSheet(); return shared; },
  }),
  openById: (id) => { assert.equal(id, "13uBekL9JZfzNWFxqiCQHOxTalFxBhx3scWFfdj6cGoU"); return { getSheetByName: (name) => { assert.equal(name, "diagnoses_raw"); return krSheet; } }; },
  flush() {},
};
context.ScriptApp = { getProjectTriggers: () => ["existing-trigger"] };
context.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
vm.runInContext(readFileSync(resolve(root, "scripts/google-sheets-acquisition-upgrade.gs"), "utf8"), context);
const fetchCountBeforeUpgrade = fetches;
run("upgradeAcquisitionMediumSheets()");
assert.equal(fetches, fetchCountBeforeUpgrade);
const formula = krSheet.getRange("A1").getFormula();
assert.equal((formula.match(/IMPORTRANGE/g) || []).length, 1);
assert.ok(formula.includes("'_KR診断共有'!A:J"));
assert.ok(formula.includes("https://docs.google.com/spreadsheets/d/"));
assert.ok(formula.includes('VSTACK({"acq_medium","acq_channel"},MAKEARRAY(1306,2'));
assert.equal(krSheet.getMaxColumns(), 10);
assert.equal(shared.getMaxRows(), 10000);
assert.ok(shared.getRange("A1").getFormula().includes('diagnoses_raw!F2:F="ko"'));
run("upgradeAcquisitionMediumSheets()"); // idempotent
krSheet.getRange("A1").setFormula("=USER_CHANGED_FORMULA()");
assert.throws(() => run("upgradeAcquisitionMediumSheets()"), /調査時点から変更/);
console.log("PASS JP→KR migration: exact target, non-overlapping shared tab, single import, 10-column fallback, no fetch, idempotence, stale-formula guard");
