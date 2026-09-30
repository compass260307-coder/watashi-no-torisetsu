// Runs actual TypeScript modules with deterministic timers / in-memory DB.
// No browser, network, credentials or production data are used.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function loader(globals = {}, mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/components/") || name === "next/link") return { default: () => null };
      if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      const resolved = name.startsWith("@/")
        ? path.join(root, "src", name.slice(2))
        : path.resolve(path.dirname(file), name);
      return load(`${resolved}.ts`);
    };
    vm.runInNewContext(js, {
      module, exports: module.exports, require: localRequire,
      AbortController, Response, URL, console, ...globals,
    }, { filename: file });
    return module.exports;
  }
  return load;
}

function pollingEnvironment(hidden = false, mocks = {}) {
  let now = 1, sequence = 0;
  const timers = new Map();
  const document = new EventTarget();
  document.hidden = hidden;
  const calls = [];
  let respond = async () => Response.json({ state: "pending" });
  const locations = [];
  const globals = {
    document,
    Date: class extends Date { static now() { return now; } },
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options = {}) { calls.push({ url, ...options }); return respond(url, options); },
  };
  globals.window = { ...globals, location: { href: "http://local.test/aisho?paid=1&a=a&b=b", replace: (url) => locations.push(url) } };
  const load = loader(globals, mocks);
  const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  return {
    load, calls, timers, locations,
    respond(fn) { respond = fn; },
    hide(value) { document.hidden = value; document.dispatchEvent(new Event("visibilitychange")); },
    async advance(ms) {
      const end = now + ms;
      await flush();
      for (;;) {
        const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]); next[1].fn();
        await flush();
      }
      now = end; await flush();
    },
  };
}

test("hidden page makes no requests; visibility resumes immediately without overlapping an active request", async () => {
  const env = pollingEnvironment(true);
  const { startVisiblePolling } = env.load("src/lib/visible-polling.ts");
  let count = 0, finish, signal;
  const stop = startVisiblePolling(async (s) => {
    count++; signal = s;
    await new Promise((resolve) => { finish = resolve; });
    return 100;
  });
  await env.advance(60_000); assert.equal(count, 0);
  env.hide(false); await env.advance(0); assert.equal(count, 1);
  env.hide(true); env.hide(false); await env.advance(1000); assert.equal(count, 1);
  finish(); await env.advance(0);
  env.hide(true); await env.advance(60_000); assert.equal(count, 1);
  env.hide(false); await env.advance(0); assert.equal(count, 2);
  stop(); assert.equal(signal.aborted, true);
  finish(); await env.advance(60_000); assert.equal(count, 2);
  assert.equal(env.timers.size, 0);
});

test("terminal completion removes the visibility listener; no resumed work", async () => {
  const env = pollingEnvironment();
  let count = 0;
  env.load("src/lib/visible-polling.ts").startVisiblePolling(async () => { count++; return false; });
  await env.advance(0); env.hide(true); env.hide(false); await env.advance(60_000);
  assert.equal(count, 1); assert.equal(env.timers.size, 0);
});

function watch(env, force = false) {
  const state = { ready: 0, failed: 0 };
  state.stop = env.load("src/lib/result-upgrade-polling.ts").watchResultUpgrade({
    force,
    onReady: () => state.ready++, onFailed: () => state.failed++,
  });
  return state;
}

for (const terminal of ["ready", "failed", "no_answers", "locked", "unpurchased"]) {
  test(`upgrade ${terminal} stops status checks and never re-submits generation`, async () => {
    const env = pollingEnvironment();
    env.respond(async (url) => Response.json({ state: url.endsWith("generate") ? "pending" : terminal }));
    const result = watch(env);
    await env.advance(600_000);
    assert.equal(env.calls.length, 2);
    assert.equal(result.ready, terminal === "ready" ? 1 : 0);
    assert.equal(result.failed, terminal === "ready" ? 0 : 1);
  });
}

test("manual retry tolerates an old failed row until after() starts, and sends force only once", async () => {
  const env = pollingEnvironment();
  const statuses = ["failed", "generating", "ready"];
  env.respond(async (url) => Response.json({ state: url.endsWith("generate") ? "pending" : statuses.shift() }));
  const result = watch(env, true);
  await env.advance(60_000);
  assert.equal(result.ready, 1); assert.equal(result.failed, 0);
  const posts = env.calls.filter((call) => call.method === "POST");
  assert.equal(posts.length, 1); assert.equal(JSON.parse(posts[0].body).force, true);
});

