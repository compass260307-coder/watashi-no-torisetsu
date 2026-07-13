import type { Metadata } from "next";
import { redirect } from "next/navigation";
// feat/top-page: トップを「診断をはじめる」一点に絞った 1 画面ヒーローに刷新。
import TopHeader from "@/components/top/TopHeader";
import TopHero from "@/components/top/TopHero";
import TopStats from "@/components/top/TopStats";
import TopFooter from "@/components/top/TopFooter";
// 診断済みユーザーを自分の結果ページへ自動誘導するための session 解決。
import { getSession } from "@/lib/session";

const BASE_URL = "https://www.watashi-torisetsu.com";

// CTA 補足の診断人数。⚠️ 当面は丸めた固定値 (仮)。
// 後で Supabase の実カウント (例: diagnosis_completed のユニーク数) に差し替える前提。
const DIAGNOSED_COUNT = 2400;

// wn_session cookie を参照して出し分けるため、LP は動的レンダリングにする。
// (cookie 不在の新規訪問者・bot は getSession 内で DB を引かず即 null を返すので、
//  従来どおり LP がそのまま描画される。)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: BASE_URL },
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
      inLanguage: "ja-JP",
      audience: {
        "@type": "Audience",
        audienceType: "大学生",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      name: "ワタシのトリセツ",
      url: BASE_URL,
      inLanguage: "ja-JP",
      publisher: { "@id": `${BASE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "ワタシのトリセツ運営事務局",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/icon.png`,
      },
    },
  ],
};

export default async function Home({
  searchParams,
}: {
  // ?stay=1 のときは自動リダイレクトせず LP を表示する (診断済みユーザーが
  // トップを見たい / 再診断したいときの逃げ道。/me 等の「トップ」リンクが付与する)。
  searchParams: Promise<{ stay?: string }>;
}) {
  const { stay } = await searchParams;

  // 診断済み (wn_session cookie → users 行に owner_token) なら自分の結果へ。
  // stay=1・cookie 不在・owner_token 不在 はいずれも従来どおり LP を表示。
  if (stay !== "1") {
    const session = await getSession();
    if (session?.owner_token) {
      // 注: redirect() は内部で例外を投げるため try/catch で囲まない。
      redirect(`/me/${session.owner_token}`);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <TopHeader />
      <TopHero />
      <TopStats diagnosedCount={DIAGNOSED_COUNT} />
      <TopFooter />
    </div>
  );
}
