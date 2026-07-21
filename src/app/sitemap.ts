import type { MetadataRoute } from "next";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";

const BASE_URL = "https://www.watashi-torisetsu.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // タイプ別ランディング (/preview/[typeId])。/types から公開リンクされ、型ごとに
  // 固有メタ (肩書き/図鑑説明) を持つためインデックス対象として登録する。
  // lastModified は実際の重要な更新日時を管理できるようになるまで省略する。
  // ビルド時刻を入れると全ページが毎回更新されたように見え、Google にとって
  // 信頼できる更新シグナルにならないため。
  const typePages: MetadataRoute.Sitemap = (
    allThirtyTwoTypeIds() as string[]
  ).map((id) => ({
    url: `${BASE_URL}/preview/${id}`,
    priority: 0.6,
  }));
  // priority: トップと診断ページを最重要 (1.0) として明示し、規約系は下げる。
  return [
    {
      url: BASE_URL,
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      priority: 0.8,
    },
    {
      // 診断ページはトップと同格の集客ページとして扱う
      url: `${BASE_URL}/diagnosis`,
      priority: 1.0,
    },
    {
      // 性格タイプ一覧 (トップのナビ「性格タイプ」のリンク先)
      url: `${BASE_URL}/types`,
      priority: 0.8,
    },
    {
      // 相性診断 (公開・シェア集客ページ)
      url: `${BASE_URL}/aisho`,
      priority: 0.8,
    },
    ...typePages,
    {
      url: `${BASE_URL}/terms`,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/legal/commerce`,
      priority: 0.3,
    },
  ];
}
