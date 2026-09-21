import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import {
  EN_ARTICLES,
  getEnArticle,
  getEnRelatedArticles,
} from "@/lib/articles-en";
import { EN_BRAND_NAME, localizedAlternates, SITE_URL } from "@/lib/locale-seo";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return EN_ARTICLES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getEnArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: localizedAlternates(
      "en",
      `/articles/${article.slug}`,
      `/ko/articles/${article.slug}`,
      `/en/articles/${article.slug}`,
      `/id/articles/${article.slug}`,
    ),
    openGraph: {
      type: "article",
      locale: "en_US",
      alternateLocale: ["ja_JP", "ko_KR"],
      siteName: EN_BRAND_NAME,
      title: `${article.title} | ${EN_BRAND_NAME}`,
      description: article.description,
      url: `${SITE_URL}/en/articles/${article.slug}`,
      images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | ${EN_BRAND_NAME}`,
      description: article.description,
      images: ["/characters/keyvisual.webp"],
    },
  };
}

export default async function EnglishArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getEnArticle(slug);
  if (!article) notFound();

  const url = `${SITE_URL}/en/articles/${article.slug}`;
  const related = getEnRelatedArticles(article.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        datePublished: article.published,
        dateModified: article.updated ?? article.published,
        inLanguage: "en-US",
        mainEntityOfPage: url,
        author: { "@id": `${SITE_URL}/#organization` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        image: `${SITE_URL}/characters/keyvisual.webp`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: "Articles", item: `${SITE_URL}/en/articles` },
          { "@type": "ListItem", position: 3, name: article.listTitle },
        ],
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: EN_BRAND_NAME,
        url: SITE_URL,
      },
    ],
  };

  return (
    <div className="flex flex-1 flex-col bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <EnSiteHeader />
      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
          <nav aria-label="Breadcrumb" className="pt-8 text-[12px]" style={{ color: `${NAVY}80` }}>
            <Link href="/en" className="hover:underline">Home</Link>
            <span aria-hidden className="mx-1.5">/</span>
            <Link href="/en/articles" className="hover:underline">Articles</Link>
          </nav>

          <article>
            <header className="pt-6">
              <p className="text-[12px] font-bold tracking-wide" style={{ color: SORA }}>{article.category}</p>
              <h1 className="font-bold" style={{ color: NAVY, fontSize: "clamp(26px, 4.5vw, 36px)", lineHeight: 1.5 }}>
                {article.title}
              </h1>
              <p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}>
                <time dateTime={article.published}>{article.published.replaceAll("-", ".")}</time>
                {article.updated ? (
                  <> (Updated: <time dateTime={article.updated}>{article.updated.replaceAll("-", ".")}</time>)</>
                ) : null}
              </p>
            </header>

            <div className="mt-8 flex items-center justify-center rounded-2xl px-8 pt-8" style={{ backgroundColor: "#F4F4FE" }}>
              <SmoothImage src={article.image} alt={article.imageAlt} width={1448} height={1086} priority className="h-auto w-full max-w-[440px]" />
            </div>

            <div className="mt-8 flex flex-col gap-4 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>
              {article.lead.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>

            {article.sections.map((section) => (
              <section key={section.heading} className="mt-14">
                <h2 className="text-[20px] font-bold leading-snug md:text-[24px]" style={{ color: NAVY }}>{section.heading}</h2>
                <div className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                {section.list ? (
                  <ul className="mt-5 flex flex-col gap-4">
                    {section.list.map((item) => (
                      <li key={item.term} className="rounded-2xl border-2 p-5" style={{ borderColor: "#E3E6F5" }}>
                        <h3 className="text-[15px] font-bold leading-snug" style={{ color: NAVY }}>{item.term}</h3>
                        <p className="mt-1.5 text-[14px] leading-[1.9]" style={{ color: `${NAVY}B3` }}>{item.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>

          <section className="mt-16 text-center">
            <p className="text-[18px] font-bold leading-snug md:text-[20px]" style={{ color: NAVY }}>
              Start by measuring your five personality dimensions.
            </p>
            <Link href="/en/diagnosis" className="sora-cta mt-6 inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5">
              Take the free personality test →
            </Link>
          </section>

          <nav aria-label="Related pages" className="mt-14">
            <h2 className="text-[16px] font-bold leading-snug" style={{ color: NAVY }}>Related reading</h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {related.map((relatedArticle) => (
                <li key={relatedArticle.slug}>
                  <Link href={`/en/articles/${relatedArticle.slug}`} className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>
                    {relatedArticle.listTitle} →
                  </Link>
                </li>
              ))}
              <li><Link href="/en/types" className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>Browse all 32 personality types →</Link></li>
              <li><Link href="/en/about" className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>How Alice Personalities works →</Link></li>
            </ul>
          </nav>
        </div>
      </main>
      <EnSiteFooter />
    </div>
  );
}
