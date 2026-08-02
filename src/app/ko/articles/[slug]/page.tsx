import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import {
  getKoArticle,
  KO_ARTICLES,
} from "@/lib/articles-ko";
import {
  localizedAlternates,
  SITE_URL as BASE_URL,
} from "@/lib/locale-seo";

const FONT_STACK =
  "var(--font-noto-sans), 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

interface KoreanArticlePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return KO_ARTICLES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: KoreanArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getKoArticle(slug);
  if (!article) return {};

  const japanesePath = `/articles/${article.slug}`;
  const koreanPath = `/ko/articles/${article.slug}`;

  return {
    title: { absolute: `${article.title} | 나의 사용설명서` },
    description: article.description,
    alternates: localizedAlternates("ko", japanesePath, koreanPath),
    openGraph: {
      type: "article",
      locale: "ko_KR",
      alternateLocale: ["ja_JP"],
      siteName: "나의 사용설명서",
      title: `${article.title} | 나의 사용설명서`,
      description: article.description,
      url: `${BASE_URL}${koreanPath}`,
      images: [{ url: "/ogp-v4.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | 나의 사용설명서`,
      description: article.description,
      images: ["/ogp-v4.png"],
    },
  };
}

export default async function KoreanArticlePage({
  params,
}: KoreanArticlePageProps) {
  const { slug } = await params;
  const article = getKoArticle(slug);
  if (!article) notFound();

  const url = `${BASE_URL}/ko/articles/${article.slug}`;
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
        inLanguage: "ko-KR",
        mainEntityOfPage: url,
        author: { "@id": `${BASE_URL}/#organization` },
        publisher: { "@id": `${BASE_URL}/#organization` },
        image: `${BASE_URL}/ogp-v4.png`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "홈",
            item: `${BASE_URL}/ko`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "글·칼럼",
            item: `${BASE_URL}/ko/articles`,
          },
          { "@type": "ListItem", position: 3, name: article.listTitle },
        ],
      },
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "나의 사용설명서 운영팀",
        url: BASE_URL,
      },
    ],
  };

  return (
    <div
      className="flex flex-1 flex-col bg-white"
      style={{ fontFamily: FONT_STACK }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <KoTopHeader />

      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
          <nav
            aria-label="이동 경로"
            className="pt-8 text-[12px]"
            style={{ color: `${NAVY}80` }}
          >
            <Link href="/ko" className="hover:underline">
              홈
            </Link>
            <span aria-hidden className="mx-1.5">
              /
            </span>
            <Link href="/ko/articles" className="hover:underline">
              글·칼럼
            </Link>
          </nav>

          <article>
            <header className="pt-6">
              <p
                className="text-[12px] font-bold"
                style={{ color: SORA }}
              >
                {article.category}
              </p>
              <h1
                className="break-keep font-bold"
                style={{
                  color: NAVY,
                  fontSize: "clamp(26px, 4.5vw, 36px)",
                  lineHeight: 1.5,
                }}
              >
                {article.title}
              </h1>
              <p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}>
                <time dateTime={article.published}>
                  {article.published.replaceAll("-", ".")}
                </time>
                {article.updated && (
                  <>
                    {" "}
                    (수정:{" "}
                    <time dateTime={article.updated}>
                      {article.updated.replaceAll("-", ".")}
                    </time>
                    )
                  </>
                )}
              </p>
            </header>

            <div
              className="mt-8 flex items-center justify-center rounded-2xl px-8 pt-8"
              style={{ backgroundColor: "#F4F4FE" }}
            >
              <SmoothImage
                src={article.image}
                alt={article.imageAlt}
                width={1448}
                height={1086}
                priority
                className="h-auto w-full max-w-[440px]"
              />
            </div>

            <div
              className="mt-8 flex flex-col gap-4 break-keep text-[15px] leading-[2]"
              style={{ color: `${NAVY}CC` }}
            >
              {article.lead.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            {article.sections.map((section) => (
              <section key={section.heading} className="mt-14">
                <h2
                  className="break-keep text-[20px] font-bold leading-snug md:text-[24px]"
                  style={{ color: NAVY }}
                >
                  {section.heading}
                </h2>
                <div
                  className="mt-5 flex flex-col gap-4 break-keep text-[15px] leading-[2]"
                  style={{ color: `${NAVY}CC` }}
                >
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {section.list && (
                  <ul className="mt-5 flex flex-col gap-4">
                    {section.list.map((item) => (
                      <li
                        key={item.term}
                        className="rounded-2xl border-2 p-5"
                        style={{ borderColor: "#E3E6F5" }}
                      >
                        <h3
                          className="break-keep text-[15px] font-bold leading-snug"
                          style={{ color: NAVY }}
                        >
                          {item.term}
                        </h3>
                        <p
                          className="mt-1.5 break-keep text-[14px] leading-[1.9]"
                          style={{ color: `${NAVY}B3` }}
                        >
                          {item.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>

          <section className="mt-16 text-center">
            <p
              className="break-keep text-[18px] font-bold leading-snug md:text-[20px]"
              style={{ color: NAVY }}
            >
              먼저 나의 5가지 성격 요인을 측정해 보세요.
            </p>
            <Link
              href="/ko/diagnosis"
              className="sora-cta mt-6 inline-block rounded-full px-8 py-4 text-center text-[18px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5 sm:px-14 sm:text-[20px]"
            >
              무료 성격 진단 테스트 시작하기 →
            </Link>
          </section>

          <nav aria-label="관련 페이지" className="mt-14">
            <h2
              className="text-[16px] font-bold leading-snug"
              style={{ color: NAVY }}
            >
              함께 읽어 보세요
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <Link
                  href="/ko/types"
                  className="text-[14px] font-bold underline underline-offset-4"
                  style={{ color: SORA }}
                >
                  32가지 성격 유형 전체 보기 →
                </Link>
              </li>
              <li>
                <Link
                  href="/ko/about"
                  className="text-[14px] font-bold underline underline-offset-4"
                  style={{ color: SORA }}
                >
                  나의 사용설명서 이용 방법 알아보기 →
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </main>

      <KoTopFooter />
    </div>
  );
}
