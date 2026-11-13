import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { DEVELOPMENT_DB_HOST, inspectDevelopmentEnvironment } from "./check-dev-env.mjs";

// Synthetic unsigned keys: these fixtures are never sent to any service.
const jwt = (role, ref = DEVELOPMENT_DB_HOST.split(".")[0]) => `fixture.${Buffer.from(JSON.stringify({ role, ref })).toString("base64url")}.not-a-signature`;
const valid = () => ({
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: `https://${DEVELOPMENT_DB_HOST}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
  NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT: "1",
  LOGIN_MAIL_MODE: "preview",
});

test("accepts the known development configuration, without claiming remote verification", () => {
  assert.deepEqual(inspectDevelopmentEnvironment(valid()).errors, []);
  const source = readFileSync(new URL("../src/lib/third-party-measurement.ts", import.meta.url), "utf8");
  assert.ok(source.includes(DEVELOPMENT_DB_HOST.split(".")[0]));
});

test("rejects unconfigured setup and mismatched database/key roles", () => {
  assert.ok(inspectDevelopmentEnvironment({}).errors.length > 0);
  for (const change of [
    { NEXT_PUBLIC_SUPABASE_URL: "https://different-project.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${DEVELOPMENT_DB_HOST}.example.com` },
    { NEXT_PUBLIC_SUPABASE_URL: `http://${DEVELOPMENT_DB_HOST}` },
    { SUPABASE_SERVICE_ROLE_KEY: jwt("service_role", "different-project") },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("service_role") },
    { NEXT_PUBLIC_SITE_URL: "https://www.watashi-torisetsu.com" },
    { SUPABASE_SERVICE_ROLE_KEY: "[SENSITIVE]" },
    { NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT: "0" },
    { LOGIN_MAIL_MODE: "live" },
    { NODE_ENV: "production" },
  ]) assert.ok(inspectDevelopmentEnvironment({ ...valid(), ...change }).errors.length > 0);
});

test("rejects live Stripe keys even outside checkout mode and never echoes secrets", () => {
  const marker = "sk_live_DO_NOT_PRINT_THIS_FIXTURE";
  const result = inspectDevelopmentEnvironment({ ...valid(), STRIPE_SECRET_KEY: marker });
  assert.ok(result.errors.length > 0);
  assert.ok(!JSON.stringify(result).includes(marker));
  assert.ok(inspectDevelopmentEnvironment(valid(), { checkout: true }).errors.length > 0);
  assert.deepEqual(inspectDevelopmentEnvironment({ ...valid(), STRIPE_SECRET_KEY: "sk_test_fixture", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture" }, { checkout: true }).errors, []);
});

test("warns about opaque keys and enabled external integrations", () => {
  const result = inspectDevelopmentEnvironment({ ...valid(), SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture", ANTHROPIC_API_KEY: "private-fixture-value" });
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((message) => message.startsWith("SUPABASE_SERVICE_ROLE_KEY:")));
  assert.ok(result.warnings.some((message) => message.startsWith("ANTHROPIC_API_KEY:")));
  assert.ok(!JSON.stringify(result).includes("private-fixture-value"));
});

test("uses Next.js precedence: development.local and inherited shell override .env.local", () => {
  const directory = mkdtempSync(join(tmpdir(), "torisetsu-env-test-"));
  try {
    writeFileSync(join(directory, ".env.local"), Object.entries(valid()).map(([key, value]) => `${key}=${value}`).join("\n"));
    writeFileSync(join(directory, ".env.development.local"), "STRIPE_SECRET_KEY=sk_live_NEVER_ECHO\n");
    const moduleUrl = new URL("./check-dev-env.mjs", import.meta.url).href;
    const code = `import { loadDevelopmentEnvironment, inspectDevelopmentEnvironment } from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(inspectDevelopmentEnvironment(loadDevelopmentEnvironment(process.argv[1]))));`;
    const run = (env) => spawnSync(process.execPath, ["--input-type=module", "-e", code, directory], { env, encoding: "utf8" });
    const fileOverride = run({ PATH: process.env.PATH, NODE_ENV: "development" });
    assert.equal(fileOverride.status, 0);
    assert.ok(JSON.parse(fileOverride.stdout).errors.some((error) => error.startsWith("STRIPE_SECRET_KEY:")));
    assert.ok(!`${fileOverride.stdout}${fileOverride.stderr}`.includes("NEVER_ECHO"));
    const shellOverride = run({ PATH: process.env.PATH, NODE_ENV: "development", STRIPE_SECRET_KEY: "sk_test_fixture" });
    assert.equal(shellOverride.status, 0);
    assert.deepEqual(JSON.parse(shellOverride.stdout).errors, []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
