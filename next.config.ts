import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // T1-8 PDF プロトタイプ: Vercel Functions に日本語フォント TTF と
  // サンプル JSON を同梱する (URL fetch 経由だと SSO 保護下で 404 になるため)。
  // T2-2 で本実装 API ルートに置換する際にも同じ tracing が必要。
  outputFileTracingIncludes: {
    "/api/test-pdf": [
      "./public/fonts/NotoSerifJP.ttf",
      "./public/fonts/NotoSansJP.ttf",
      "./scripts/sample-7chapters.json",
    ],
  },
};

export default nextConfig;
