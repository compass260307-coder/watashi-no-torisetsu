import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TopFooter from "@/components/top/TopFooter";
import TopHeader from "@/components/top/TopHeader";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { getIdArticle, getIdRelatedArticles, ID_ARTICLES } from "@/lib/articles-id";
import { localizedAlternates, SITE_URL } from "@/lib/locale-seo";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";
type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return ID_ARTICLES.map(({ slug }) => ({ slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getIdArticle((await params).slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: localizedAlternates("id", `/articles/${article.slug}`, `/ko/articles/${article.slug}`, `/en/articles/${article.slug}`, `/id/articles/${article.slug}`),
    openGraph: { type: "article", locale: "id_ID", alternateLocale: ["ja_JP", "ko_KR", "en_US"], siteName: "Alice Personalities", title: `${article.title} | Alice Personalities`, description: article.description, url: `${SITE_URL}/id/articles/${article.slug}`, images: [{ url: "/characters/keyvisual.webp", width: 1536, height: 1024 }] },
  };
}

export default async function IndonesianArticlePage({ params }: Props) {
  const article = getIdArticle((await params).slug);
  if (!article) notFound();
  const related = getIdRelatedArticles(article.slug);
  const url = `${SITE_URL}/id/articles/${article.slug}`;
  const jsonLd = { "@context": "https://schema.org", "@graph": [
    { "@type": "Article", "@id": `${url}#article`, headline: article.title, description: article.description, datePublished: article.published, dateModified: article.updated ?? article.published, inLanguage: "id-ID", mainEntityOfPage: url, author: { "@id": `${SITE_URL}/#organization` }, publisher: { "@id": `${SITE_URL}/#organization` }, image: `${SITE_URL}/characters/keyvisual.webp` },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Beranda", item: `${SITE_URL}/id` }, { "@type": "ListItem", position: 2, name: "Artikel", item: `${SITE_URL}/id/articles` }, { "@type": "ListItem", position: 3, name: article.listTitle }] },
  ] };
  return (
    <div className="flex flex-1 flex-col bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TopHeader locale="id" />
      <main className="w-full flex-1 px-8 pb-20"><div className="mx-auto max-w-[1080px]">
        <nav aria-label="Breadcrumb" className="pt-8 text-[12px]" style={{ color: `${NAVY}80` }}><Link href="/id" className="hover:underline">Beranda</Link><span aria-hidden className="mx-1.5">/</span><Link href="/id/articles" className="hover:underline">Artikel</Link></nav>
        <article>
          <header className="pt-6"><p className="text-[12px] font-bold tracking-wide" style={{ color: SORA }}>{article.category}</p><h1 className="font-bold" style={{ color: NAVY, fontSize: "clamp(26px, 4.5vw, 36px)", lineHeight: 1.5 }}>{article.title}</h1><p className="mt-3 text-[12px]" style={{ color: `${NAVY}80` }}><time dateTime={article.published}>{article.published.replaceAll("-", ".")}</time>{article.updated ? <> (Diperbarui: <time dateTime={article.updated}>{article.updated.replaceAll("-", ".")}</time>)</> : null}</p></header>
          <div className="mt-8 flex items-center justify-center rounded-2xl px-8 pt-8" style={{ backgroundColor: "#F4F4FE" }}><SmoothImage src={article.image} alt={article.imageAlt} width={1448} height={1086} priority className="h-auto w-full max-w-[440px]" /></div>
          <div className="mt-8 flex flex-col gap-4 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>{article.lead.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          {article.sections.map((section) => <section key={section.heading} className="mt-14"><h2 className="text-[20px] font-bold leading-snug md:text-[24px]" style={{ color: NAVY }}>{section.heading}</h2><div className="mt-5 flex flex-col gap-4 text-[15px] leading-[2]" style={{ color: `${NAVY}CC` }}>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>{section.list ? <ul className="mt-5 flex flex-col gap-4">{section.list.map((item) => <li key={item.term} className="rounded-2xl border-2 p-5" style={{ borderColor: "#E3E6F5" }}><h3 className="text-[15px] font-bold leading-snug" style={{ color: NAVY }}>{item.term}</h3><p className="mt-1.5 text-[14px] leading-[1.9]" style={{ color: `${NAVY}B3` }}>{item.body}</p></li>)}</ul> : null}</section>)}
        </article>
        <section className="mt-16 text-center"><p className="text-[18px] font-bold leading-snug md:text-[20px]" style={{ color: NAVY }}>Mulailah dengan mengukur lima dimensi kepribadian Anda.</p><Link href="/id/diagnosis" className="sora-cta mt-6 inline-block rounded-full px-14 py-4 text-center text-[20px] font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5">Ikuti tes kepribadian gratis →</Link></section>
        <nav aria-label="Artikel terkait" className="mt-14"><h2 className="text-[16px] font-bold leading-snug" style={{ color: NAVY }}>Bacaan terkait</h2><ul className="mt-4 flex flex-col gap-2.5">{related.map((item) => <li key={item.slug}><Link href={`/id/articles/${item.slug}`} className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>{item.listTitle} →</Link></li>)}<li><Link href="/id/types" className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>Lihat semua 32 tipe kepribadian →</Link></li><li><Link href="/id/about" className="text-[14px] font-bold underline underline-offset-4" style={{ color: SORA }}>Cara kerja Alice Personalities →</Link></li></ul></nav>
      </div></main>
      <TopFooter locale="id" />
    </div>
  );
}
