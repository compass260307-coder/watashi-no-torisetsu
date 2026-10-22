import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";

function compile(path, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Buffer,
    URL,
    Date,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { error() {} },
    process: { env: {} },
    require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import ${name}`);
    },
    ...globals,
  });
  return exports;
}

const now = Date.now();
const day = 86_400_000;
const codes = [
  "D9V8IIBC77UFF28NGHK0",
  "DAUFBCRC77U5PB60GLP0",
  "DAV7P7RC77UA36CC79E0",
];
const settings = compile("src/lib/purchase-conversion-config.ts", {
  "server-only": {},
});
assert.equal(
  settings.purchaseEventExpiryReason(
    "meta",
    new Date(now - 7 * day + 1).toISOString(),
    now,
  ),
  null,
);
assert.match(
  settings.purchaseEventExpiryReason(
    "meta",
    new Date(now - 7 * day).toISOString(),
    now,
  ),
  /event_expired/,
);
assert.match(
  settings.purchaseEventExpiryReason(
    "tiktok",
    new Date(now - 7 * day).toISOString(),
    now,
  ),
  /local 7-day/,
);
assert.match(
  settings.purchaseEventExpiryReason("meta", "bad", now),
  /invalid_paid_at/,
);
assert.match(
  settings.purchaseEventExpiryReason(
    "meta",
    new Date(now + 1).toISOString(),
    now,
  ),
  /future/,
);
assert.equal(
  settings.readTikTokSettings({ TIKTOK_PIXELS: "[secret-do-not-echo" }).error,
  "TIKTOK_PIXELS must be a JSON array",
);
const partial = settings.readTikTokSettings({
  TIKTOK_PIXELS: JSON.stringify([
    { pixelCode: codes[0], accessToken: "token-a" },
    { pixelCode: codes[1] },
    { pixelCode: codes[2], accessToken: "token-c" },
  ]),
});
assert.equal(partial.pixels.size, 2);
assert.equal(partial.errors.size, 1);
const duplicate = settings.readTikTokSettings({
  TIKTOK_PIXELS: JSON.stringify([
    { pixelCode: codes[0], accessToken: "a" },
    { pixelCode: codes[0], accessToken: "b" },
    { pixelCode: codes[2], accessToken: "c" },
  ]),
});
assert.equal(duplicate.pixels.has(codes[0]), false);
assert.equal(duplicate.pixels.has(codes[2]), true);

function flow(overrides = {}, timing = {}) {
  let clock = timing.now ?? now;
  const pauses = [];
  class ClockDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  }
  const env = {
    META_PIXEL_ID: "123456",
    META_CONVERSIONS_API_TOKEN: "isolated-meta-token",
    META_GRAPH_API_VERSION: "v99.0",
    TIKTOK_PIXELS: JSON.stringify(
      codes.map((pixelCode, i) => ({
        pixelCode,
        accessToken: `isolated-token-${i}`,
      })),
    ),
    ...overrides,
  };
  const cfg = compile(
    "src/lib/purchase-conversion-config.ts",
    { "server-only": {} },
    { process: { env }, Date: ClockDate },
  );
  const outbox = new Map(),
    events = new Map(),
    calls = [],
    retrievals = [];
  const faults = new Map();
  let nextId = 0,
    failCompletion = false,
    beforeRetrieve;
  const purchase = {
    session: {
      id: "cs_live_isolated",
      amount_total: 499,
      currency: "jpy",
      metadata: {
        locale: "ja",
        fbp: "isolated-fbp",
        fbc: "isolated-fbc",
        ttclid: "isolated-click",
        ttp: "isolated-cookie",
      },
      customer_details: { email: " TEST@EXAMPLE.TEST " },
    },
    userId: "isolated-user",
    product: "full_access",
    paidAt: new Date(now - 1000).toISOString(),
  };
  function query(table) {
    const conditions = [];
    let action = "select",
      input,
      opts;
    const rows = () =>
      [...(table === "events" ? events : outbox).values()].filter((r) =>
        conditions.every((fn) => fn(r)),
      );
    const execute = () => {
      if (action === "upsert") {
        assert.equal(
          opts.onConflict,
          "provider,destination_id,stripe_session_id",
        );
        assert.equal(opts.ignoreDuplicates, true);
        for (const row of input) {
          if (
            ![...outbox.values()].some(
              (r) =>
                r.provider === row.provider &&
                r.destination_id === row.destination_id &&
                r.stripe_session_id === row.stripe_session_id,
            )
          ) {
            const id = `row-${++nextId}`;
            outbox.set(id, { ...structuredClone(row), id });
          }
        }
        return { error: null };
      }
      if (action === "insert") {
        if (events.has(input.id)) return { error: { code: "23505" } };
        events.set(input.id, structuredClone(input));
        return { error: null };
      }
      if (action === "update") {
        if (failCompletion && input.status === "sent") {
          failCompletion = false;
          return { error: { message: "isolated completion failure" } };
        }
        for (const row of rows()) Object.assign(row, structuredClone(input));
        return { error: null };
      }
      return { data: rows()[0] ?? null, error: null };
    };
    return {
      select() {
        return this;
      },
      in(key, values) {
        conditions.push((r) => values.includes(r[key]));
        return this;
      },
      lt(key, value) {
        conditions.push((r) => Date.parse(r[key]) < Date.parse(value));
        return this;
      },
      gt(key, value) {
        conditions.push((r) => Date.parse(r[key]) > Date.parse(value));
        return this;
      },
      limit() {
        return this;
      },
      eq(key, value) {
        conditions.push((r) => r[key] === value);
        return this;
      },
      maybeSingle: async () => execute(),
      insert(value) {
        action = "insert";
        input = value;
        return this;
      },
      update(value) {
        action = "update";
        input = value;
        return this;
      },
      upsert(value, options) {
        action = "upsert";
        input = value;
        opts = options;
        return this;
      },
      then(resolve, reject) {
        return Promise.resolve().then(execute).then(resolve, reject);
      },
    };
  }
  const db = {
    from: query,
    async rpc(name, args) {
      assert.ok(
        [
          "claim_due_purchase_conversion_deliveries",
          "claim_due_configured_purchase_conversion_deliveries",
        ].includes(name),
      );
      if (name === "claim_due_configured_purchase_conversion_deliveries")
        assert.equal(typeof args.p_include_meta, "boolean");
      const rows = [...outbox.values()]
        .filter(
          (r) =>
            ["pending", "failed"].includes(r.status) &&
            Date.parse(r.next_attempt_at) <= clock &&
            (args.p_include_meta !== false || r.provider !== "meta") &&
            (!args.p_session_id || r.stripe_session_id === args.p_session_id),
        )
        .slice(0, args.p_limit);
      for (const r of rows) {
        r.status = "processing";
        r.attempts++;
      }
      return { data: structuredClone(rows), error: null };
    },
  };
  const service = compile(
    "src/lib/server-purchase-conversions.ts",
    {
      "server-only": {},
      "node:crypto": crypto,
      "@/lib/meta-purchase": { isMetaPurchaseProduct: () => false },
      "@/lib/purchase-conversion-config": cfg,
      "@/lib/site-url": { resolveSiteUrl: () => "https://example.test" },
      "@/lib/stripe-server": {
        getStripe: () => ({
          checkout: {
            sessions: {
              retrieve: async (id, params, options) => {
                assert.equal(options.timeout, 10_000);
                assert.equal(options.maxNetworkRetries, 0);
                retrievals.push(id);
                if (beforeRetrieve) beforeRetrieve();
                return { ...structuredClone(purchase.session), id };
              },
            },
          },
        }),
      },
      "@/lib/supabase-server": { supabaseAdmin: db },
    },
    {
      process: { env },
      Date: ClockDate,
      setTimeout(fn, ms) {
        if (ms === 200) {
          pauses.push(clock);
          clock += ms;
          return setTimeout(fn, 0);
        }
        return setTimeout(fn, ms);
      },
      fetch: async (url, init) => {
        const body = JSON.parse(init.body);
        const code = body.event_source_id ?? "meta";
        calls.push({ code, body, headers: init.headers });
        const fault = faults.get(code);
        if (fault instanceof Error) throw fault;
        return {
          ok: true,
          status: 200,
          text: async () =>
            fault ??
            JSON.stringify(
              code === "meta" ? { events_received: 1 } : { code: 0 },
            ),
        };
      },
    },
  );
  return {
    service,
    pauses,
    advance(ms) {
      clock += ms;
    },
    makeDue() {
      for (const row of outbox.values())
        row.next_attempt_at = new Date(clock - 1000).toISOString();
    },
    cfg,
    env,
    purchase,
    outbox,
    events,
    calls,
    faults,
    retrievals,
    failCompletion() {
      failCompletion = true;
    },
    beforeRetrieve(fn) {
      beforeRetrieve = fn;
    },
  };
}

const f = flow();
await f.service.enqueueServerPurchaseConversions(f.purchase);
await f.service.enqueueServerPurchaseConversions(f.purchase);
assert.equal(f.outbox.size, 4);
f.faults.set(
  codes[1],
  JSON.stringify({ code: 40001, message: "isolated-token-1" }),
);
let summary = await f.service.deliverServerPurchaseConversions(f.purchase);
assert.equal(summary.sent, 3);
assert.equal(summary.failed, 1);
assert.equal(f.calls.length, 4);
for (const c of f.calls) {
  assert.equal(c.body.data[0].event_id, f.purchase.session.id);
  assert.equal(
    c.body.data[0].event_time,
    Math.floor(Date.parse(f.purchase.paidAt) / 1000),
  );
  const value =
    c.code === "meta"
      ? c.body.data[0].custom_data.value
      : c.body.data[0].properties.value;
  assert.equal(value, 499);
}
assert.equal(
  f.calls.find((c) => c.code === codes[0]).headers["Access-Token"],
  "isolated-token-0",
);
assert.equal(
  [...f.events.values()].filter((e) => e.metadata.pixel_code).length,
  2,
);
assert.ok(
  ![...f.outbox.values()].some((r) =>
    r.last_error?.includes("isolated-token-1"),
  ),
);
f.faults.clear();
f.makeDue();
summary = await f.service.processDueServerPurchaseConversions();
assert.equal(summary.sent, 1);
assert.equal(f.retrievals.length, 1);
assert.equal(f.calls.length, 5);
await f.service.enqueueServerPurchaseConversions(f.purchase);
assert.equal(
  [...f.outbox.values()].every((r) => r.status === "sent"),
  true,
);

const missing = flow({
  TIKTOK_PIXELS: JSON.stringify([
    { pixelCode: codes[0], accessToken: "only-first" },
    { pixelCode: codes[2], accessToken: "only-third" },
  ]),
});
await missing.service.enqueueServerPurchaseConversions(missing.purchase);
summary = await missing.service.deliverServerPurchaseConversions(
  missing.purchase,
);
assert.equal(summary.sent, 3);
assert.equal(summary.failed, 1);

const malformed = flow({ TIKTOK_PIXELS: "[do-not-leak-token" });
await malformed.service.enqueueServerPurchaseConversions(malformed.purchase);
summary = await malformed.service.deliverServerPurchaseConversions(
  malformed.purchase,
);
assert.equal(summary.sent, 1);
assert.equal(summary.failed, 3);
assert.ok(
  ![...malformed.outbox.values()].some((r) =>
    r.last_error?.includes("do-not-leak-token"),
  ),
);

const legacy = flow();
const hex = crypto
  .createHash("sha256")
  .update(`server_purchase_conversion\0tiktok\0${legacy.purchase.session.id}`)
  .digest("hex")
  .slice(0, 32);
const auditId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
legacy.events.set(auditId, { id: auditId });
await legacy.service.enqueueServerPurchaseConversions(legacy.purchase);
summary = await legacy.service.deliverServerPurchaseConversions(
  legacy.purchase,
);
assert.equal(summary.sent, 4);
assert.equal(legacy.calls.length, 3);
assert.equal(
  legacy.calls.some((c) => c.code === codes[0]),
  false,
);
assert.equal(
  legacy.calls.some((c) => c.code === codes[1]),
  true,
);

const expired = flow();
expired.purchase.paidAt = new Date(now - 8 * day).toISOString();
await expired.service.enqueueServerPurchaseConversions(expired.purchase);
summary = await expired.service.processDueServerPurchaseConversions();
assert.equal(summary.expired, 4);
assert.equal(expired.calls.length, 0);
assert.equal(expired.retrievals.length, 0);
assert.equal(
  [...expired.outbox.values()].every(
    (r) => r.status === "expired" && r.last_error.startsWith("event_expired"),
  ),
  true,
);

const badAck = flow();
await badAck.service.enqueueServerPurchaseConversions(badAck.purchase);
badAck.faults.set(codes[0], "not JSON");
badAck.faults.set(codes[1], "{}");
badAck.faults.set("meta", "{}");
summary = await badAck.service.deliverServerPurchaseConversions(
  badAck.purchase,
);
assert.equal(summary.failed, 3);
assert.equal(summary.sent, 1);

const recovery = flow();
await recovery.service.enqueueServerPurchaseConversions(recovery.purchase);
recovery.failCompletion();
await recovery.service.deliverServerPurchaseConversions(recovery.purchase);
const sentCalls = recovery.calls.length;
recovery.makeDue();
await recovery.service.processDueServerPurchaseConversions();
assert.equal(recovery.calls.length, sentCalls);

const retrieval = flow();
await retrieval.service.enqueueServerPurchaseConversions(retrieval.purchase);
summary = await retrieval.service.processDueServerPurchaseConversions();
assert.equal(summary.sent, 4);
assert.equal(retrieval.retrievals.length, 1);

// Missing, partial and whitespace-only Meta configuration must consume no leases.
for (const vars of [
  {
    META_PIXEL_ID: "",
    META_CONVERSIONS_API_TOKEN: "",
    META_GRAPH_API_VERSION: "",
  },
  { META_PIXEL_ID: " " },
  { META_CONVERSIONS_API_TOKEN: "" },
  { META_GRAPH_API_VERSION: "" },
]) {
  const disabled = flow(vars);
  await disabled.service.enqueueServerPurchaseConversions(disabled.purchase);
  const meta = [...disabled.outbox.values()].find((r) => r.provider === "meta");
  meta.status = "failed";
  meta.attempts = 7;
  const before = structuredClone(meta);
  const result = await disabled.service.processDueServerPurchaseConversions(3);
  assert.equal(result.sent, 3);
  assert.deepEqual(meta, before);
  assert.ok(disabled.calls.every((c) => c.code !== "meta"));
  Object.assign(disabled.env, {
    META_PIXEL_ID: "123",
    META_CONVERSIONS_API_TOKEN: "isolated",
    META_GRAPH_API_VERSION: "v99.0",
  });
  assert.equal(
    (await disabled.service.processDueServerPurchaseConversions()).sent,
    1,
  );
  assert.equal(meta.status, "sent");
  assert.equal(meta.attempts, 8);
}

// A failed delivery keeps its backoff rather than being re-claimed by the next batch.
const retryBackoff = flow({ META_PIXEL_ID: "" });
await retryBackoff.service.enqueueServerPurchaseConversions(
  retryBackoff.purchase,
);
retryBackoff.faults.set(codes[1], new Error("isolated provider failure"));
const backoffResult =
  await retryBackoff.service.processDueServerPurchaseConversions(100);
assert.equal(backoffResult.claimed, 3);
assert.equal(backoffResult.sent, 2);
assert.equal(backoffResult.failed, 1);
assert.equal(retryBackoff.calls.length, 3);
assert.equal(
  [...retryBackoff.outbox.values()].find((r) => r.destination_id === codes[1])
    .attempts,
  1,
);

const catchupNow = Date.parse("2026-10-22T04:00:00Z");
function backlog(paidAt) {
  const worker = flow({ META_PIXEL_ID: "" }, { now: catchupNow });
  for (let i = 0; i < 120; i++)
    worker.outbox.set(`backlog-${i}`, {
      id: `backlog-${i}`,
      provider: "tiktok",
      destination_id: codes[i % 3],
      stripe_session_id: `cs_isolated_backlog_${i}`,
      user_id: null,
      product: "full_access",
      paid_at: paidAt,
      status: "pending",
      attempts: 0,
      next_attempt_at: "2026-10-22T03:00:00Z",
      last_error: null,
    });
  return worker;
}
const catchup = backlog("2026-10-22T02:00:00Z");
assert.equal(
  (await catchup.service.processDueServerPurchaseConversions()).sent,
  100,
);
assert.equal(catchup.calls.length, 100);
assert.equal(
  [...catchup.outbox.values()].filter((r) => r.status === "pending").length,
  20,
);
assert.equal(catchup.pauses.length, 24);
assert.equal(
  (await catchup.service.processDueServerPurchaseConversions()).sent,
  20,
);
// Once only new purchases remain, the default automatically returns to 25.
for (const row of catchup.outbox.values()) {
  row.status = "pending";
  row.paid_at = "2026-10-22T03:30:00Z";
}
assert.equal(
  (await catchup.service.processDueServerPurchaseConversions()).claimed,
  25,
);
const regular = backlog("2026-10-22T03:30:00Z");
assert.equal(
  (await regular.service.processDueServerPurchaseConversions()).sent,
  25,
);
const agedCohort = backlog("2026-10-22T02:00:00Z");
agedCohort.advance(8 * day);
assert.equal(
  (await agedCohort.service.processDueServerPurchaseConversions()).claimed,
  25,
);
assert.equal(agedCohort.calls.length, 0);
const budget = backlog("2026-10-22T02:00:00Z");
budget.beforeRetrieve(() => budget.advance(240_000));
assert.equal(
  (await budget.service.processDueServerPurchaseConversions()).claimed,
  4,
);
assert.equal(
  [...budget.outbox.values()].filter(
    (r) => r.status === "pending" && r.attempts === 0,
  ).length,
  116,
);
assert.ok([...budget.outbox.values()].every((r) => r.status !== "processing"));

let runs = 0;
const route = compile(
  "src/app/api/cron/purchase-conversions/route.ts",
  {
    "node:crypto": crypto,
    "next/server": { NextResponse },
    "@/lib/server-purchase-conversions": {
      processDueServerPurchaseConversions: async (...args) => {
        assert.equal(args.length, 0);
        runs++;
        return { sent: 0 };
      },
    },
    "@/lib/line-upgrade-fulfillment": {
      processDueLineResultUpgrades: async () => ({}),
    },
  },
  { process: { env: { CRON_SECRET: "isolated-cron-secret" } } },
);
assert.equal(
  (
    await route.GET(
      new NextRequest("https://example.test/api/cron/purchase-conversions"),
    )
  ).status,
  401,
);
assert.equal(runs, 0);
assert.equal(
  (
    await route.GET(
      new NextRequest("https://example.test/api/cron/purchase-conversions", {
        headers: { authorization: "Bearer isolated-cron-secret" },
      }),
    )
  ).status,
  200,
);
assert.equal(runs, 1);
console.log(
  "PASS: pixel isolation, partial/malformed config, deduplication, immutable event IDs/times, expiry before Stripe/HTTP, acknowledgements, audit recovery, shared Stripe lookup, Meta cron exclusion/resumption, finite 100-job catch-up, pacing/time budget, and cron authorization (all mocked; no live sends).",
);
