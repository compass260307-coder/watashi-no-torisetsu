import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";

// This is the development project already recognized by third-party-measurement.ts.
// No network requests, database operations, or secret values in output.
export const DEVELOPMENT_DB_HOST = "umhgnunxeupvxnrvatde.supabase.co";
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const empty = (value) => !value?.trim() || value.trim() === "[SENSITIVE]" || /^(?:change.?me|replace|your[_-]|<)/i.test(value.trim());

export function inspectDevelopmentEnvironment(env, { checkout = false } = {}) {
  const errors = [];
  const warnings = [];
  if (env.NODE_ENV && env.NODE_ENV !== "development") errors.push("NODE_ENV: unset it or use development for this local check.");
  if (env.VERCEL_ENV === "production") errors.push("VERCEL_ENV: production is not a local development environment.");
  const required = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const name of required) if (empty(env[name])) errors.push(`${name}: required development setting is missing.`);

  let databaseHost;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    databaseHost = url.hostname;
    if (url.origin !== `https://${DEVELOPMENT_DB_HOST}` || !["", "/"].includes(url.pathname) || url.search || url.hash || url.username || url.password) {
      errors.push("NEXT_PUBLIC_SUPABASE_URL: use the team's approved development project URL.");
    }
  } catch { errors.push("NEXT_PUBLIC_SUPABASE_URL: invalid URL."); }

  try {
    const url = new URL(env.NEXT_PUBLIC_SITE_URL);
    if (!loopback.has(url.hostname) || url.protocol !== "http:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      errors.push("NEXT_PUBLIC_SITE_URL: use an HTTP loopback origin matching the dev-server port.");
    }
  } catch { errors.push("NEXT_PUBLIC_SITE_URL: invalid URL."); }

  for (const [name, role, prefix] of [
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon", "sb_publishable_"],
    ["SUPABASE_SERVICE_ROLE_KEY", "service_role", "sb_secret_"],
  ]) {
    const value = env[name]?.trim();
    if (empty(value)) continue;
    if (value.startsWith(prefix)) {
      warnings.push(`${name}: project ownership of this key must be confirmed by the environment owner.`);
      continue;
    }
    try {
      const parts = value.split(".");
      if (parts.length !== 3) throw new Error("not a JWT");
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.role !== role || `${payload.ref}.supabase.co` !== databaseHost) throw new Error("wrong project or role");
    } catch { errors.push(`${name}: key format, role, or project does not match the development database.`); }
  }
  if (env.NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT !== "1") errors.push("NEXT_PUBLIC_DISABLE_THIRD_PARTY_MEASUREMENT: must be 1.");
  if (env.LOGIN_MAIL_MODE !== "preview") errors.push("LOGIN_MAIL_MODE: use preview for the shared local setup.");

  const stripeKeys = { STRIPE_SECRET_KEY: /^(sk|rk)_test_.+/, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: /^pk_test_.+/ };
  for (const [name, pattern] of Object.entries(stripeKeys)) {
    if (!empty(env[name]) && !pattern.test(env[name])) errors.push(`${name}: only Stripe test-mode keys are accepted.`);
    if (checkout && empty(env[name])) errors.push(`${name}: required for checkout verification.`);
  }
  if (checkout && !/^whsec_.+/.test(env.STRIPE_WEBHOOK_SECRET ?? "")) errors.push("STRIPE_WEBHOOK_SECRET: use the secret from your local test-mode webhook listener.");
  if (checkout) warnings.push("Stripe price IDs and webhook ownership cannot be verified offline; confirm test mode in Stripe before a purchase test.");

  const integrations = ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY", "OPENAI_API_KEY", "RESEND_API_KEY", "LINE_CHANNEL_ACCESS_TOKEN", "SLACK_WEBHOOK_URL", "TIKTOK_PIXELS", "TIKTOK_EVENTS_API_TOKEN", "META_CONVERSIONS_API_TOKEN"];
  for (const name of integrations) if (!empty(env[name])) warnings.push(`${name}: configured; relevant features can call an external service. Confirm the test account and scope.`);
  return { errors, warnings };
}

export function loadDevelopmentEnvironment(directory) {
  let failed = false;
  // Use Next's loader so .env.development.local and exported shell variables
  // have exactly the same precedence as next dev. Never print parser errors.
  const result = nextEnv.loadEnvConfig(directory, true, { info() {}, error() { failed = true; } }, true);
  if (failed) throw new Error("Environment files could not be read; inspect them locally without posting values.");
  return result.combinedEnv;
}

function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  if (resolve(process.cwd()) !== resolve(root)) {
    console.error("Run npm run dev:check from the repository root.");
    return 1;
  }
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--checkout")) {
    console.error("Usage: npm run dev:check [-- --checkout]");
    return 1;
  }
  const pinned = readFileSync(new URL("../.nvmrc", import.meta.url), "utf8").trim();
  const result = inspectDevelopmentEnvironment(loadDevelopmentEnvironment(root), { checkout: args.includes("--checkout") });
  if (process.versions.node.split(".")[0] !== pinned.split(".")[0]) result.errors.push("Node.js: use the version specified in .nvmrc.");
  else if (process.versions.node !== pinned) result.warnings.push("Node.js: patch version differs from .nvmrc; align versions when reproducing issues.");
  for (const warning of result.warnings) console.log(`WARN ${warning}`);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  if (result.errors.length) {
    console.error("Setup incomplete. See docs/TEAM_DEVELOPMENT.md and docs/TEAM_ENVIRONMENT.md. No connection was attempted.");
    return 1;
  }
  console.log("PASS Local configuration checks. Remote credentials, schema and end-to-end behavior still need verification.");
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = main(); }
  catch { console.error("Development setup check failed. Inspect configuration locally; do not paste secrets into chat."); process.exitCode = 1; }
}
