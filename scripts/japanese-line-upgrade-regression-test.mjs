import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';

function compile(path, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, console, Buffer, Date, URL, URLSearchParams, Response,
    process: { env: {} }, require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    }, ...globals }, { filename: path });
  return exports;
}
const owner = { lineUserId: 'line-owner', id: 'owner', owner_token: 'owner-token', email: 'owner@example.test' };
const security = { consumeRateLimit: async () => ({ allowed: true }), isSafeOpaqueToken: () => true,
  readJsonObject: async request => ({ ok: true, value: await request.json() }) };
const policy = compile('src/lib/access-products.ts');
const answersLib = compile('src/lib/result-upgrade.ts');
const answers = ['散歩をする', '読書が好き', '落ち着いている', 'お互いを尊重する', '好きな仕事を続ける'];
let now = Date.now();
class Clock extends Date { static now() { return now; } }
const tokens = compile('src/lib/line-result-upgrade-token.ts', { 'node:crypto': crypto }, {
  Date: Clock, process: { env: { ALICE_TRANSFER_CODE_SECRET: 'isolated-test-signing-key' } },
});
const token = tokens.signLineResultUpgradeIdentity('line-owner', owner.id);
assert.equal(tokens.verifyLineResultUpgradeIdentity(token).userId, owner.id);
assert.equal(tokens.verifyLineResultUpgradeIdentity(`${token}x`), null);
assert.equal(tokens.verifyLineResultUpgradeIdentity(`${token}.extra`), null);
assert.equal(tokens.verifyLineResultUpgradeIdentity('invalid'), null);
assert.equal(tokens.verifyLineResultUpgradeIdentity('x'.repeat(2049)), null);
const [payload] = token.split('.');
const plusSignature = crypto.createHmac('sha256', 'isolated-test-signing-key').update(`line-plus\0${payload}`).digest('hex');
assert.equal(tokens.verifyLineResultUpgradeIdentity(`${payload}.${plusSignature}`), null);
now += tokens.LINE_RESULT_UPGRADE_TTL_SECONDS * 1000 + 1;
assert.equal(tokens.verifyLineResultUpgradeIdentity(token), null);
now = Date.now();
console.log('PASS: scoped LINE identity rejects tampering, malformed, expired, and cross-purpose tokens.');

let linkedUser = owner.id;
let failDb = false;
let cookie = token;
const lineSession = compile('src/lib/line-result-upgrade.ts', {
  'server-only': {}, 'next/headers': { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) },
  '@/lib/session': { getSession: async () => ({ id: 'web-owner' }) },
  '@/lib/site-url': { resolveSiteUrl: () => 'https://isolated.example.test' },
  '@/lib/line-result-upgrade-token': tokens,
  '@/lib/supabase-server': { supabaseAdmin: { from(table) { return { select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: table === 'line_accounts' ? { user_id: linkedUser } : owner, error: failDb ? {} : null }),
  }; } } },
});
assert.equal((await lineSession.getResultUpgradeSession(new Request('https://example.test/api?channel=line'))).id, owner.id);
assert.equal((await lineSession.getResultUpgradeSession(new Request('https://example.test/api'))).id, 'web-owner');
linkedUser = 'new-owner';
assert.equal(await lineSession.resolveLineResultUpgradeIdentity(token), null);
linkedUser = owner.id; failDb = true;
assert.equal(await lineSession.resolveLineResultUpgradeIdentity(token), null);
failDb = false; cookie = '';
assert.equal(await lineSession.getResultUpgradeSession(new Request('https://example.test/api?channel=line')), null, 'LINE never falls back to another Web account');
cookie = token;
console.log('PASS: current account binding rejects relinks, unlinks, DB errors and missing cookies; Web login stays independent.');

