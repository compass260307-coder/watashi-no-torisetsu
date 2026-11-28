import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// 事前生成したページ (ビルド時に作る82ページ) は、Workers の静的ファイル置き場から読む。
// このアプリは時間や操作による再生成 (ISR / revalidate) を使っていないので、書き込みできる
// 保存先 (R2 など) は要らない。再生成を使い始めるときは R2 の保存先に替えること。
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // 保存済みのページは Next.js 本体を起こさずに返す (部分事前描画 PPR とは併用できない)。
  enableCacheInterception: true,
});