test("an accepted retry that never starts still stops after its bounded grace", async () => {
  const env = pollingEnvironment();
  env.respond(async (url) => Response.json({ state: url.endsWith("generate") ? "pending" : "failed" }));
  const result = watch(env, true);
  await env.advance(60_000);
  assert.equal(result.failed, 1);
  assert.equal(env.calls.filter((c) => c.method === "POST").length, 1);
  assert.equal(env.timers.size, 0);
});

test("initial hidden time does not consume the generation timeout; hidden after kick defers GET", async () => {
  const env = pollingEnvironment(true);
  env.respond(async (url) => {
    if (url.endsWith("generate")) env.hide(true);
    return Response.json({ state: "pending" });
  });
  const result = watch(env);
  await env.advance(600_000); assert.equal(env.calls.length, 0);
  env.hide(false); await env.advance(0);
  assert.equal(env.calls.length, 1); assert.equal(result.failed, 0);
  env.hide(false); await env.advance(0);
  assert.equal(env.calls.length, 2); assert.equal(result.failed, 0);
  result.stop();
});

test("network failures stop after five reads; successful pending also has a finite deadline", async () => {
  for (const failing of [true, false]) {
    const env = pollingEnvironment();
    env.respond(async (url) => {
      if (failing && url.endsWith("status")) throw new Error("offline");
      return Response.json({ state: "pending" });
    });
    const result = watch(env); await env.advance(600_000);
    assert.equal(result.failed, 1);
    const reads = env.calls.filter((c) => c.url.endsWith("status")).length;
    if (failing) assert.equal(reads, 5);
    else assert.ok(reads < 45, `pending read count: ${reads}`);
    assert.equal(env.timers.size, 0);
  }
});

test("401 stops immediately and an unmounted delayed response cannot navigate", async () => {
  const env = pollingEnvironment();
  env.respond(async (url) => url.endsWith("status") ? new Response(null, { status: 401 }) : Response.json({ state: "pending" }));
  const denied = watch(env); await env.advance(60_000);
  assert.equal(denied.failed, 1); assert.equal(env.calls.length, 2);

  const slow = pollingEnvironment(); let resolve;
  slow.respond(async (url) => url.endsWith("status") ? new Promise((r) => { resolve = r; }) : Response.json({ state: "pending" }));
  const disposed = watch(slow); await slow.advance(0); disposed.stop();
  resolve(Response.json({ state: "ready" })); await slow.advance(60_000);
  assert.equal(disposed.ready, 0); assert.equal(disposed.failed, 0);
  assert.equal(slow.calls.at(-1).signal.aborted, true);
});

function statusEnvironment(users, payments = [], fail = () => false) {
  const queries = [], creditCalls = [];
  const db = { from(table) {
    const filters = []; let single = false, limit = Infinity, count = false;
    const q = {
      select(_columns, options) { count = options?.head === true; return q; },
      eq(key, value) { filters.push((r) => r[key] === value); return q; },
      in(key, values) { filters.push((r) => values.includes(r[key])); return q; },
      order() { return q; }, limit(n) { limit = n; return q; },
      maybeSingle() { single = true; return q; },
      then(resolve, reject) {
        queries.push(table);
        const rows = (table === "users" ? users : payments).filter((r) => filters.every((f) => f(r))).slice(0, limit);
        return Promise.resolve(fail(table) ? { data: null, error: { message: "unavailable" } } : {
          data: count ? null : single ? rows[0] ?? null : rows,
          count: count ? rows.length : null, error: null,
        }).then(resolve, reject);
      },
    }; return q;
  } };
  const load = loader({}, {
    "./supabase-server": { supabaseAdmin: db },
    "@/lib/supabase-server": { supabaseAdmin: db },
    "next/server": { NextResponse: { json: (data, options) => ({ data, ...options }) } },
    "@/lib/hoshiyomi/store": { ensureHoshiyomiCreditsFromPurchase: async (id) => {
      creditCalls.push(id); return { available: true, data: { total: 30 } };
    } },
  });
  const GET = load("src/app/api/checkout/full-access-status/route.ts").GET;
  return { queries, creditCalls, load,
    async get(token = "owner") { return GET({ nextUrl: new URL(`http://local.test/?owner_token=${token}`) }); },
  };
}
const user = (extra = {}) => ({ id: "u", owner_token: "owner", plan: "free", email: null, unmei: false, ...extra });
const payment = (kind, metadata = {}, extra = {}) => ({ id: "p", user_id: "u", status: "completed", payment_kind: kind, metadata, ...extra });
const locked = { full: false, selfReport: false, friend: false, premiumBundle: false, astrologer: false, unmei: false, tarot: false };
const plain = (data) => JSON.parse(JSON.stringify(data));

