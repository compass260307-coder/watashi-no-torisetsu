import type { MetadataRoute } from "next";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // /zukan/ は個人ページ ([ownerToken]) ごとブロックしているが、
        // 公開の図鑑一覧 /zukan/all だけは許可する (トップのナビ「性格タイプ」から
        // リンクしており、検索流入の受け皿になる汎用コンテンツのため)。
        // クローラはより具体的な (長い) ルールを優先するので allow が勝つ。
        // /share = キャラシェアの獲得ランディング (公開・OGクローラ/SEOに開放)。
        allow: ["/", "/zukan/all", "/share"],
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
          "/auth/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