const enter = compile('src/app/api/line/result-upgrade/enter/route.ts', {
  'next/server': { NextResponse }, '@/lib/line-result-upgrade': lineSession,
  '@/lib/line-result-upgrade-token': tokens, '@/lib/api-security': security,
}, { process: { env: { NODE_ENV: 'production' } } });
const opened = await enter.GET(new NextRequest(`https://example.test/api/line/result-upgrade/enter?token=${encodeURIComponent(token)}`));
assert.equal(opened.headers.get('location'), 'https://example.test/line/result-upgrade');
assert.match(opened.headers.get('set-cookie'), /HttpOnly/);
assert.match(opened.headers.get('set-cookie'), /Secure/);
assert.match(opened.headers.get('set-cookie'), /SameSite=lax/);
assert.match(opened.headers.get('cache-control'), /no-store/);
const invalid = await enter.GET(new NextRequest('https://example.test/api/line/result-upgrade/enter?token=bad'));
assert.equal(invalid.headers.get('location'), 'https://example.test/line/menu');
assert.equal(invalid.headers.get('set-cookie'), null);
console.log('PASS: signed entry issues a restricted HttpOnly cookie, removes token from the destination, and rejects invalid links.');

async function checkout({ full = true, premium = false, line = true, saved = answers, savedLocale = 'ja', couponMode = 'valid', ...body } = {}) {
  const calls = [];
  const stripe = { checkout: { sessions: { create: async params => { calls.push(params); return { id: 'cs_isolated', url: 'https://checkout.example.test' }; } } },
    prices: { retrieve: async () => ({ active: true, type: 'one_time', currency: 'jpy', unit_amount: 499, tax_behavior: 'inclusive' }) },
    coupons: {
      retrieve: async id => {
        if (couponMode === 'missing' || couponMode === 'unavailable') throw new Error('missing');
        return { id, valid: true, currency: couponMode === 'wrong_currency' ? 'usd' : 'jpy', amount_off: id.includes('line-result-upgrade') ? (couponMode === 'wrong_amount' ? 498 : 499) : 791 };
      },
      create: async params => { if (couponMode === 'unavailable') throw new Error('unavailable'); return { ...params, valid: true }; },
    },
  };
  const db = { from(table) { return { select() { return this; }, eq() { return this; },
    maybeSingle: async () => ({ data: table === 'users' ? owner : { locale: savedLocale, answers: saved } }),
    insert: async () => ({ error: null }),
  }; } };
  const route = compile('src/app/api/checkout/create-full-access-session/route.ts', {
    'next/server': { NextResponse }, 'node:crypto': crypto,
    '@/lib/api-security': security, '@/lib/session': { getSession: async () => owner },
    '@/lib/line-result-upgrade': { getLineResultUpgradeSession: async () => line ? owner : null },
    '@/lib/entitlements': { hasFullAccess: async () => full, hasSelfReportAccess: async () => full,
      hasPremiumBundleAccess: async () => premium, getAccessPurchaseEntitlements: async () => ({ full, selfReport: full, premiumBundle: premium }) },
    '@/lib/access-products': policy, '@/lib/result-upgrade': answersLib,
    '@/lib/checkout-commerce-disclosure': compile('src/lib/checkout-commerce-disclosure.ts'),
    '@/lib/thirty-two-types': { allThirtyTwoTypeIds: () => [] },
    '@/lib/stripe-server': { getStripe: () => stripe, getFullAccessPriceId: () => 'price_full' },
    '@/lib/origin-check': { checkOrigin: () => ({ ok: true }) }, '@/lib/supabase-server': { supabaseAdmin: db },
    '@/lib/paywall-source': { DIRECT_PAYWALL_SOURCE: 'direct', normalizePaywallSource: value => value ?? 'direct' },
    '@/lib/checkout-measurement': { normalizeCheckoutAttemptId: value => value },
    '@/lib/checkout-cancel-signature': { signCheckoutCancellation: () => 'test-signature' },
  });
  const request = new NextRequest('https://example.test/api/checkout/create-full-access-session', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: 'ja', owner_token: owner.owner_token,
      product: 'premium_bundle', paywall_source: 'result_upgrade_after_answers', sales_channel: 'line',
      paywall_version: policy.accessPaywallVersionForLocale("ja"), ...body }) });
  const response = await route.POST(request);
  return { status: response.status, body: await response.json(), calls };
}
const purchase = await checkout();
assert.equal(purchase.status, 200);
assert.equal(purchase.body.amount, 899);
assert.equal(purchase.calls[0].mode, 'payment');
assert.equal(purchase.calls[0].line_items[0].price_data.unit_amount, 1398);
assert.equal(purchase.calls[0].discounts[0].coupon, 'wt-line-result-upgrade-off499-jpy');
assert.match(purchase.calls[0].line_items[0].price_data.product_data.name, /結果アップグレード/);
assert.match(purchase.calls[0].custom_text.submit.message, /Alice Plusの定期課金とは別購入/);
assert.equal(purchase.calls[0].metadata.sales_channel, 'line');
assert.equal(purchase.calls[0].metadata.sales_channel_version, policy.LINE_RESULT_UPGRADE_OFFER_VERSION);
assert.match(purchase.calls[0].success_url, /\/line\/result-upgrade\?paid=1/);
assert.match(purchase.calls[0].cancel_url, /\/line\/result-upgrade\?/);
for (const [input, status] of [
  [{ line: false }, 403], [{ sales_channel: 'web' }, 403], [{ owner_token: 'another-owner' }, 403],
  [{ full: false }, 409], [{ saved: answers.slice(0, 4) }, 409], [{ savedLocale: 'en' }, 409],
  [{ premium: true }, 409], [{ paywall_source: 'direct' }, 403],
]) {
  const rejected = await checkout(input);
  assert.equal(rejected.status, status, JSON.stringify(input));
  assert.equal(rejected.calls.length, 0, 'Rejected checkout must not contact Stripe');
}
for (const couponMode of ['wrong_amount', 'wrong_currency', 'unavailable']) {
  const fallback = await checkout({ couponMode });
  assert.equal(fallback.body.amount, 899);
  assert.equal(fallback.calls[0].line_items[0].price_data.unit_amount, 899);
  assert.equal(fallback.calls[0].discounts, undefined);
}
const createdCoupon = await checkout({ couponMode: 'missing' });
assert.equal(createdCoupon.calls[0].line_items[0].price_data.unit_amount, 1398);
assert.equal(createdCoupon.calls[0].discounts[0].coupon, 'wt-line-result-upgrade-off499-jpy');
const complete = await checkout({ full: false, line: false, sales_channel: 'web', product: 'full_access', paywall_source: 'direct' });
assert.equal(complete.status, 200);
assert.equal(complete.body.amount, 499);
assert(!complete.calls[0].success_url.includes('/line/'));
console.log('PASS: LINE-only JPY 899 one-time upgrade, answers/owner/purchase checks, duplicate prevention, LINE returns; Web JPY 499 preserved.');