test("status preserves locked output, uses 9 DB reads, and does no credit restoration for unpaid visitors", async () => {
  const env = statusEnvironment([user()]); const response = await env.get();
  assert.deepEqual(plain(response.data), locked);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.equal(env.queries.length, 9); assert.equal(env.creditCalls.length, 0);
  const email = statusEnvironment([user({ email: "same@example.test" }), user({ id: "v", owner_token: "other", email: "same@example.test" })]);
  assert.deepEqual(plain((await email.get()).data), locked);
  assert.equal(email.queries.length, 16);
});

test("a different request sees a completed purchase and a subsequent refund immediately", async () => {
  const users = [user()], payments = [];
  const env = statusEnvironment(users, payments);
  assert.equal((await env.get()).data.full, false);
  payments.push(payment("premium_bundle"));
  const notYetApplied = (await env.get()).data;
  assert.equal(notYetApplied.premiumBundle, true);
  assert.equal(notYetApplied.full, false); assert.equal(notYetApplied.astrologer, false);
  assert.equal(env.creditCalls.length, 1, "restore credits even before users.plan updates");
  users[0].plan = "full";
  assert.equal((await env.get()).data.astrologer, true);
  payments[0].status = "refunded"; users[0].plan = "free";
  assert.deepEqual(plain((await env.get()).data), locked);
});

test("legacy full, standalone friend unlock and self-report purchase policies remain intact", async () => {
  const legacy = (await statusEnvironment([user({ plan: "full" })]).get()).data;
  assert.equal(legacy.selfReport, true); assert.equal(legacy.friend, true); assert.equal(legacy.unmei, true);
  const tako = (await statusEnvironment([user()], [payment("tako_unlock")]).get()).data;
  assert.equal(tako.friend, true); assert.equal(tako.full, false);
  const env = statusEnvironment([user()]);
  const policies = env.load("src/lib/access-products.ts");
  for (const [policy, expected] of [[undefined, true], [policies.FRIEND_ACCESS_POLICY_FULL_ONLY, false]]) {
    const result = (await statusEnvironment([user()], [payment("self_report", { friend_access_policy: policy })]).get()).data;
    assert.equal(result.selfReport, true); assert.equal(result.friend, expected);
  }
  const excluded = (await statusEnvironment([user({ plan: "full" })], [payment("full_access", { destiny_access_policy: policies.DESTINY_ACCESS_POLICY_PREMIUM_ONLY })]).get()).data;
  assert.equal(excluded.unmei, false, "purchase policy overrides legacy full fallback");
});

test("missing owner and DB errors stay locked without restoring credits", async () => {
  const env = statusEnvironment([user()], [], () => true);
  assert.deepEqual(plain((await env.get()).data), locked);
  assert.equal(env.creditCalls.length, 0);
  const missing = statusEnvironment([user()]);
  assert.deepEqual(plain((await missing.get("")).data), locked);
  assert.equal(missing.queries.length, 0);
});

// Lightweight hook host: exercises the component's real effects, cleanup and
// callbacks. This is a unit host, not a browser/React integration test.
function hookHost() {
  const cells = []; let cursor = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      cells[i] ??= { value: typeof initial === "function" ? initial() : initial };
      return [cells[i].value, (next) => { cells[i].value = typeof next === "function" ? next(cells[i].value) : next; }];
    },
    useRef(initial) { const i = cursor++; cells[i] ??= { current: initial }; return cells[i]; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!same(cells[i]?.deps, deps)) cells[i] = { value: fn, deps };
      return cells[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!same(cells[i]?.deps, deps)) effects.push(() => {
        cells[i]?.cleanup?.(); cells[i] = { deps, cleanup: fn() };
      });
    },
  };
  return {
    react,
    render(Component, props) {
      cursor = 0; effects = [];
      const result = Component(props);
      effects.forEach((fn) => fn()); return result;
    },
    unmount() { cells.forEach((cell) => cell.cleanup?.()); },
  };
}
function findButton(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "button") return node;
  for (const child of [node.props?.children].flat()) {
    const found = findButton(child); if (found) return found;
  }
  return null;
}

