import type { Metadata } from "next";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { EN_ARTICLES, EN_ARTICLE_CATEGORIES } from "@/lib/articles-en";
import { EN_BRAND_NAME, localizedAlternates, SITE_URL } from "@/lib/locale-seo";

const NAVY = "#2E2E5C";

export const metadata: Metadata = {
  title: "Articles",
  description: "Clear guides to the OCEAN personality model, self-understanding, compatibility, and feedback from friends.",
  alternates: localizedAlternates("en", "/articles", "/ko/articles", "/en/articles"),
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ja_JP", "ko_KR"],
    url: `${SITE_URL}/en/articles`,
    siteName: EN_BRAND_NAME,
    title: `Articles | ${EN_BRAND_NAME}`,
    description: "Clear guides to personality, self-understanding, and relationships.",
    images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024 }],
  },
};

export default function EnglishArticlesPage() {
  const articles = [...EN_ARTICLES]
    .sort((a, b) => b.published.localeCompare(a.published))
    .map(({ slug, listTitle, description, category, published, image, imageAlt }) => ({
      slug,
      listTitle,
      description,
      category,
      published,
      image,
      imageAlt,
    }));

  const categories = EN_ARTICLE_CATEGORIES.filter((category) =>
    EN_ARTICLES.some((article) => article.category === category),
  );

  return (
    <div className="flex flex-1 flex-col bg-white">
      <EnSiteHeader />
      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
          <section className="pt-12 md:pt-16">
            <h1 className="font-bold" style={{ color: NAVY, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.45 }}>
              Articles
            </h1>
            <p className="mt-4 text-[15px] leading-[2]" style={{ color: `${NAVY}B3` }}>
              Explore the OCEAN personality model and practical ways to understand yourself and your relationships—without unnecessary jargon.
            </p>
          </section>
          <ArticleGrid articles={articles} categories={[...categories]} locale="en" />
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
