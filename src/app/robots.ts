import type { MetadataRoute } from "next";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // OG カード用クローラ (X / Facebook / LINE 系) は /friend/ を許可 (2026-07-15)。
      // ⚠ X (Twitterbot) は robots.txt を尊重するため、/friend/ が Disallow だと
      //   OG タグが正しくてもカード取得自体を拒否され、カードが一切出ない。
      //   LINE のクローラも facebookexternalhit 系 UA。
      //   クローラは自分に最も特異な UA グループだけを読むので、私的パスの
      //   Disallow をこのグループにも再掲する必要がある。
      // /friend の検索除外はページ側 meta robots noindex で担保する。
      {
        userAgent: ["Twitterbot", "facebookexternalhit"],
        allow: "/",
        disallow: [
          "/api/",
          "/me/",
          "/result/",
          "/report/",
          "/zukan/",
          "/perceptions/",
          // 韓国語版の個人ページ (日本語版のミラー。/ko/friend/ は OG カード取得の
          // ため日本語版と同様ここでは Disallow しない)
          "/ko/me/",
          "/ko/result/",
        ],
      },
      {
        userAgent: "*",
        // /zukan/ は個人ページ ([ownerToken]) ごとブロック。
        // (旧 /zukan/all 公開図鑑は撤去し /types に一本化・redirect 済み)
        // /share は OG クローラがメタ情報を取得できるようクロールを許可し、
        // ページ側の noindex で通常の検索結果からのみ除外する。
        allow: "/",
        disallow: [
          "/api/",
          // Day 9 永続アクセス点 (token は推測不可だが念のためインデックス除外)
          "/me/",
          // 旧パス: /me/ に 301 redirect 済み、念のため引き続き除外
          "/result/",
          "/report/",
          "/friend/",
          "/zukan/",
          "/perceptions/",
          // 韓国語版の個人ページ (日本語版のミラー)
          "/ko/me/",
          "/ko/result/",
          "/ko/friend/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
