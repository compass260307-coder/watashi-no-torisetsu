import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

  // /me/[token] の page.tsx が path.join(process.cwd(), "public", 動的パス) で
  // 存在チェックするため、トレーサーが public/ 全体 (約 350MB) を関数に同梱し
  // Vercel の 250MB 上限を超えてデプロイが落ちる。fs で実際に参照する
  // characters/cut と characters/scenes 以外を関数トレースから除外する
  // (excludes は includes より後に適用されるため、includes で戻す方式は使えない)。
  outputFileTracingExcludes: {
    "/me/\\[token\\]": [
      "public/!(characters)/**",
      "public/*.*",
      "public/characters/!(cut|scenes)/**",
      "public/characters/*.*",
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
