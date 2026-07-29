import type { MetadataRoute } from "next";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";
import { ARTICLES } from "@/lib/articles";

const BASE_URL = "https://www.watashi-torisetsu.com";
const HOME_ALTERNATES = {
  languages: {
    "ja-JP": BASE_URL,
    "ko-KR": `${BASE_URL}/ko`,
    "x-default": BASE_URL,
  },
};
const DIAGNOSIS_ALTERNATES = {
  languages: {
    "ja-JP": `${BASE_URL}/diagnosis`,
    "ko-KR": `${BASE_URL}/ko/diagnosis`,
    "x-default": `${BASE_URL}/diagnosis`,
  },
};

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
      alternates: HOME_ALTERNATES,
    },
    {
      // 韓国語トップ。/ と相互 hreflang を出して韓国語版として明示する。
      url: `${BASE_URL}/ko`,
      priority: 1.0,
      alternates: HOME_ALTERNATES,
    },
    {
      url: `${BASE_URL}/about`,
      priority: 0.8,
    },
    {
      // 診断ページはトップと同格の集客ページとして扱う
      url: `${BASE_URL}/diagnosis`,
      priority: 1.0,
      alternates: DIAGNOSIS_ALTERNATES,
    },
    {
      // 韓国語診断ページ。検索流入の主入口として /diagnosis と同格に扱う。
      url: `${BASE_URL}/ko/diagnosis`,
      priority: 1.0,
      alternates: DIAGNOSIS_ALTERNATES,
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
    {
      // 運命の設計図 (独立商品LP。ナビ/フッターから公開リンクされる集客ページ)
      url: `${BASE_URL}/unmei`,
      priority: 0.8,
    },
    ...typePages,
    {
      // 記事一覧 (SEO 用解説コンテンツの入り口)
      url: `${BASE_URL}/articles`,
      priority: 0.7,
    },
    // 記事詳細。lastModified は記事データの published/updated から実日付を入れる
    // (ビルド時刻ではなくコンテンツ由来なので更新シグナルとして信頼できる)。
    ...ARTICLES.map((a) => ({
      url: `${BASE_URL}/articles/${a.slug}`,
      lastModified: a.updated ?? a.published,
      priority: 0.7,
    })),
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
    // 韓国語版の規約系 (日本語版と同じ実ページが /ko 配下に存在する)
    {
      url: `${BASE_URL}/ko/terms`,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/ko/privacy`,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/ko/legal/commerce`,
      priority: 0.3,
    },
  ];
}
