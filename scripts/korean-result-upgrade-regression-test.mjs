import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';

// Exercise the real route with isolated session, DB and Stripe dependencies. No network or secrets.
const root = resolve(import.meta.dirname, '..');
function compile(path, overrides, env = {}, expose = []) {
  const exports = {};
  const output = ts.transpileModule(readFileSync(resolve(root, path), 'utf8') + expose.map(name => `\nexport { ${name} };`).join(''), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, { exports, console, URL, URLSearchParams, process: { env }, require(name) {
    if (name in overrides) return overrides[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } }, { filename: path });
  return exports;
}
const policy = compile('src/lib/access-products.ts', {});
const answersLib = compile('src/lib/result-upgrade.ts', {});
const copy = compile('src/i18n/result-upgrade.ts', {});
assert.deepEqual(Object.keys(copy.RESULT_UPGRADE_COPY.ko).sort(), Object.keys(copy.RESULT_UPGRADE_COPY.ja).sort());
assert.equal(answersLib.resultUpgradeQuestions('ko').length, 5);
assert(answersLib.resultUpgradeQuestions('ko').every(q => /[가-힣]/.test(q) && !/[ぁ-んァ-ン]/.test(q)));
const answers = ['산책하기', '새로운 요리', '차분한 사람', '서로 존중하기', '좋아하는 일을 하기'];
assert(answersLib.normalizeResultUpgradeAnswers(answers));
assert.equal(answersLib.normalizeResultUpgradeAnswers(answers.slice(0, 4)), null);
assert.equal(answersLib.normalizeResultUpgradeAnswers(['x'.repeat(501), ...answers.slice(1)]), null);

async function checkout({ full = true, selfReport = false, premium = false, purchaseFull = full, session = true, sessionId = 'owner', saved = answers, savedLocale = 'ko', dbError = false, ...body } = {}) {
  const calls = [];
  const buyer = { id: 'owner', owner_token: 'owner-token', email: 'owner@example.test' };
  const stripe = {
    checkout: { sessions: { create: async params => { calls.push(params); return { id: 'cs_test', url: 'https://checkout.example.test' }; } } },
    prices: { retrieve: async () => ({ active: true, type: 'one_time', currency: 'krw', unit_amount: 4900, tax_behavior: 'inclusive' }) },
    coupons: { retrieve: async id => ({ id, valid: true, currency: 'krw', amount_off: 8000 }) },
  };
  const db = { from(table) { return { select() { return this; }, eq() { return this; },
    maybeSingle: async () => table === 'users' ? { data: buyer } : { data: { locale: savedLocale, answers: saved }, error: dbError ? { code: '42703' } : null },
    insert: async () => ({ error: null }),
  }; } };
  const route = compile('src/app/api/checkout/create-full-access-session/route.ts', {
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
    'node:crypto': { randomUUID },
    '@/lib/api-security': { consumeRateLimit: async () => ({ allowed: true }), isSafeOpaqueToken: () => true,
      readJsonObject: async request => ({ ok: true, value: await request.json() }) },
    '@/lib/session': { getSession: async () => session ? { ...buyer, id: sessionId } : null },
    '@/lib/entitlements': { hasFullAccess: async () => full, hasSelfReportAccess: async () => selfReport,
      hasPremiumBundleAccess: async () => premium, getAccessPurchaseEntitlements: async () => ({ full: purchaseFull, selfReport, premiumBundle: premium }) },
    '@/lib/access-products': policy,
    '@/lib/result-upgrade': answersLib,
    '@/lib/thirty-two-types': { allThirtyTwoTypeIds: () => [] },
    '@/lib/stripe-server': { getStripe: () => stripe, getFullAccessPriceId: () => 'price_full_4900' },
    '@/lib/origin-check': { checkOrigin: () => ({ ok: true }) },
    '@/lib/supabase-server': { supabaseAdmin: db },
    '@/lib/paywall-source': { DIRECT_PAYWALL_SOURCE: 'direct', normalizePaywallSource: x => x ?? 'direct' },
    '@/lib/checkout-measurement': { normalizeCheckoutAttemptId: x => x },
    '@/lib/checkout-cancel-signature': { signCheckoutCancellation: () => 'isolated-signature' },
  });
  const request = new Request('http://localhost/api/checkout/create-full-access-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: 'ko', owner_token: 'owner-token', product: 'premium_bundle', paywall_source: 'result_upgrade_after_answers', paywall_version: policy.KO_SINGLE_FULL_ACCESS_PAYWALL_VERSION, ...body }) });
  const response = await route.POST(request);
  return { status: response.status, data: await response.json(), calls };
}
const upgrade = await checkout();
assert.equal(upgrade.status, 200);
assert.equal(upgrade.data.amount, 8900);
assert.equal(upgrade.data.currency, 'KRW');
const params = upgrade.calls[0];
assert.equal(params.mode, 'payment');
assert.equal(params.line_items[0].price_data.unit_amount, 8900);
assert.equal(params.line_items[0].price_data.currency, 'krw');
assert.equal(params.line_items[0].price_data.tax_behavior, 'inclusive');
assert.equal(params.line_items[0].price_data.product_data.name, '결과 업그레이드');
assert.equal(params.discounts, undefined);
assert.equal(params.metadata.offer_version, policy.KO_RESULT_UPGRADE_OFFER_VERSION);
assert.equal(params.metadata.course_price_minor, '8900');
assert.equal(params.metadata.upgrade_from, 'full_access');
assert.match(params.success_url, /\/ko\/me\/owner-token/);
assert.equal(params.metadata.locale, 'ko');
for (const [input, expected] of [
  [{ full: false }, 409], [{ full: false, selfReport: true }, 409],
  [{ session: false }, 403], [{ sessionId: 'another-owner' }, 403],
  [{ saved: answers.slice(0, 4) }, 409], [{ savedLocale: 'ja' }, 409],
  [{ dbError: true }, 503], [{ premium: true }, 409],
  [{ product: 'self_report' }, 400], [{ paywall_source: 'direct' }, 400],
  [{ paywall_version: 'legacy' }, 409],
]) {
  const result = await checkout(input);
  assert.equal(result.status, expected, JSON.stringify(input));
  assert.equal(result.calls.length, 0, 'Rejected checkout must never call Stripe');
}
const full = await checkout({ full: false, product: 'full_access', paywall_source: 'direct' });
assert.equal(full.status, 200);
assert.equal(full.data.amount, 4900);
assert.equal(full.calls[0].line_items[0].price_data.unit_amount, 12900);
assert.equal(full.calls[0].discounts[0].coupon, 'full-access-anchor-off8000-krw');
assert.equal(full.calls[0].metadata.offer_version, undefined);
const ja = await checkout({ locale: 'ja', paywall_version: policy.THREE_COURSE_PAYWALL_VERSION });
assert.equal(ja.data.amount, 899);
assert.equal(ja.calls[0].metadata.offer_version, policy.RESULT_UPGRADE_OFFER_VERSION);
console.log('Korean result upgrade regression passed: fixed 8,900 KRW checkout, purchaser/owner/answer restrictions, Korean copy, and unchanged KR/JP pricing.');

const legacyJa = await checkout({ locale: 'ja', purchaseFull: false, paywall_version: policy.THREE_COURSE_PAYWALL_VERSION });
assert.equal(legacyJa.data.amount, 899);
assert.equal(legacyJa.calls[0].line_items[0].price_data.unit_amount, 899);
assert.equal(legacyJa.calls[0].discounts, undefined);

const messages = [];
const email = compile('src/lib/email.ts', {
  '@/i18n/th/email-templates': {},
  'resend': { Resend: class { emails = { send: async message => { messages.push(message); return {}; } }; } },
  '@/lib/access-products': policy,
  './site-url': { resolveSiteUrl: () => 'https://isolated.example.test' },
}, { RESEND_API_KEY: 'test-only-not-a-secret', RESEND_FROM_EMAIL: 'sender@example.test' });
await email.sendDetailedReportEmail({ to: 'owner@example.test', ownerToken: 'owner-token', ownerName: '<script>alert(1)</script>', locale: 'ko', product: 'premium_bundle', resultUpgrade: true, purchaseAmountMinor: 8900 });
assert.equal(messages.length, 1);
assert.match(messages[0].subject, /결과 업그레이드/);
assert.match(messages[0].text, /₩8,900/);
assert.match(messages[0].text, /5개 답변/);
assert.match(messages[0].text, /로그인/);
assert.match(messages[0].text, /30일/);
assert.match(messages[0].html, /&lt;script&gt;/);
assert(!messages[0].html.includes('<script>'));
assert(!messages[0].text.includes('프리미엄 코스'));
await email.sendDetailedReportEmail({ to: 'owner@example.test', ownerToken: 'owner-token', locale: 'ko', product: 'full_access', purchaseAmountMinor: 4900 });
assert.match(messages[1].text, /₩4,900/);
assert.match(messages[1].text, /완전판 코스/);
console.log('Receipt regression passed: Korean upgrade details and escaped HTML; existing complete-edition receipt preserved.');

async function saveAnswers({ ownerToken = 'owner-token', locale = 'ko', values = answers, loggedIn = true, fullAccess = true, state = null } = {}) {
  const saves = [];
  const session = { id: 'owner', owner_token: 'owner-token' };
  const route = compile('src/app/api/result-upgrade/answers/route.ts', {
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
    '@/lib/api-security': { consumeRateLimit: async () => ({ allowed: true }), readJsonObject: async request => ({ ok: true, value: await request.json() }) },
    '@/lib/entitlements': { hasFullAccess: async () => fullAccess },
    '@/lib/origin-check': { checkOrigin: () => ({ ok: true }) },
    '@/lib/session': { getSession: async () => loggedIn ? session : null },
    '@/lib/result-upgrade': answersLib,
    '@/lib/result-upgrade-server': { isMissingResultUpgradeTable: () => false, resolveResultUpgradeBase: async () => ({ sourceTypeId: 'sparkle-dolphin__N', sourceCharacterPath: '/existing.webp' }) },
    '@/lib/supabase-server': { supabaseAdmin: { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: state ? { state } : null }), upsert: async value => { saves.push(value); return { error: null }; } }; } } },
  });
  const response = await route.POST(new Request('http://localhost/api/result-upgrade/answers', { method: 'POST', body: JSON.stringify({ ownerToken, locale, answers: values }) }));
  return { status: response.status, saves };
}
const savedKo = await saveAnswers();
assert.equal(savedKo.status, 200);
assert.equal(savedKo.saves[0].locale, 'ko');
assert.equal(savedKo.saves[0].user_id, 'owner');
assert.equal(savedKo.saves[0].state, 'answers_ready');
assert.equal(savedKo.saves[0].answers.length, 5);
for (const [input, expected] of [[{ loggedIn: false }, 401], [{ fullAccess: false }, 403], [{ ownerToken: 'another-owner' }, 403], [{ locale: 'en' }, 400], [{ values: answers.slice(0, 4) }, 400], [{ state: 'ready' }, 409]]) {
  const result = await saveAnswers(input);
  assert.equal(result.status, expected);
  assert.equal(result.saves.length, 0);
}
console.log('Answer-saving regression passed: Korean locale, owner and purchase requirements, five valid answers, completed-result protection.');

