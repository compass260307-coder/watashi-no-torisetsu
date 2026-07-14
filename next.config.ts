import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // /Users/wakan/package-lock.json を誤って workspace root と判定すると、
  // dev server が全ルートを 404 に落とすことがあるため明示する。
  outputFileTracingRoot: projectRoot,

  // /report/[token]/pdf の headless Chromium。バンドルせず node_modules から
  // そのまま読み込む (バイナリ同梱パッケージのため bundler を通すと壊れる)。
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  turbopack: {
    root: projectRoot,
  },

  async redirects() {
    return [
      // ナビの「性格タイプ」は /zukan 表記だが、図鑑の実ページは /zukan/all
      // (/zukan 直下に page.tsx は無く 404 になる) ため恒久リダイレクトで受ける。
      // ※ 旧「相互理解度」ページの URL は当初から /friend-evaluation のみで、
      //    改名に伴う旧 URL は存在しない (git 履歴確認済み) ので他のリダイレクトは不要。
      // 旧公開図鑑 /zukan/all は撤去し性格タイプページ /types に一本化。
      // /zukan と旧 /zukan/all の被リンク/インデックスを /types へ恒久転送。
      { source: "/zukan", destination: "/types", permanent: true },
      { source: "/zukan/all", destination: "/types", permanent: true },
      // 旧 self-result 系パス (Day 9 で /me/[token] に統合)。以前は各 page.tsx が
      // permanentRedirect していたが、ページを撤去し config redirect に一本化。
      // 過去発行 URL (完成通知メール/SNS/口コミ) を壊さないため恒久 301 で /me へ。
      // ※ /report/:ownerToken の /me 転送は撤去済み: 詳細レポート (課金特典) の
      //    実ページを /report/[token] に新設したため。旧リンクも同 token で
      //    レポート or ロック画面 (→/me 導線) に着地するので実害なし。
      { source: "/result/:ownerToken", destination: "/me/:ownerToken", permanent: true },
      { source: "/perceptions/:ownerToken", destination: "/me/:ownerToken", permanent: true },
      // /zukan/all (公開図鑑) は除外し、それ以外の /zukan/<token> のみ /me へ。
      { source: "/zukan/:ownerToken((?!all$).+)", destination: "/me/:ownerToken", permanent: true },
    ];
  },
};

export default nextConfig;
