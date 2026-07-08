import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // /Users/wakan/package-lock.json を誤って workspace root と判定すると、
  // dev server が全ルートを 404 に落とすことがあるため明示する。
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },

  // T1-8 PDF プロトタイプ: Vercel Functions に日本語フォント TTF と
  // サンプル JSON を同梱する (URL fetch 経由だと SSO 保護下で 404 になるため)。
  // T2-2 で本実装 API ルートに置換する際にも同じ tracing が必要。
  outputFileTracingIncludes: {
    // PDF ダウンロード Function に日本語 TTF を同梱
    "/api/integrated-trisetsu/[id]/pdf": [
      "./public/fonts/NotoSerifJP.ttf",
      "./public/fonts/NotoSansJP.ttf",
    ],
  },

  async redirects() {
    return [
      // ナビの「性格タイプ」は /zukan 表記だが、図鑑の実ページは /zukan/all
      // (/zukan 直下に page.tsx は無く 404 になる) ため恒久リダイレクトで受ける。
      // ※ 旧「相互理解度」ページの URL は当初から /friend-evaluation のみで、
      //    改名に伴う旧 URL は存在しない (git 履歴確認済み) ので他のリダイレクトは不要。
      {
        source: "/zukan",
        destination: "/zukan/all",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
