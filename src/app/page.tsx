import type { Metadata } from "next";
// feat/top-page: トップを「診断をはじめる」一点に絞った 1 画面ヒーローに刷新。
import TopPage from "@/components/top/TopPage";
import HomeSessionRedirect from "@/components/top/HomeSessionRedirect";
import { GLOBAL_SITE_NAME } from "@/lib/locale-seo";

const BASE_URL = "https://www.watashi-torisetsu.com";

// LP本体は静的配信し、診断済みユーザーの転送だけをクライアントへ分離する。
export const dynamic = "force-static";

export const metadata: Metadata = {
  alternates: {
    canonical: BASE_URL,
    languages: {
      "ja-JP": BASE_URL,
      "ko-KR": `${BASE_URL}/ko`,
      "en-US": `${BASE_URL}/en`,
      "id-ID": `${BASE_URL}/id`,
      "x-default": BASE_URL,
    },
  },
};

// 構造化データ: WebApplication (既存) に加え、WebSite / Organization を
// @graph でまとめて宣言 (サイト名の検索表示・ナレッジパネルの手がかり)。
// 見た目には一切影響しない。
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      "@id": `${BASE_URL}/#app`,
      name: "ワタシのトリセツ",
      description:
        "約3分でできるOCEAN(Big Five)理論ベースの無料性格診断テスト。16タイプ性格診断よりも細かい32タイプのキャラに分類され、友達の回答で自分では気づかない一面まで見えてくる大学生向けサービス。",
      url: BASE_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "JPY",
      },
      brand: { "@id": `${BASE_URL}/#brand` },
      inLanguage: "ja-JP",
      audience: {
        "@type": "Audience",
        audienceType: "大学生",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      name: GLOBAL_SITE_NAME,
      // 表記ゆれ (私の取説 等) での検索・サイト名認識のヒント。
      // Google はサイト名の判定に WebSite.alternateName を参照する。
      alternateName: [
        "ワタシのトリセツ",
        "私のトリセツ",
        "わたしのトリセツ",
        "ワタシの取説",
        "私の取説",
        "私の取扱説明書",
        "Alice Test",
        "앨리스 진단",
        "Alice 진단",
        "나의 사용설명서",
        "watashi-torisetsu.com",
      ],
      url: BASE_URL,
      inLanguage: ["ja-JP", "ko-KR", "en-US", "id-ID"],
      publisher: { "@id": `${BASE_URL}/#organization` },
    },
    {
      "@type": "Brand",
      "@id": `${BASE_URL}/#brand`,
      name: GLOBAL_SITE_NAME,
      url: BASE_URL,
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: GLOBAL_SITE_NAME,
      alternateName: "ワタシのトリセツ運営事務局",
      url: BASE_URL,
      brand: { "@id": `${BASE_URL}/#brand` },
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.png`,
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <HomeSessionRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <TopPage locale="ja" />
    </>
  );
}
