import type { Metadata } from "next";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import {
  KO_ARTICLES,
  KO_ARTICLE_CATEGORIES,
} from "@/lib/articles-ko";
import {
  KO_DEFAULT_OG_IMAGE,
  KO_SEO_KEYWORDS,
  KO_SITE_NAME,
  localizedAlternates,
  SITE_URL,
} from "@/lib/locale-seo";

const FONT_STACK =
  "var(--font-noto-sans), 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

const NAVY = "#2E2E5C";
const DESCRIPTION =
  "OCEAN 진단(빅파이브)과 성격심리학을 쉽게 설명하는 나의 사용설명서 글·칼럼 목록입니다. 성격 진단을 받기 전에도, 결과를 더 깊이 이해하고 싶을 때도 읽어 보세요.";

export const metadata: Metadata = {
  title: { absolute: "글·칼럼 | 나의 사용설명서" },
  description: DESCRIPTION,
  keywords: [
    ...KO_SEO_KEYWORDS,
    "OCEAN 진단 글",
    "빅파이브 설명",
    "성격심리학",
    "자기 이해 칼럼",
  ],
  alternates: localizedAlternates("ko", "/articles", "/ko/articles"),
  openGraph: {
    type: "website",
    locale: "ko_KR",
    alternateLocale: ["ja_JP"],
    url: `${SITE_URL}/ko/articles`,
    siteName: KO_SITE_NAME,
    title: "글·칼럼 | 나의 사용설명서",
    description:
      "OCEAN 진단(빅파이브)과 성격심리학을 쉽게 설명하는 글을 모았어요.",
    images: [KO_DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "글·칼럼 | 나의 사용설명서",
    description: DESCRIPTION,
    images: [KO_DEFAULT_OG_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function KoreanArticlesPage() {
  const articles = [...KO_ARTICLES]
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

  const categories = KO_ARTICLE_CATEGORIES.filter((category) =>
    KO_ARTICLES.some((article) => article.category === category),
  );

  return (
    <div
      className="flex flex-1 flex-col bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <KoTopHeader />

      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
          <section className="pt-12 md:pt-16">
            <h1
              className="break-keep font-bold"
              style={{
                color: NAVY,
                fontSize: "clamp(28px, 5vw, 40px)",
                lineHeight: 1.45,
              }}
            >
              글·칼럼
            </h1>
            <p
              className="mt-4 break-keep text-[15px] leading-[2]"
              style={{ color: `${NAVY}B3` }}
            >
              OCEAN 진단(빅파이브)과 성격심리학의 개념을 어려운 말 없이
              쉽게 설명해 드려요.
            </p>
          </section>

          <ArticleGrid
            articles={articles}
            categories={[...categories]}
            locale="ko"
          />
        </div>
      </main>

      <KoTopFooter />
    </div>
  );
}