test("watcher failure re-render does not kick again; manual click does; server-ready props update the banner", async () => {
  const hooks = hookHost(); let refreshes = 0;
  const router = { refresh: () => refreshes++ };
  const env = pollingEnvironment(false, { react: hooks.react, "next/navigation": { useRouter: () => router } });
  const { ResultUpgradeGenerationWatcher: Component } = env.load("src/components/result-upgrade/ResultUpgradeGenerationWatcher.tsx");
  let status = "failed";
  env.respond(async (url) => Response.json({ state: url.endsWith("generate") ? "pending" : status }));
  hooks.render(Component, { initialState: "generating" }); await env.advance(0);
  const failed = hooks.render(Component, { initialState: "generating" }); await env.advance(60_000);
  assert.equal(env.calls.length, 2);
  const retry = findButton(failed); assert.ok(retry);
  retry.props.onClick(); hooks.render(Component, { initialState: "generating" });
  status = "ready"; await env.advance(0);
  assert.equal(refreshes, 1);
  assert.equal(env.calls.filter((c) => c.method === "POST").length, 2);
  const ready = hooks.render(Component, { initialState: "ready" });
  assert.match(JSON.stringify(ready), /あなた専用の結果が完成/);
  hooks.unmount();
});

test("paid watcher keeps fast confirmation and requires all original full-access entitlements", async () => {
  const hooks = hookHost(), env = pollingEnvironment(false, { react: hooks.react });
  const { PaidUnlockWatcher: Component } = env.load("src/components/result/PaidUnlockWatcher.tsx");
  let status = { full: true, astrologer: false, unmei: true, tarot: true };
  env.respond(async () => Response.json(status));
  hooks.render(Component, { ownerToken: "owner", returnTo: "aisho", product: "full_access" });
  await env.advance(1199); assert.equal(env.calls.length, 0);
  await env.advance(1); assert.equal(env.calls.length, 1); assert.equal(env.locations.length, 0);
  env.hide(true); await env.advance(60_000); assert.equal(env.calls.length, 1);
  status = { ...status, astrologer: true };
  env.hide(false); await env.advance(0);
  assert.equal(env.locations.length, 1);
  assert.equal(env.locations[0], "http://local.test/aisho?a=a&b=b");
  assert.equal(env.calls[0].cache, "no-store"); hooks.unmount();
});

test("unmounted paid watcher ignores a late unlocked response", async () => {
  const hooks = hookHost(), env = pollingEnvironment(false, { react: hooks.react });
  const Component = env.load("src/components/result/PaidUnlockWatcher.tsx").PaidUnlockWatcher;
  let resolve;
  env.respond(() => new Promise((r) => { resolve = r; }));
  hooks.render(Component, { ownerToken: "owner", product: "self_report" });
  await env.advance(1200); hooks.unmount();
  resolve(Response.json({ selfReport: true })); await env.advance(60_000);
  assert.equal(env.locations.length, 0); assert.equal(env.calls.length, 1);
});

test("Unmei checkout starts a fresh generation deadline after hidden payment confirmation", async () => {
  const hooks = hookHost(), navigations = [];
  const router = { replace: (url) => navigations.push(url) };
  const env = pollingEnvironment(false, { react: hooks.react, "next/navigation": { useRouter: () => router } });
  const Component = env.load("src/components/uranai/UnmeiCheckoutConfirming.tsx").default;
  let status = "unpurchased";
  env.respond(async () => Response.json({ state: status }));
  hooks.render(Component, { locale: "ja" }); await env.advance(0);
  env.hide(true); await env.advance(200_000);
  status = "pending"; env.hide(false); await env.advance(0);
  const waiting = hooks.render(Component, { locale: "ja" });
  assert.equal(findButton(waiting), null, "must still be generating rather than timed out");
  assert.equal(env.calls.filter((c) => c.method === "POST").length, 1);
  status = "ready"; await env.advance(2000);
  assert.deepEqual(navigations, ["/unmei"]); hooks.unmount();
});

test("Unmei generation cleanup aborts late status effects and cannot start another run", async () => {
  const hooks = hookHost(); let refreshes = 0, resolve;
  const router = { refresh: () => refreshes++ };
  const env = pollingEnvironment(false, { react: hooks.react, "next/navigation": { useRouter: () => router } });
  const Component = env.load("src/components/uranai/UnmeiClient.tsx").default;
  env.respond(async (url) => url.includes("status") ? new Promise((r) => { resolve = r; }) : Response.json({ state: "pending" }));
  hooks.render(Component, { initialState: "pending" }); await env.advance(3000);
  hooks.unmount(); resolve(Response.json({ state: "ready" })); await env.advance(240_000);
  assert.equal(refreshes, 0); assert.equal(env.calls.length, 2);
  assert.equal(env.timers.size, 0);
});
