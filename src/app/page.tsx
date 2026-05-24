import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { StepCard } from "@/components/StepCard";
import { TypeCarousel } from "@/components/TypeCarousel";
import Footer from "@/components/Footer";
import FloatingCTABar from "@/components/FloatingCTABar";

const BASE_URL = "https://www.watashi-torisetsu.com";

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

export default function Home() {
  return (
    <div className="flex flex-col flex-1 pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Phase 1.5-α Brand v2 ヒーロー (full-bleed、外周 lavender + 内側 grid-bg) */}
      {/* TODO(brand-v2): /public/logo.png 未配置のためロゴはテキストのまま。
          画像が用意され次第、ヘッダーの <div> を <Image> に差し替え。 */}
      <section className="bg-[#E4E0F5] py-6 px-4 min-h-screen">
        <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 pb-32 relative">
          {/* ヘッダー: ロゴ + ハンバーガー */}
          <div className="flex justify-between items-center mb-8">
            <div className="text-2xl font-black text-[#3A2D6B]">
              ワタシのトリセツ
            </div>
            <button
              type="button"
              aria-label="メニュー"
              className="w-10 h-10 rounded-full bg-white border-2 border-[#3A2D6B] flex items-center justify-center text-[#3A2D6B]"
            >
              ☰
            </button>
          </div>

          {/* 装飾 (上部) */}
          <div className="absolute top-20 left-8 text-3xl pointer-events-none" aria-hidden="true">
            ⭐
          </div>
          <div className="absolute top-16 right-8 text-3xl pointer-events-none" aria-hidden="true">
            🌸
          </div>

          {/* マスコット (2 ショット、Brand v2 画像) */}
          <div className="flex justify-center my-8">
            <Image
              src="/mascot-pair.png"
              alt="ワタシのトリセツのマスコット"
              width={300}
              height={300}
              priority
              className="w-full max-w-[280px] h-auto"
            />
          </div>

          {/* ステッカータグ */}
          <div className="flex justify-center mb-6">
            <div className="bg-[#FFE993] text-[#3A2D6B] px-5 py-2 rounded-full text-sm font-bold border-2 border-[#3A2D6B] transform -rotate-2">
              友達には、こう映ってるかも
            </div>
          </div>

          {/* メイン見出し (Brand v2 画像) */}
          <div className="flex justify-center mb-6">
            <Image
              src="/heading-hero.png"
              alt="真のアナタを、知ろう。"
              width={400}
              height={300}
              priority
              className="w-full max-w-[320px] h-auto"
            />
          </div>

          {/* サブコピー */}
          <p className="text-center text-[#2A2856] text-base font-bold leading-relaxed mb-8 px-4">
            自己診断 × 友達評価 × AI で、
            <br />
            自分でも気づかなかった
            <br />
            アナタが見えてくる
          </p>

          {/* メイン CTA */}
          <div className="flex justify-center mb-3">
            <Link
              href="/diagnosis"
              className="bg-[#FFE993] text-[#3A2D6B] px-10 py-4 rounded-full text-lg font-black border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:shadow-[0_2px_0_#3A2D6B] hover:translate-y-[2px] transition-all"
            >
              無料で診断する →
            </Link>
          </div>

          {/* 補足 */}
          <p className="text-center text-sm text-[#2A2856]/70 font-medium">
            3 分 ・ 登録不要 ・ 全部無料
          </p>

          {/* 装飾 (下部) */}
          <div
            className="absolute bottom-32 left-10 text-3xl pointer-events-none"
            aria-hidden="true"
          >
            💗
          </div>
          <div
            className="absolute bottom-28 right-10 text-3xl pointer-events-none"
            aria-hidden="true"
          >
            ✨
          </div>
        </div>
      </section>

      <main className="flex flex-col flex-1 items-center px-5 py-12">
        {/* Types preview (carousel) */}
        <section className="w-full max-w-2xl mb-10 animate-fade-in-up stagger-2">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold mb-1">
            あなたはどのペンギン？
          </h2>
          <p className="text-center text-sm text-muted mb-5 leading-relaxed">
            8 ベースタイプ × 4 サブパターン
            <br />
            <span className="font-bold text-primary">全 32 通りの個性</span>
          </p>
          <TypeCarousel />
          <div className="flex justify-center mt-6">
            <Link
              href="/zukan/all"
              className="inline-flex items-center gap-2 rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.04] active:scale-[0.98]"
            >
              <span>全 32 タイプの図鑑を見る</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        {/* Steps */}
        <section className="w-full max-w-4xl mb-10 animate-fade-in-up stagger-3">
          <h2 className="text-center text-xs font-bold tracking-wider text-muted mb-5 uppercase">
            かんたん3ステップ
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <StepCard
              stepNumber={1}
              imageSrc="/mascot/step1-receive.png"
              title={
                <>
                  15問に答えて
                  <br />
                  仮トリセツが届く
                </>
              }
              subtitle="直感でOK・3分でできる"
            />
            <StepCard
              stepNumber={2}
              imageSrc="/mascot/step2-ask-friend.png"
              title="友達に診断してもらう"
              subtitle="友達は10問・2分で完了"
            />
            <StepCard
              stepNumber={3}
              imageSrc="/mascot/step3-complete.png"
              title="トリセツが完成"
              subtitle="友達3人で詳細レポート解放"
            />
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="w-full max-w-sm text-center mb-8 animate-fade-in-up stagger-4">
          <Link
            href="/diagnosis"
            className="inline-block w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-center text-lg font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98]"
          >
            さっそく始める
          </Link>
        </section>
      </main>

      <Footer />

      {/* Phase 1.5-α Day 1: Cookie 状態認識フローティング CTA バー (Server Component) */}
      <FloatingCTABar />
    </div>
  );
}
