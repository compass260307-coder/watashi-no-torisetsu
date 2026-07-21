// 記事詳細 (/articles/[slug])。SEO 用の解説コンテンツ。
// 内容は src/lib/articles.ts が単一情報源 (UI / metadata / JSON-LD すべてここから派生)。
// /preview/[typeId] と同じくビルド時に静的生成し、未知 slug は即 404。
// デザインは /about の読み物スタイル (白基調・ネイビー・左寄せ章立て) に合わせる。
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { ARTICLES, getArticle } from "@/lib/articles";

const BASE_URL = "https://www.watashi-torisetsu.com";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return ARTICLES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title: `${article.title}｜ワタシのトリセツ`,
      description: article.description,
      url: `${BASE_URL}/articles/${article.slug}`,
      images: [{ url: "/ogp-v4.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title}｜ワタシのトリセツ`,
      description: article.description,
      images: ["/ogp-v4.png"],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const url = `${BASE_URL}/articles/${article.slug}`;
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
        inLanguage: "ja-JP",
        mainEntityOfPage: url,
        author: { "@id": `${BASE_URL}/#organization` },
        publisher: { "@id": `${BASE_URL}/#organization` },
        image: `${BASE_URL}/ogp-v4.png`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ホーム", item: BASE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "記事・コラム",
            item: `${BASE_URL}/articles`,
          },
          { "@type": "ListItem", position: 3, name: article.listTitle },
        ],
      },
      // author/publisher の参照先 (トップと同じ @id で宣言し直す)
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "ワタシのトリセツ運営事務局",
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
      <TopHeader />

      {/* 横幅はフッター (TopFooter) と同じ構造 (外側 px-8 + 内側 max-w-[1080px]) で揃える */}
      <main className="w-full flex-1 px-8 pb-20">
        <div className="mx-auto max-w-[1080px]">
        {/* パンくず */}
        <nav
          aria-label="パンくず"
          className="pt-8 text-[12px]"
          style={{ color: `${NAVY}80` }}
        >
          <Link href="/" className="hover:underline">
            ホーム
          </Link>
          <span aria-hidden className="mx-1.5">
            /
          </span>
          <Link href="/articles" className="hover:underline">
            記事・コラム
          </Link>
        </nav>

        <article>
          <header className="pt-6">
            <p
              className="text-[12px] font-bold tracking-wide"
              style={{ color: SORA }}
            >
              {article.category}
            </p>
            <h1
              className="font-bold"
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
                  (更新:{" "}
                  <time dateTime={article.updated}>
                    {article.updated.replaceAll("-", ".")}
                  </time>
                  )
                </>
              )}
            </p>
          </header>

          {/* ヘッダーイラスト (一覧カードと同じフェルト調シーン) */}
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
            className="mt-8 flex flex-col gap-4 text-[15px] leading-[2]"
            style={{ color: `${NAVY}CC` }}
          >
            {article.lead.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          {article.sections.map((section) => (
            <section key={section.heading} className="mt-14">
              <h2
                className="text-[20px] font-bold leading-snug md:text-[24px]"
                style={{ color: NAVY }}
              >
                {section.heading}
              </h2>
              <div
                className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]"
                style={{ color: `${NAVY}CC` }}
              >
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
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
                        className="text-[15px] font-bold leading-snug"
                        style={{ color: NAVY }}
                      >
                        {item.term}
                      </h3>
                      <p
                        className="mt-1.5 text-[14px] leading-[1.9]"
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

        {/* CTA: /about と同じ sora-cta ピル */}
        <section className="mt-16 text-center">
          <p
            className="text-[18px] font-bold leading-snug md:text-[20px]"
            style={{ color: NAVY }}
          >
            まずは、自分の5因子を測ってみよう。
          </p>
          <Link
            href="/diagnosis"
            className="sora-cta mt-6 inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5"
          >
            無料で性格診断テストを受ける →
          </Link>
        </section>

        {/* 関連リンク (内部リンク: /types /about へ回遊) */}
        <nav aria-label="関連ページ" className="mt-14">
          <h2
            className="text-[16px] font-bold leading-snug"
            style={{ color: NAVY }}
          >
            あわせて読みたい
          </h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <Link
                href="/types"
                className="text-[14px] font-bold underline underline-offset-4"
                style={{ color: SORA }}
              >
                32の性格タイプ一覧を見る →
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-[14px] font-bold underline underline-offset-4"
                style={{ color: SORA }}
              >
                ワタシのトリセツの仕組みを知る →
              </Link>
            </li>
          </ul>
        </nav>
        </div>
      </main>

      <TopFooter />
    </div>
  );
}
