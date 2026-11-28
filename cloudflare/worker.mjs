// Cloudflare Workers の入口。OpenNext が生成した処理 (.open-next/worker.js) を包み、
// Vercel が基盤側でやっていた2つのことを補う。
//   1. ページ本体の保存期間: 事前生成したページには CDN 向けの s-maxage だけが付く。
//      Vercel は利用者へ返す前に「毎回確認する」指定へ置き換えるので、同じにそろえる。
//   2. 定期実行: vercel.json の crons と同じ時刻に、同じ入口を同じ認証で呼ぶ。
//      時刻は wrangler.jsonc の triggers.crons (UTC) と対で管理する。
import handler from "../.open-next/worker.js";

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from "../.open-next/worker.js";

const CRON_PATHS = {
  "0 * * * *": "/api/cron/purchase-conversions",
  "20 * * * *": "/api/cron/x-ads-spend",
  "50 19 * * *": "/api/cron/server-costs",
};

// 定期実行の呼び出しは Worker の中で完結し、外へは出ない。入口が URL を必要とするので
// 本番の正規ホストを使う。
const CRON_ORIGIN = "https://www.watashi-torisetsu.com";

const BROWSER_REVALIDATE = "public, max-age=0, must-revalidate";

function withBrowserCacheControl(response) {
  const cacheControl = response.headers.get("cache-control");
  if (!cacheControl || !/s-maxage/i.test(cacheControl) || /(^|[,\s])max-age=/i.test(cacheControl)) {
    return response;
  }
  const patched = new Response(response.body, response);
  patched.headers.set("cache-control", BROWSER_REVALIDATE);
  return patched;
}

const worker = {
  async fetch(request, env, ctx) {
    return withBrowserCacheControl(await handler.fetch(request, env, ctx));
  },

  async scheduled(controller, env, ctx) {
    const path = CRON_PATHS[controller.cron];
    if (!path) {
      throw new Error(`[cron] no route is mapped to the schedule "${controller.cron}"`);
    }
    if (!env.CRON_SECRET) {
      throw new Error(`[cron] CRON_SECRET is not configured; skipped ${path}`);
    }
    const response = await handler.fetch(
      new Request(`${CRON_ORIGIN}${path}`, {
        headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      }),
      env,
      ctx,
    );
    const detail = (await response.text()).slice(0, 500);
    if (!response.ok) {
      // 例外にしておくと、Cloudflare の Cron Events に失敗として残る。
      throw new Error(`[cron] ${path} responded ${response.status}: ${detail}`);
    }
    console.log(`[cron] ${path} responded ${response.status}`);
  },
};

export default worker;
