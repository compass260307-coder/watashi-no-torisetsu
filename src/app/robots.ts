import type { MetadataRoute } from "next";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /zukan/ は個人ページ ([ownerToken]) ごとブロック。
        // (旧 /zukan/all 公開図鑑は撤去し /types に一本化・redirect 済み)
        // /share は OG クローラがメタ情報を取得できるようクロールを許可し、
        // ページ側の noindex で通常の検索結果からのみ除外する。
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          // Day 9 永続アクセス点 (token は推測不可だが念のためインデックス除外)
          "/me/",
          // 旧パス: /me/ に 301 redirect 済み、念のため引き続き除外
          "/result/",
          "/report/",
          "/friend/",
          "/zukan/",
          "/perceptions/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
