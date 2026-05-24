import type { MetadataRoute } from "next";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
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
          "/auth/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
