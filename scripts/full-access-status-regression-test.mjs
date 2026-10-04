import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

const root = resolve(import.meta.dirname, '..');
// Compile only the modules under test, with explicit isolated dependencies; no .env or real DB.
function modules(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(path) {
    path = resolve(root, path);
    if (cache.has(path)) return cache.get(path);
    const exports = {};
    cache.set(path, exports);
    const output = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const context = { exports, console, AbortController, URLSearchParams, Event, CustomEvent, ...globals,
      require(name) {
        if (name in overrides) return overrides[name];
        if (name === 'server-only') return {};
        if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
        if (name.startsWith('.')) return load(resolve(dirname(path), `${name}.ts`));
        throw new Error(`Unexpected dependency: ${name}`);
      },
    };
    vm.runInNewContext(output, context, { filename: path });
    return exports;
  }
  return load;
}
const json = (value) => JSON.parse(JSON.stringify(value));
const empty = { full: false, selfReport: false, friend: false, premiumBundle: false, astrologer: false, unmei: false, tarot: false };
const all = Object.fromEntries(Object.keys(empty).map(key => [key, true]));
const owner = (id = 'a', extra = {}) => ({ id, owner_token: `token-${id}`, email: 'same@example.test', plan: 'free', unmei: false, ...extra });
const payment = (kind, extra = {}) => ({ id: `p-${kind}`, user_id: 'a', payment_kind: kind, status: 'completed', stripe_session_id: `cs-${kind}`,
  paid_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z', metadata: {}, ...extra });
const policy = modules()('src/lib/access-products.ts');
const currentMetadata = { hoshiyomi_chat_policy: policy.HOSHIYOMI_CHAT_POLICY_FULL_ALL_INCLUDED, tarot_access_policy: policy.TAROT_ACCESS_POLICY_FULL_INCLUDED, destiny_access_policy: policy.DESTINY_ACCESS_POLICY_FULL_INCLUDED };

function database(users, payments = [], balances = []) {
  const calls = [];
  let fail = false;
  let relationFailure = false;
  function matching(row, params, ignoreEmbedded = false) {
    for (const [key, filter] of params) {
      if (['select', 'order', 'limit', 'offset'].includes(key) || (ignoreEmbedded && key.includes('.'))) continue;
      if (filter.startsWith('eq.') && String(row[key]) !== filter.slice(3)) return false;
      if (filter.startsWith('in.(') && !filter.slice(4, -1).split(',').includes(String(row[key]))) return false;
    }
    return true;
  }
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    const table = url.pathname.split('/').at(-1);
    calls.push({ table, method: init.method ?? 'GET', params: url.searchParams });
    if (relationFailure && url.searchParams.get('select')?.includes('payment_history(')) return new Response(JSON.stringify({code:'PGRST200',message:'missing relationship'}), {status:400});
    if (fail) return new Response(JSON.stringify({ code: '08006', message: 'test outage' }), { status: 503 });
    if (url.pathname.includes('/rpc/')) {
      const args = JSON.parse(init.body);
      if (table === 'grant_hoshiyomi_credits') {
        let balance = balances.find(b => b.user_id === args.p_user_id);
        if (!balance) { balance = { user_id: args.p_user_id, credits_total: 0, credits_remaining: 0 }; balances.push(balance); }
        balance.credits_total += args.p_credits;
        balance.credits_remaining += args.p_credits;
      }
      return new Response('[]');
    }
    let rows = table === 'users' ? users : table === 'payment_history' ? payments : balances;
    rows = rows.filter(row => matching(row, url.searchParams, table === 'users'));
    const select = url.searchParams.get('select') ?? '';
    if (table === 'users' && select.includes('payment_history(')) {
      assert.equal(url.searchParams.get('payment_history.status'), 'eq.completed');
      assert.match(url.searchParams.get('payment_history.payment_kind'), /tako_unlock/);
      rows = rows.map(row => ({ ...row, payment_history: payments.filter(p => p.user_id === row.id && p.status === 'completed' &&
        ['self_report', 'full_access', 'premium_bundle', 'tako_unlock'].includes(p.payment_kind)),
        hoshiyomi_credit_balances: balances.find(b => b.user_id === row.id) ?? null }));
    }
    if (table === 'payment_history') rows = rows.toSorted((a, b) => String(a.paid_at ?? '').localeCompare(String(b.paid_at ?? '')) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
    const limit = url.searchParams.get('limit');
    if (limit) rows = rows.slice(0, Number(limit));
    return new Response(JSON.stringify(rows), { headers: { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` } });
  };
  const client = createClient('https://isolated.example.test', 'not-a-secret-test-key', { auth: { persistSession: false }, global: { fetch: fetcher } });
  const loader = modules({ './supabase-server': { supabaseAdmin: client }, '@/lib/supabase-server': { supabaseAdmin: client } });
  return { calls, client, load: loader, fail: () => { fail = true; }, missingRelation: () => { relationFailure = true; } };
}
async function previous(db, userId) {
  const e = db.load('src/lib/entitlements.ts');
  const h = db.load('src/lib/hoshiyomi/store.ts');
  // Original route's owner lookup + unchanged individual entitlement functions.
  await db.client.from('users').select('id').eq('owner_token', `token-${userId}`).maybeSingle();
  const fullPromise = e.hasFullAccess(userId);
  const purchasesPromise = e.getAccessPurchaseEntitlements(userId);
  const checks = { full: fullPromise, purchases: purchasesPromise };
  const [full, selfReport, friend, purchases, unmei] = await Promise.all([
    fullPromise, e.hasSelfReportAccess(userId, checks), e.hasTakoAccess(userId, checks), purchasesPromise, e.hasUnmeiAccess(userId, checks),
  ]);
  const credits = full || purchases.full ? await h.ensureHoshiyomiCreditsFromPurchase(userId) : null;
  return { full, selfReport, friend, premiumBundle: purchases.premiumBundle, unmei, tarot: purchases.tarotFeatures,
    astrologer: full && credits?.available === true && credits.data.total > 0 };
}
const fixtures = [
  ['unpaid/no email', [owner('a', { email: null })], [], []],
  ['unpaid/email', [owner()], [], []],
  ['full purchase', [owner('a', { plan: 'full', unmei: true })], [payment('full_access', { metadata: currentMetadata })], [{ user_id: 'a', credits_total: 30, credits_remaining: 0 }]],
  ['upsell purchase', [owner('a', { plan: 'full', unmei: true })], [payment('full_access'), payment('premium_bundle', { paid_at: '2026-10-02T00:00:00Z', metadata: { upgrade_from: 'full_access' } })], [{ user_id: 'a', credits_total: 30, credits_remaining: 8 }]],
  ['legacy plan only', [owner('a', { plan: 'full' })], [], []],
  ['self-report', [owner()], [payment('self_report')], []],
  ['legacy friend', [owner()], [payment('tako_unlock')], []],
  ['same-email recovery', [owner(), owner('b', { plan: 'full', unmei: true })], [payment('premium_bundle', { user_id: 'b' })], [{ user_id: 'b', credits_total: 30, credits_remaining: 1 }]],
  ['refund invalidates upsell prerequisite', [owner()], [payment('full_access', { status: 'refunded' }), payment('premium_bundle', { metadata: { upgrade_from: 'full_access' } })], []],
  ['different email never grants', [owner(), owner('b', { email: 'other@example.test', plan: 'full', unmei: true })], [payment('premium_bundle', { user_id: 'b' })], [{ user_id: 'b', credits_total: 30 }]],
  ['payment before plan/webhook', [owner()], [payment('full_access')], [{ user_id: 'a', credits_total: 5 }]],
  ['explicit old exclusions', [owner('a', { plan: 'full' })], [payment('full_access', { metadata: { destiny_access_policy: policy.DESTINY_ACCESS_POLICY_PREMIUM_ONLY, tarot_access_policy: policy.TAROT_ACCESS_POLICY_FULL_ONLY } })], [{ user_id: 'a', credits_total: 5 }]],
];
for (const [name, users, payments, balances] of fixtures) {
  const before = database(json(users), json(payments), json(balances));
  const after = database(json(users), json(payments), json(balances));
  const expected = json(await previous(before, 'a'));
  const actual = json(await after.load('src/lib/full-access-status-server.ts').getFullAccessStatusByOwnerToken('token-a'));
  assert.deepEqual(actual, expected, name);
  if (name === 'full purchase') assert.deepEqual(actual, { ...all, premiumBundle: false });
  if (name === 'upsell purchase') assert.deepEqual(actual, all);
  if (name === 'explicit old exclusions') { assert.equal(actual.unmei, false); assert.equal(actual.tarot, false); }
  assert.equal(after.calls.length, users[0].email ? 2 : 1, name);
  assert.ok(after.calls.every(call => call.method === 'GET'), 'normal status must not mutate/release credits');
  console.log(`${name}: same flags; Supabase ${before.calls.length} -> ${after.calls.length}`);
}
// Restoration is the exceptional path; preserve the existing grant implementation.
{
  const db = database([owner('a', { plan: 'full', unmei: true })], [payment('full_access')]);
  const actual = await db.load('src/lib/full-access-status-server.ts').getFullAccessStatusByOwnerToken('token-a');
  assert.equal(actual.astrologer, true);
  assert.equal(db.calls.filter(c => c.table === 'grant_hoshiyomi_credits').length, 1);
  db.calls.length = 0;
  await db.load('src/lib/full-access-status-server.ts').getFullAccessStatusByOwnerToken('token-a');
  assert.equal(db.calls.length, 2, 'next request returns to fast path after restoration');
}
{
  const db = database([owner()]); db.fail();
  await assert.rejects(db.load('src/lib/full-access-status-server.ts').getFullAccessStatusByOwnerToken('token-a'));
}
{
  const db = database([owner('a', { plan: 'full', unmei: true })], [payment('full_access', { metadata: currentMetadata })], [{ user_id: 'a', credits_total: 30 }]);
  db.missingRelation();
  assert.deepEqual(json(await db.load('src/lib/full-access-status-server.ts').getFullAccessStatusByOwnerToken('token-a')), { ...all, premiumBundle: false }, 'missing FK uses old paid-access checks');
}
{
  const users = Array.from({ length: 51 }, (_, index) => owner(index === 0 ? 'a' : `related-${index}`));
  users.at(-1).plan = 'full'; users.at(-1).unmei = true;
  const before = database(json(users)); const after = database(json(users));
  assert.deepEqual(json(await after.load('src/lib/full-access-status-server.ts').getFullAccessStatusByOwnerToken('token-a')), json(await previous(before, 'a')), '50+ related users preserve full/unmei outside the capped set');
}
// Browser storage is isolated by tab. Recreate modules against the same session storage to test reload.
function storage() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k), clear: () => values.clear() }; }
let now = 1_000_000;
const local = storage(); local.setItem('torisetsu_owner_token', 'token-a');
const session = storage();
let count = 0, responseStatus = empty, httpStatus = 200, deferred = null;
function browser(tabSession = session) {
  const window = new EventTarget();
  window.location = { href: 'https://app.example.test/me/token-a', pathname: '/me/token-a', search: '' };
  const document = new EventTarget(); document.cookie = 'wn_session_present=1';
  class FakeDate extends Date { static now() { return now; } }
  const load = modules({}, { window, document, localStorage: local, sessionStorage: tabSession, Date: FakeDate,
    fetch: async () => { count++; if (deferred) return deferred; return new Response(JSON.stringify(responseStatus), { status: httpStatus }); },
  });
  return { api: load('src/lib/full-access-status-client.ts'), window, document };
}
let tab = browser();
const parallel = await Promise.all(Array.from({ length: 8 }, () => tab.api.requestFullAccessStatus('token-a')));
assert.equal(count, 1, '8 consumers share one fetch'); assert.ok(parallel.every(r => r.full === false));
for (let i = 0; i < 8; i++) await tab.api.requestFullAccessStatus('token-a');
assert.equal(count, 1, 'repeat calls/re-renders do not fetch');
now += 40_000; await tab.api.requestFullAccessStatus('token-a'); assert.equal(count, 1, 'navigation beyond old 30s TTL shares cache');
tab = browser(); await tab.api.requestFullAccessStatus('token-a'); assert.equal(count, 1, 'reload shares tab cache');
tab.window.dispatchEvent(new Event('focus')); tab.document.dispatchEvent(new Event('visibilitychange'));
assert.equal(count, 1, 'return from another tab with no changes does not fetch');
responseStatus = all; await tab.api.requestFullAccessStatus('token-a', { fresh: true }); assert.equal(count, 2, 'purchase poll bypasses cached unpaid status');
tab = browser(); assert.equal((await tab.api.requestFullAccessStatus('token-a')).full, true); assert.equal(count, 2, 'post-purchase reload uses fresh result');
now += 301_000; await tab.api.requestFullAccessStatus('token-a'); assert.equal(count, 3, 'expiry refetches once');
// Full page purchase return invalidates cached state even without a mounted PaidUnlockWatcher.
responseStatus = empty; tab.window.location.search = '?paid=1'; tab.window.location.href += '?paid=1';
await tab.api.requestFullAccessStatus('token-a'); assert.equal(count, 4);
await tab.api.requestFullAccessStatus('token-a'); assert.equal(count, 4, 'paid URL remaining in address bar does not cause repeated normal fetches');
// User switch while A request is in flight must neither save nor return A permissions to B.
tab.window.location.search = ''; let release; deferred = new Promise(r => { release = r; });
const old = tab.api.requestFullAccessStatus('token-a', { fresh: true });
local.setItem('torisetsu_owner_token', 'token-b'); tab.api.invalidateFullAccessStatus(); deferred = null;
assert.equal((await tab.api.requestFullAccessStatus('token-b')).full, false);
release(new Response(JSON.stringify(all))); assert.equal(await old, null);
tab = browser(); await tab.api.requestFullAccessStatus('token-b'); assert.equal(count, 6, 'late A response did not overwrite B cache');
// Logout/reset clears saved state; another user starts uncached.
local.removeItem('torisetsu_owner_token'); tab.document.cookie = ''; tab.api.invalidateFullAccessStatus();
assert.equal(session.getItem('torisetsu_full_access_status_v1'), null);
local.setItem('torisetsu_owner_token', 'token-c'); tab.document.cookie = 'wn_session_present=1';
await tab.api.requestFullAccessStatus('token-c'); assert.equal(count, 7);
// Failed status is never a cached unpaid success.
httpStatus = 503; tab.api.invalidateFullAccessStatus(false);
assert.equal(await tab.api.requestFullAccessStatus('token-c'), null);
httpStatus = 200; responseStatus = all; assert.equal((await tab.api.requestFullAccessStatus('token-c')).full, true);
assert.equal(count, 9);
// A storage event from a purchase or identity change invalidates this tab too.
local.setItem('torisetsu_full_access_changed_v1', 'other-tab-purchase');
const changed = new Event('storage'); changed.key = 'torisetsu_full_access_changed_v1'; tab.window.dispatchEvent(changed);
await tab.api.requestFullAccessStatus('token-c'); assert.equal(count, 10);
// Same owner after a session rotation must refetch; public nonce carries no credentials.
tab.document.cookie = 'wn_session_present=1; wn_access_cache_scope=new-generation';
await tab.api.requestFullAccessStatus('token-c'); assert.equal(count, 11);
// Distinct capability tokens on the same page must not cancel or reuse one another's result.
const [own, other] = await Promise.all([tab.api.requestFullAccessStatus('token-d'), tab.api.requestFullAccessStatus('token-e')]);
assert.equal(own.full, true); assert.equal(other.full, true); assert.equal(count, 13);
console.log('Client cache: dedupe, reload, navigation, TTL, focus, purchase, cross-tab changes, logout/user switch, and stale-response race passed.');
console.log('Full-access status regression checks passed (no external services).');
