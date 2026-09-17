import type { Metadata } from "next";
import { ArticleGrid } from "@/components/articles/ArticleGrid";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { ID_ARTICLES, ID_ARTICLE_CATEGORIES } from "@/lib/articles-id";
import { localizedAlternates, SITE_URL } from "@/lib/locale-seo";

const NAVY = "#2E2E5C";
export const metadata: Metadata = {
  title: "Artikel",
  description: "Panduan jelas tentang OCEAN, pemahaman diri, kecocokan, dan sudut pandang teman.",
  alternates: localizedAlternates("id", "/articles", "/ko/articles", "/en/articles", "/id/articles"),
  openGraph: {
    type: "website", locale: "id_ID", alternateLocale: ["ja_JP", "ko_KR", "en_US"],
    url: `${SITE_URL}/id/articles`, siteName: "Alice Personalities", title: "Artikel | Alice Personalities",
    description: "Panduan praktis tentang kepribadian, pemahaman diri, dan hubungan.",
    images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024 }],
  },
};

export default function IndonesianArticlesPage() {
  const articles = [...ID_ARTICLES]
    .sort((a, b) => b.published.localeCompare(a.published))
    .map(({ slug, listTitle, description, category, published, image, imageAlt }) => ({ slug, listTitle, description, category, published, image, imageAlt }));
  const categories = ID_ARTICLE_CATEGORIES.filter((category) => ID_ARTICLES.some((article) => article.category === category));
  return (
    <div className="flex flex-1 flex-col bg-white">
      <TopHeader locale="id" />
      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
          <section className="pt-12 md:pt-16">
            <h1 className="font-bold" style={{ color: NAVY, fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.45 }}>Artikel</h1>
            <p className="mt-4 text-[15px] leading-[2]" style={{ color: `${NAVY}B3` }}>Jelajahi model kepribadian OCEAN dan cara praktis memahami diri serta hubungan tanpa istilah yang rumit.</p>
          </section>
          <ArticleGrid articles={articles} categories={[...categories]} locale="id" />
        </div>
      </main>
      <TopFooter locale="id" />
    </div>
  );
}
