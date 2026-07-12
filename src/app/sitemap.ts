import type { MetadataRoute } from "next";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // タイプ別ランディング (/preview/[typeId])。/types から公開リンクされ、型ごとに
  // 固有メタ (肩書き/図鑑説明) を持つためインデックス対象として登録する。
  const typePages: MetadataRoute.Sitemap = (
    allThirtyTwoTypeIds() as string[]
  ).map((id) => ({
    url: `${BASE_URL}/preview/${id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/diagnosis`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // 性格タイプ一覧 (トップのナビ「性格タイプ」のリンク先)
      url: `${BASE_URL}/types`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // 相性診断 (公開・シェア集客ページ)
      url: `${BASE_URL}/aisho`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...typePages,
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/commerce`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
