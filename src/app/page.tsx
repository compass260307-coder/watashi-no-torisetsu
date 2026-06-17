import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import FloatingCTABar from "@/components/FloatingCTABar";
// Day 12-A: 装飾だけだった ☰ を 3 項目ハンバーガーメニューに置換
import { HamburgerMenu } from "@/components/HamburgerMenu";
// 診断済みユーザーを自分の結果ページへ自動誘導するための session 解決。
import { getSession } from "@/lib/session";
// トップ改修 (相互理解度主役): セクションを components/top に切り出し。
import { HeroSection } from "@/components/top/HeroSection";
import { MutualUnderstandingShowcase } from "@/components/top/MutualUnderstandingShowcase";
import { ZukanTeaser } from "@/components/top/ZukanTeaser";
import { ThreeSteps } from "@/components/top/ThreeSteps";
import { FinalCta } from "@/components/top/FinalCta";

const BASE_URL = "https://www.watashi-torisetsu.com";

// wn_session cookie を参照して出し分けるため、LP は動的レンダリングにする。
// (cookie 不在の新規訪問者・bot は getSession 内で DB を引かず即 null を返すので、
//  従来どおり LP がそのまま描画される。)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: BASE_URL },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "ワタシのトリセツ",
  description:
    "友達と作る、自分の取扱説明書。Big Five理論ベースの性格診断で、自分でも気づかない一面を発見できる大学生向けサービス。",
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
    <div className="flex flex-col flex-1 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* LP 全体: lavender 外周 + grid-bg 統合カード (既存の世界観を維持) */}
      <section className="bg-[#E4E0F5] py-6 px-4 min-h-screen">
        <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
          {/* ===== ヘッダー (左 logo.png + 右ハンバーガー) ===== */}
          <div className="flex justify-between items-center mb-4">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[140px] h-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
            />
            <HamburgerMenu />
          </div>

          {/* ① ファーストビュー (大キャッチ + マスコット + FV内CTA) */}
          <HeroSection />

          {/* ③ 価値訴求 (相互理解度主役・7章/有料訴求は撤去) */}
          <MutualUnderstandingShowcase />

          {/* ★ 32キャラ図鑑ゾーン (仮置き・第2弾でデザイン作り込み) */}
          <ZukanTeaser />

          {/* ④ かんたん3ステップ */}
          <ThreeSteps />

          {/* ⑤ 最終CTA */}
          <FinalCta />

          {/* ===== Footer 統合ブロック (カード内・既存維持) ===== */}
          <div className="bg-white/40 backdrop-blur-sm rounded-2xl p-6 mt-8 mb-2">
            <nav className="flex flex-col gap-3 mb-6">
              <Link
                href="/about"
                className="text-[#3A2D6B] font-bold text-sm hover:text-[#FE3C72] transition-colors w-fit"
              >
                サービスについて
              </Link>
              <Link
                href="/terms"
                className="text-[#3A2D6B] font-bold text-sm hover:text-[#FE3C72] transition-colors w-fit"
              >
                利用規約
              </Link>
              <Link
                href="/privacy"
                className="text-[#3A2D6B] font-bold text-sm hover:text-[#FE3C72] transition-colors w-fit"
              >
                プライバシーポリシー
              </Link>
              <Link
                href="/legal/commerce"
                className="text-[#3A2D6B] font-bold text-sm hover:text-[#FE3C72] transition-colors w-fit"
              >
                特定商取引法に基づく表記
              </Link>
              <a
                href="mailto:support@watashi-torisetsu.com"
                className="text-[#3A2D6B] font-bold text-sm hover:text-[#FE3C72] transition-colors w-fit"
              >
                お問い合わせ
              </a>
            </nav>

            <div
              aria-hidden="true"
              className="border-t border-[#3A2D6B]/20 mb-4"
            />

            <p className="text-[#3A2D6B]/80 text-xs leading-relaxed mb-3">
              お問い合わせ:{" "}
              <a
                href="mailto:support@watashi-torisetsu.com"
                className="font-bold hover:text-[#FE3C72] transition-colors underline underline-offset-2"
              >
                support@watashi-torisetsu.com
              </a>
            </p>

            <p className="text-[#3A2D6B]/60 text-xs text-center">
              © {new Date().getFullYear()} ワタシのトリセツ運営事務局
            </p>
          </div>
        </div>
      </section>

      {/* Cookie 状態認識フローティング CTA バー */}
      <FloatingCTABar />
    </div>
  );
}
