import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "..");

function loader(globals = {}, mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
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
      module: loadedModule, exports: loadedModule.exports, require: localRequire,
      AbortController, Response, URL, console, ...globals,
    }, { filename: file });
    return loadedModule.exports;
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

function watchSpend(env, force = false) {
  const state = { ready: 0, failed: 0, blocked: [] };
  state.stop = env.load("src/lib/result-upgrade-polling.ts").watchResultUpgrade({
    force, checkBeforeKick: true,
    onReady: () => state.ready++, onFailed: () => state.failed++,
    onBlocked: (status) => state.blocked.push(status),
  });
  return state;
}

test("spend-blocked page and cooldown retry never submit generation", async () => {
  for (const [force, canRetry] of [[false, true], [true, false]]) {
    const env = pollingEnvironment();
    env.respond(async () => Response.json({ state: "blocked", canRetry, retryAt: "2026-10-13T07:00:00Z" }));
    const result = watchSpend(env, force); await env.advance(600_000);
    assert.equal(env.calls.length, 1);
    assert.equal(env.calls.filter(c => c.method === "POST").length, 0);
    assert.equal(result.blocked.length, 1); assert.equal(result.failed, 0);
    assert.equal(env.timers.size, 0);
  }
});

test("accepted spend recovery tolerates old blocked row until after() starts, with one POST", async () => {
  const env = pollingEnvironment();
  const states = ["blocked", "blocked", "generating", "ready"];
  env.respond(async url => Response.json({ state: url.endsWith("generate") ? "pending" : states.shift(), canRetry: true }));
  const result = watchSpend(env, true); await env.advance(60_000);
  assert.equal(result.ready, 1); assert.equal(result.failed, 0); assert.equal(result.blocked.length, 0);
  assert.equal(env.calls.filter(c => c.method === "POST").length, 1);
});

test("spend recovery that remains blocked stops after bounded transition grace", async () => {
  const env = pollingEnvironment();
  env.respond(async url => Response.json({ state: url.endsWith("generate") ? "pending" : "blocked", canRetry: true }));
  const result = watchSpend(env, true); await env.advance(60_000);
  assert.equal(result.blocked.length, 1); assert.equal(result.ready, 0);
  assert.equal(env.calls.filter(c => c.method === "POST").length, 1);
  assert.equal(env.timers.size, 0);
});

test("generate response reports a new spend block without polling or resubmission", async () => {
  const env = pollingEnvironment();
  env.respond(async url => Response.json({ state: url.endsWith("generate") ? "blocked" : "answers_ready", canRetry: false }));
  const result = watchSpend(env); await env.advance(60_000);
  assert.equal(result.blocked.length, 1); assert.equal(env.calls.length, 2);
  assert.equal(env.calls.filter(c => c.method === "POST").length, 1);
});

test("rate-limited recovery stops immediately; failed preflight never starts AI", async () => {
  const limited = pollingEnvironment();
  limited.respond(async url => url.endsWith("generate") ? new Response(null, { status: 429 }) : Response.json({ state: "answers_ready" }));
  const denied = watchSpend(limited); await limited.advance(60_000);
  assert.equal(denied.failed, 1); assert.equal(limited.calls.length, 2);
  const offline = pollingEnvironment();
  offline.respond(async () => { throw new Error("offline"); });
  const stopped = watchSpend(offline); await offline.advance(60_000);
  assert.equal(stopped.failed, 1); assert.equal(offline.calls.length, 5);
  assert.equal(offline.calls.filter(c => c.method === "POST").length, 0);
});
