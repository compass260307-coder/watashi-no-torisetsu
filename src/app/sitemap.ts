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
  }));
  return [
    {
      url: BASE_URL,
    },
    {
      url: `${BASE_URL}/about`,
    },
    {
      url: `${BASE_URL}/diagnosis`,
    },
    {
      // 性格タイプ一覧 (トップのナビ「性格タイプ」のリンク先)
      url: `${BASE_URL}/types`,
    },
    {
      // 相性診断 (公開・シェア集客ページ)
      url: `${BASE_URL}/aisho`,
    },
    ...typePages,
    {
      url: `${BASE_URL}/terms`,
    },
    {
      url: `${BASE_URL}/privacy`,
    },
    {
      url: `${BASE_URL}/legal/commerce`,
    },
  ];
}
