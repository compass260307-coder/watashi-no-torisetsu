// 記事一覧 (/articles)。SEO 用解説コンテンツの入り口。
// 記事は src/lib/articles.ts が単一情報源。
// カード表示とカテゴリー絞り込みは ArticleGrid (client) に委譲。
// このページ自体は静的なままで、初期HTMLに全記事が含まれる (SEO / Vercel コスト対策)。
import type { Metadata } from "next";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import { ARTICLES, ARTICLE_CATEGORIES } from "@/lib/articles";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

export const metadata: Metadata = {
  title: "記事・コラム",
  description:
    "OCEAN診断（ビッグファイブ）や性格心理学をやさしく解説する、ワタシのトリセツの記事・コラム一覧。性格診断を受ける前の予習にも、結果を深く知るためにも。",
  alternates: { canonical: "/articles" },
  openGraph: {
    title: "記事・コラム｜ワタシのトリセツ",
    description:
      "OCEAN診断（ビッグファイブ）や性格心理学をやさしく解説する記事一覧。",
    images: [{ url: "/ogp-v4.png", width: 1200, height: 630 }],
  },
};

export default function ArticlesPage() {
  // 新しい記事が上に来るように公開日の降順で並べる。
  const articles = [...ARTICLES]
    .sort((a, b) => b.published.localeCompare(a.published))
    .map(
      ({ slug, listTitle, description, category, published, image, imageAlt }) => ({
        slug,
        listTitle,
        description,
        category,
        published,
        image,
        imageAlt,
      }),
    );

  // 記事が1本以上あるカテゴリーだけをドロップダウンに出す (定義順を維持)。
  const categories = ARTICLE_CATEGORIES.filter((c) =>
    ARTICLES.some((a) => a.category === c),
  );

  return (
    <div
      className="flex flex-1 flex-col bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <TopHeader />

      {/* 横幅はフッター (TopFooter) と同じ構造 (外側 px-8 + 内側 max-w-[1080px]) で揃える */}
      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
          <section className="pt-12 md:pt-16">
            <h1
              className="font-bold"
              style={{
                color: NAVY,
                fontSize: "clamp(28px, 5vw, 40px)",
                lineHeight: 1.45,
              }}
            >
              記事・コラム
            </h1>
            <p
              className="mt-4 text-[15px] leading-[2]"
              style={{ color: `${NAVY}B3` }}
            >
              OCEAN診断（ビッグファイブ）のことや、性格心理学の考え方を、
              むずかしい言葉を使わずに解説していきます。
            </p>
          </section>

          <ArticleGrid articles={articles} categories={categories} />
        </div>
      </main>

      <TopFooter />
    </div>
  );
}
