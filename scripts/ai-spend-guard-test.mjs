import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
import { createGateway, generateText } from 'ai';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

function compile(path, imports = {}, globals = {}) {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(js, { exports, console, Date, Set, URL, Response, Uint8Array,
    AbortController, setTimeout, clearTimeout, process: { env: {} },
    fetch: async () => { throw new Error('Unexpected network request'); },
    require(name) { if (name in imports) return imports[name]; throw new Error(`Unexpected import: ${name}`); },
    ...globals,
  }, { filename: path });
  return exports;
}
const guard = compile('src/lib/ai-spend-guard.ts');
assert.equal(guard.aiSpendBlockCode({ cause: { responseBody: '{"error":{"code":"quota_for_entity_exceeded"}}' } }), 'budget_exceeded');
assert.equal(guard.aiSpendBlockCode(new Error('Project budget exceeded. Current spend: $10.06, limit: $10.00.')), 'budget_exceeded');
assert.equal(guard.aiSpendBlockCode({ errors: [new Error('network'), { type: 'insufficient_funds' }] }), 'insufficient_funds');
assert.equal(guard.aiSpendBlockCode({ message: 'Too many requests', statusCode: 429 }), null);
assert.equal(guard.aiSpendBlockCode(new Error('Provider temporarily overloaded')), null);
const cyclic = {}; cyclic.cause = cyclic;
assert.equal(guard.aiSpendBlockCode(cyclic), null);
const oldDate = new Date(Date.now() - 6 * 60_000).toISOString();
const blockedRow = { state: 'failed', attempts: 7, last_error: 'Project budget exceeded. Current spend: $10.06, limit: $10.00.', updated_at: oldDate };
assert.equal(guard.resultUpgradeSpendBlock(blockedRow).canRetry, true);
assert.equal(guard.resultUpgradeSpendBlock({ ...blockedRow, updated_at: new Date().toISOString() }).canRetry, false);
assert.equal(guard.resultUpgradeSpendBlock({ ...blockedRow, state: 'ready' }), null);
assert.equal(guard.resultUpgradeSpendBlock({ ...blockedRow, updated_at: 'invalid' }).canRetry, false);

// Real AI SDK + real Gateway provider, with HTTP entirely stubbed. The legacy
// HTTP-500 quota response must produce exactly one provider request, not three.
let requests = 0;
const guardedFetch = compile('src/lib/ai-spend-guard.ts', {}, {
  fetch: async () => { requests++; return new Response(JSON.stringify({ error: {
    type: 'quota_for_entity_exceeded', message: 'Project budget exceeded',
  } }), { status: 500, headers: { 'content-type': 'application/json', 'x-test': 'preserved' } }); },
}).fetchWithAiSpendGuard;
await assert.rejects(generateText({ model: createGateway({ apiKey: 'local-mock', fetch: guardedFetch })('google/gemini-3.1-flash-image'), prompt: 'local mock' }), e => {
  assert.equal(guard.aiSpendBlockCode(e), 'budget_exceeded');
  assert.equal(e.isRetryable, false);
  return true;
});
assert.equal(requests, 1);
const transientGuard = compile('src/lib/ai-spend-guard.ts', {}, {
  fetch: async () => new Response('{"error":{"message":"Provider temporarily overloaded"}}', { status: 503 }),
});
assert.equal((await transientGuard.fetchWithAiSpendGuard('https://local.test')).status, 503);
console.log('PASS: nested/legacy spend errors, cooldown, real SDK zero quota retries, transient errors preserved.');

async function routeCase(row, { force = false, allowed = true, dbError = null, session = true, purchased = true } = {}) {
  let rateCalls = 0; const tasks = [];
  const db = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: row, error: dbError }) }) };
  const route = compile('src/app/api/result-upgrade/generate/route.ts', {
    'next/server': { NextResponse, after: task => tasks.push(task) },
    '@/lib/api-security': { consumeRateLimit: async () => { rateCalls++; return { allowed, retryAfterSeconds: 90 }; }, readJsonObject: async r => ({ ok: true, value: await r.json() }) },
    '@/lib/entitlements': { hasPremiumBundleAccess: async () => purchased },
    '@/lib/origin-check': { checkOrigin: () => ({ ok: true }) },
    '@/lib/line-result-upgrade': { getResultUpgradeSession: async () => session ? { id: 'owner' } : null },
    '@/lib/supabase-server': { supabaseAdmin: db },
    '@/lib/ai-spend-guard': guard,
  });
  const response = await route.POST(new Request('https://local.test/api/result-upgrade/generate', { method: 'POST', body: JSON.stringify({ force }) }));
  return { status: response.status, body: await response.json(), rateCalls, tasks, headers: response.headers };
}
for (const row of [blockedRow, { ...blockedRow, state: 'ready' }, { state: 'generating', generation_started_at: new Date().toISOString() }]) {
  const result = await routeCase(row);
  assert.equal(result.status, 200); assert.equal(result.rateCalls, 0); assert.equal(result.tasks.length, 0);
}
assert.equal((await routeCase(blockedRow)).body.state, 'blocked');
const early = await routeCase({ ...blockedRow, updated_at: new Date().toISOString() }, { force: true });
assert.equal(early.body.state, 'blocked'); assert.equal(early.rateCalls, 0);
const recovery = await routeCase(blockedRow, { force: true });
assert.equal(recovery.body.state, 'pending'); assert.equal(recovery.rateCalls, 1); assert.equal(recovery.tasks.length, 1);
const denied = await routeCase(blockedRow, { force: true, allowed: false });
assert.equal(denied.status, 429); assert.equal(denied.tasks.length, 0); assert.equal(denied.headers.get('retry-after'), '90');
assert.equal((await routeCase(null)).status, 409);
assert.equal((await routeCase(null, { dbError: { code: 'test' } })).status, 503);
assert.equal((await routeCase(blockedRow, { session: false })).status, 401);
assert.equal((await routeCase(blockedRow, { purchased: false })).status, 403);
const statusRoute = compile('src/app/api/result-upgrade/status/route.ts', {
  'next/server': { NextResponse }, '@/lib/entitlements': { hasFullAccess: async () => true, hasPremiumBundleAccess: async () => true },
  '@/lib/line-result-upgrade': { getResultUpgradeSession: async () => ({ id: 'owner' }) },
  '@/lib/result-upgrade-server': { loadResultUpgradeForUser: async () => blockedRow },
  '@/lib/result-upgrade': { isResultUpgradeReady: () => false }, '@/lib/ai-spend-guard': guard,
});
const status = await (await statusRoute.GET(new Request('https://local.test'))).json();
assert.equal(status.state, 'blocked'); assert.equal(status.code, 'budget_exceeded');
assert.equal('last_error' in status, false);
console.log('PASS: route guards, legacy high-attempt recovery, no allowance spent on blocked/ready/in-progress, safe status response.');

