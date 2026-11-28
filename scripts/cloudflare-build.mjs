// Cloudflare Workers 向けのビルド (npm run cf:build)。
//
// `opennextjs-cloudflare build` をそのまま実行すると、.env.local などの中身が
// .open-next/cloudflare/next-env.mjs に書き出され、秘密の値が Worker のプログラム本体に
// 入ってしまう。このスクリプトは次の手順でそれを防ぐ。
//   1. .env 系のファイルを読み、中身を「環境変数として」だけビルドに渡す
//   2. ビルドの間だけ .env 系のファイルを退避し、終わったら必ず元に戻す
//   3. 成果物 (.open-next/) に秘密の値が残っていないことを検査する
// 秘密の値は Cloudflare 側に secret として登録する (docs/CLOUDFLARE_WORKERS.md)。
//
// 使い方:
//   npm run cf:build -- --site-url=https://example.workers.dev --noindex
//     --site-url  NEXT_PUBLIC_SITE_URL として埋め込む URL (省略時は .env の値)
//     --noindex   全ページに X-Robots-Tag: noindex を付ける (確認用の環境向け)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASIDE_SUFFIX = ".cf-build-aside";
// Next.js (@next/env) が読み込むファイル名。.env.example は読み込まれないので対象外。
const ENV_FILES = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  ".env.development",
  ".env.development.local",
  ".env.test",
  ".env.test.local",
];
const SECRET_NAME = /(SECRET|SERVICE_ROLE|API_KEY|ACCESS_TOKEN|TOKEN|PASSWORD|PRIVATE_KEY)/;
const SCAN_TARGETS = ["worker.js", "cloudflare", "middleware", "server-functions", "assets"];
const SCAN_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json", ".html", ".txt", ".rsc", ".body", ".meta"]);
const SCAN_MAX_BYTES = 40 * 1024 * 1024;

function parseEnvFile(file) {
  const values = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && value[0] === value.at(-1) && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function* walk(target) {
  const stat = statSync(target);
  if (stat.isFile()) {
    yield target;
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const args = process.argv.slice(2);
const siteUrl = args.find((arg) => arg.startsWith("--site-url="))?.slice("--site-url=".length);
const noindex = args.includes("--noindex");

const leftover = ENV_FILES.filter((name) => existsSync(path.join(root, name + ASIDE_SUFFIX)));
if (leftover.length > 0) {
  console.error(
    `[cf:build] 前回のビルドが途中で止まり、退避したままのファイルがあります: ${leftover
      .map((name) => name + ASIDE_SUFFIX)
      .join(", ")}\n元の名前に戻してから、もう一度実行してください。`,
  );
  process.exit(1);
}

// 退避するのは全部。値を読むのは本番ビルドで Next.js が読むものだけで、優先順位も Next.js と
// 同じ (すでに設定済みの環境変数 > .env.production.local > .env.local > .env.production > .env)。
const present = ENV_FILES.filter((name) => existsSync(path.join(root, name)));
const fileValues = {};
for (const name of [".env", ".env.production", ".env.local", ".env.production.local"]) {
  if (present.includes(name)) Object.assign(fileValues, parseEnvFile(path.join(root, name)));
}
const buildEnv = { ...fileValues, ...process.env, DEPLOY_TARGET: "cloudflare" };
if (siteUrl) buildEnv.NEXT_PUBLIC_SITE_URL = siteUrl;
if (noindex) buildEnv.SITE_NOINDEX = "1";

const restore = () => {
  for (const name of present) {
    const aside = path.join(root, name + ASIDE_SUFFIX);
    if (existsSync(aside)) renameSync(aside, path.join(root, name));
  }
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restore();
    process.exit(130);
  });
}

let status = 1;
try {
  for (const name of present) renameSync(path.join(root, name), path.join(root, name + ASIDE_SUFFIX));
  const result = spawnSync("npx", ["opennextjs-cloudflare", "build"], {
    cwd: root,
    env: buildEnv,
    stdio: "inherit",
  });
  status = result.status ?? 1;
} finally {
  restore();
}
if (status !== 0) {
  console.error(`[cf:build] ビルドに失敗しました (exit ${status})`);
  process.exit(status);
}

// 成果物に秘密の値が入っていないことを確かめる。値は表示せず、名前とファイルだけを出す。
const secrets = Object.entries(buildEnv).filter(
  ([key, value]) =>
    SECRET_NAME.test(key) && !key.startsWith("NEXT_PUBLIC_") && typeof value === "string" && value.length >= 12,
);
const leaks = new Set();
for (const target of SCAN_TARGETS) {
  const full = path.join(root, ".open-next", target);
  if (!existsSync(full)) continue;
  for (const file of walk(full)) {
    if (!SCAN_EXTENSIONS.has(path.extname(file)) || statSync(file).size > SCAN_MAX_BYTES) continue;
    const content = readFileSync(file);
    for (const [key, value] of secrets) {
      if (content.includes(value)) leaks.add(`${key} -> ${path.relative(root, file)}`);
    }
  }
}
if (leaks.size > 0) {
  console.error(
    `[cf:build] 成果物に秘密の値が入っています。配置しないでください:\n  ${[...leaks].sort().join("\n  ")}`,
  );
  process.exit(1);
}
console.log(`[cf:build] 完了。秘密の値 ${secrets.length} 件が成果物に入っていないことを確認しました。`);
