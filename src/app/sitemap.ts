import type { MetadataRoute } from "next";
import { allThirtyTwoTypeIds } from "@/lib/thirty-two-types";
import { ARTICLES } from "@/lib/articles";
import { KO_ARTICLES } from "@/lib/articles-ko";
import {
  absoluteSiteUrl,
  INDEXABLE_LOCALIZED_ROUTES,
  localizedLanguages,
  SITE_URL,
} from "@/lib/locale-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  // タイプ別ランディング (/preview/[typeId])。/types から公開リンクされ、型ごとに
  // 固有メタ (肩書き/図鑑説明) を持つためインデックス対象として登録する。
  // lastModified は実際の重要な更新日時を管理できるようになるまで省略する。
  // ビルド時刻を入れると全ページが毎回更新されたように見え、Google にとって
  // 信頼できる更新シグナルにならないため。
  const typePages: MetadataRoute.Sitemap = (
    allThirtyTwoTypeIds() as string[]
  ).flatMap((id) => {
    const japanesePath = `/preview/${id}`;
    const koreanPath = `/ko/preview/${id}`;
    const japaneseUrl = absoluteSiteUrl(japanesePath);
    const koreanUrl = absoluteSiteUrl(koreanPath);
    const alternates = {
      languages: localizedLanguages(japanesePath, koreanPath),
    };
    return [
      {
        url: japaneseUrl,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates,
      },
      {
        url: koreanUrl,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates,
      },
    ];
  });

  const localizedPages: MetadataRoute.Sitemap =
    INDEXABLE_LOCALIZED_ROUTES.flatMap((route) => {
      const alternates = {
        languages: localizedLanguages(route.ja, route.ko),
      };
      return [
        {
          url: absoluteSiteUrl(route.ja),
          priority: route.priority,
          changeFrequency: route.changeFrequency,
          alternates,
        },
        {
          url: absoluteSiteUrl(route.ko),
          priority: route.priority,
          changeFrequency: route.changeFrequency,
          alternates,
        },
      ];
    });

  const koreanArticlesBySlug = new Map(
    KO_ARTICLES.map((article) => [article.slug, article]),
  );
  const articlePages: MetadataRoute.Sitemap = ARTICLES.flatMap((article) => {
    const japanesePath = `/articles/${article.slug}`;
    const koreanArticle = koreanArticlesBySlug.get(article.slug);

    // KO版が無い記事 (日本語のみ) は hreflang alternates を付けず日本語単独で登録する。
    // 以前は return [] で sitemap から丸ごと除外していたため、JAのみの新規記事が
    // インデックス対象から漏れていた (/articles からはリンク済みでクロールは可能だった)。
    if (!koreanArticle) {
      return [
        {
          url: absoluteSiteUrl(japanesePath),
          lastModified: article.updated ?? article.published,
          changeFrequency: "monthly",
          priority: 0.7,
        },
      ];
    }

    const koreanPath = `/ko/articles/${article.slug}`;
    const alternates = {
      languages: localizedLanguages(japanesePath, koreanPath),
    };

    return [
      {
        url: absoluteSiteUrl(japanesePath),
        lastModified: article.updated ?? article.published,
        changeFrequency: "monthly",
        priority: 0.7,
        alternates,
      },
      {
        url: absoluteSiteUrl(koreanPath),
        lastModified: koreanArticle.updated ?? koreanArticle.published,
        changeFrequency: "monthly",
        priority: 0.7,
        alternates,
      },
    ];
  });

  // priority: トップと診断ページを最重要 (1.0) として明示し、規約系は下げる。
  return [
    ...localizedPages,
    {
      // 運命の設計図 (独立商品LP。ナビ/フッターから公開リンクされる集客ページ)
      url: `${SITE_URL}/unmei`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...typePages,
    // 記事詳細。日本語・韓国語の同一スラッグを hreflang で相互に結ぶ。
    ...articlePages,
  ];
}