const koreanTypes = compile('src/i18n/ko/result.ts', {});
const prompts = [];
const usageRecords = [];
const generation = compile('src/lib/result-upgrade/generate.ts', {
  'server-only': {},
  'node:crypto': { randomUUID },
  '@ai-sdk/anthropic': { anthropic: model => model },
  'ai': { jsonSchema: schema => schema, Output: { object: options => options }, generateText: async options => { prompts.push(options); return { output: { personalizedTypeName: 'test' }, response: { id: 'isolated' }, usage: {}, finishReason: 'stop' }; } },
  '@/i18n/ko/result': koreanTypes,
  '@/lib/ai-usage.mjs': { aiSdkUsage: () => ({}), gatewayGenerationId: () => 'isolated', recordAiUsage: async (_db, record) => { usageRecords.push(record); } },
  '@/lib/site-url': { resolveSiteUrl: () => 'https://isolated.example.test' },
  '@/lib/supabase-server': { supabaseAdmin: {} },
  '@/lib/thirty-two-types': { allThirtyTwoTypeIds: () => Object.keys(koreanTypes.KO_RESULT_TYPES), thirtyTwoEssence: () => '日本語の元タイプ名' },
  '@/lib/sixteen-types': { sixteenTypes: {} },
  '@/lib/result-upgrade': answersLib,
}, {}, ['generatePersonalizedCopy']);
await generation.generatePersonalizedCopy({ user_id: 'owner', locale: 'ko', source_type_id: 'sparkle-dolphin__N', answers }, null, {}, 'isolated-generation', 1);
assert.match(prompts[0].system, /自然な韓国語だけ/);
assert.match(prompts[0].prompt, /韓国語版/);
assert(prompts[0].prompt.includes(koreanTypes.KO_RESULT_TYPES['sparkle-dolphin__N'].essence));
assert(answers.every(answer => prompts[0].prompt.includes(answer)));
assert(answersLib.resultUpgradeQuestions('ko').every(question => prompts[0].prompt.includes(question)));
assert.equal(prompts[0].output.schema.properties.reading.properties.sections.minItems, 5);
assert.equal(prompts[0].output.schema.properties.reading.properties.sections.maxItems, 5);
assert.equal(usageRecords[0].metadata.locale, 'ko');
await generation.generatePersonalizedCopy({ user_id: 'owner', locale: 'ja', source_type_id: 'sparkle-dolphin__N', answers }, null, {}, 'isolated-generation-ja', 1);
assert(!prompts[1].system.includes('韓国語だけ'));
assert(prompts[1].prompt.includes('日本語の元タイプ名'));
console.log('Generation prompt regression passed: Korean-only output instruction, Korean source type and five answers, five chapters and locale tracking; Japanese prompt preserved. No AI calls sent.');