async function saveAnswers({ channel = 'line', locale = 'ja', premium = false, full = true, existing = null, session = owner, submitted = answers } = {}) {
  const writes = [];
  const route = compile('src/app/api/result-upgrade/answers/route.ts', {
    'next/server': { NextResponse }, '@/lib/api-security': security,
    '@/lib/entitlements': { hasFullAccess: async () => full, hasPremiumBundleAccess: async () => premium },
    '@/lib/origin-check': { checkOrigin: () => ({ ok: true }) }, '@/lib/result-upgrade': answersLib,
    '@/lib/result-upgrade-server': { isMissingResultUpgradeTable: () => false, resolveResultUpgradeBase: async () => ({ sourceTypeId: 'type', sourceCharacterPath: '/character.png' }) },
    '@/lib/line-result-upgrade': { getResultUpgradeSession: async () => session },
    '@/lib/supabase-server': { supabaseAdmin: { from() { return { select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: existing }), upsert: async data => { writes.push(data); return {}; },
    }; } } },
  });
  const response = await route.POST(new Request(`https://example.test/api/result-upgrade/answers?channel=${channel}`, {
    method: 'POST', body: JSON.stringify({ answers: submitted, locale, ownerToken: owner.owner_token }),
  }));
  return { status: response.status, writes };
}
assert.equal((await saveAnswers()).writes[0].user_id, owner.id);
assert.equal((await saveAnswers({ submitted: ['あ'.repeat(50), ...answers.slice(1)] })).status,200);
assert.equal((await saveAnswers({ submitted: ['あ'.repeat(51), ...answers.slice(1)] })).status,400);
assert.equal((await saveAnswers({ channel:'web',premium:true,submitted:['あ'.repeat(51), ...answers.slice(1)] })).status,200);