async function workerCase({ force = false, updatedAt = oldDate, failure = null, answers = ["one", "two", "three", "four", "five"] } = {}) {
  const row = { ...blockedRow, user_id: 'owner', updated_at: updatedAt, answers, source_character_path: '/character.webp',
    personalized_type_name: 'saved type', personalized_intro: 'saved intro', text_model: 'saved-text-model', reading: { sections: [{ body: 'saved body' }] }, character_storage_path: null, image_model: null };
  const updates = []; let aiCalls = 0; let uploads = 0;
  const db = { from() { let update; return {
    select() { return this; }, eq() { return this; }, update(value) { update = value; updates.push(value); return this; },
    maybeSingle: async () => update ? { data: { user_id: 'owner' }, error: null } : { data: row, error: null },
  }; }, storage: { from: () => ({ upload: async () => { uploads++; return { error: null }; }, remove: async () => ({ error: null }) }) } };
  const worker = compile('src/lib/result-upgrade/generate.ts', {
    'server-only': {}, 'node:crypto': { randomUUID: () => 'generation' }, '@ai-sdk/anthropic': { anthropic: x => x },
    'ai': { createGateway: () => model => model, jsonSchema: x => x, Output: { object: x => x }, generateText: async options => {
      aiCalls++; assert(!options.output, 'Saved text must not be regenerated');
      if (failure) throw failure;
      return { files: [{ mediaType: 'image/png', uint8Array: new Uint8Array([1]) }], usage: {}, response: { id: 'mock' } };
    } },
    '@/lib/ai-spend-guard': guard, '@/lib/ai-usage.mjs': { aiSdkUsage: () => ({}), gatewayGenerationId: () => null, recordAiUsage: async () => {} },
    '@/i18n/ko/result': { KO_RESULT_TYPES: {} }, '@/lib/site-url': { resolveSiteUrl: () => 'https://local.test' },
    '@/lib/supabase-server': { supabaseAdmin: db }, '@/lib/thirty-two-types': { allThirtyTwoTypeIds: () => [], thirtyTwoEssence: () => '' },
    '@/lib/sixteen-types': { sixteenTypes: {} }, '@/lib/result-upgrade': { ...compile('src/lib/result-upgrade.ts'), resultUpgradeQuestions: () => ['question'] },
  }, { fetch: async () => new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/webp' } }) });
  const result = await worker.generateResultUpgradeForUser('owner', { force });
  return { result, updates, aiCalls, uploads };
}
const partial = await workerCase({ force: true, answers: ["one"] });
assert.equal(partial.result.skipped, "incomplete_answers");
assert.equal(partial.aiCalls, 0);
assert.equal(partial.updates.length, 0);
assert.equal((await workerCase()).aiCalls, 0);
assert.equal((await workerCase({ force: true, updatedAt: new Date().toISOString() })).aiCalls, 0);
const completed = await workerCase({ force: true });
assert.equal(completed.aiCalls, 1); assert.equal(completed.uploads, 1); assert.equal(completed.result.ok, true);
assert.equal(completed.updates.at(-1).state, 'ready');
assert(!completed.updates.some(update => 'reading' in update));
const failed = await workerCase({ force: true, failure: new Error('Project budget exceeded') });
assert.equal(failed.updates.at(-1).attempts, 7);
assert.equal(failed.updates.at(-1).last_error, 'ai_spend_blocked:budget_exceeded');
console.log('PASS: worker enforces block/cooldown, resumes only missing image, spend rejection preserves generation-attempt count.');

const localizedCopy = compile('src/i18n/result-upgrade.ts');
const pause = compile('src/components/result-upgrade/ResultUpgradeSpendPause.tsx', {
  'react': React, 'react/jsx-runtime': jsxRuntime, '@/i18n/result-upgrade': localizedCopy,
}).ResultUpgradeSpendPause;
for (const locale of ['ja', 'ko']) {
  const waiting = renderToStaticMarkup(React.createElement(pause, { locale, retryAt: new Date(Date.now() + 60_000).toISOString(), canRetry: false, onResume() {} }));
  assert.match(waiting, /disabled=""/);
  assert(waiting.includes(localizedCopy.RESULT_UPGRADE_COPY[locale].blocked));
  const recovered = renderToStaticMarkup(React.createElement(pause, { locale, canRetry: true, onResume() {} }));
  assert(!recovered.includes('disabled=""'));
  assert(recovered.includes(localizedCopy.RESULT_UPGRADE_COPY[locale].resume));
}
console.log('PASS: Japanese/Korean pause message, cooldown disables resume, explicit recovery enables it.');
