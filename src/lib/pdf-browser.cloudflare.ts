import "server-only";

import puppeteer from "@cloudflare/puppeteer";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Cloudflare Workers 用の PDF ブラウザ起動。Workers では Chromium を同梱できないため、
// Cloudflare のブラウザ機能 (wrangler.jsonc の browser binding "BROWSER") を使う。
// DEPLOY_TARGET=cloudflare のビルドでだけ、next.config.ts の resolveAlias により
// "@/lib/pdf-browser" の代わりにこのファイルが読み込まれる。
export async function launchPdfBrowser() {
  const { env } = getCloudflareContext();
  const binding = (env as unknown as { BROWSER?: Parameters<typeof puppeteer.launch>[0] }).BROWSER;
  if (!binding) {
    throw new Error("[pdf-browser] BROWSER binding is not configured");
  }
  return puppeteer.launch(binding);
}