assert.equal((await saveAnswers({ channel: 'web' })).status, 403);
assert.equal((await saveAnswers({ channel: 'web', premium: true })).status, 200, 'Existing purchasers can resume on Web');
assert.equal((await saveAnswers({ locale: 'en' })).status, 400);
assert.equal((await saveAnswers({ session: null })).status, 401);
assert.equal((await saveAnswers({ session: { ...owner, owner_token: 'other' } })).status, 403);
assert.equal((await saveAnswers({ existing: { state: 'ready', locale: 'ja' } })).status, 409);
assert.equal((await saveAnswers({ existing: { state: 'answers_ready', locale: 'en' } })).status, 409);
console.log('PASS: private answers save to the authenticated LINE owner only; legacy paid Web resume preserved, completed and other-language results protected.');

const messages = [];
const email = compile('src/lib/email.ts', {
  '@/i18n/th/email-templates': {}, '@/lib/access-products': policy,
  './site-url': { resolveSiteUrl: () => 'https://example.test' },
  resend: { Resend: class { emails = { send: async message => { messages.push(message); return {}; } }; } },
}, { process: { env: { RESEND_API_KEY: 'isolated-test-key', RESEND_FROM_EMAIL: 'test@example.test' } } });
await email.sendDetailedReportEmail({ to: 'test@example.test', ownerToken: owner.owner_token, locale: 'ja', product: 'premium_bundle', resultUpgrade: true, salesChannel: 'line', purchaseAmountMinor: 899 });
assert.match(messages[0].subject, /結果アップグレード/);
assert.match(messages[0].text, /税込899円/);
assert.match(messages[0].text, /5つの自由回答/);
assert.match(messages[0].html, /line.me\/R\/oaMessage/);
console.log('PASS: Japanese receipt describes the upgrade price/features and recovery through LINE. No live LINE, Stripe, database, email, or AI calls.');

async function statusCase({ premium = false, locale = 'ja', channel = 'line' } = {}) {
  const route = compile('src/app/api/result-upgrade/status/route.ts', {
    'next/server': { NextResponse }, '@/lib/line-result-upgrade': { getResultUpgradeSession: async () => owner },
    '@/lib/entitlements': { hasFullAccess: async () => true, hasPremiumBundleAccess: async () => premium },
    '@/lib/result-upgrade-server': { loadResultUpgradeForUser: async () => ({ state: 'ready', locale }) },
    '@/lib/result-upgrade': { isResultUpgradeReady: () => true },
    '@/lib/ai-spend-guard': { resultUpgradeSpendBlock: () => null },
  });
  const response = await route.GET(new Request(`https://example.test/api/result-upgrade/status?channel=${channel}`));
  return { status: response.status, data: await response.json() };
}
assert.equal((await statusCase()).data.premium, false, 'A generated result does not replace a revoked purchase');
assert.equal((await statusCase({ premium: true })).data.state, 'ready');
assert.equal((await statusCase({ locale: 'en', premium: true })).status, 403);
console.log('PASS: LINE payment polling respects purchase revocation and result language.');
