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
      <section className="bg-[#E4E0F5] py-6 px-4 min-h-screen">
        <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 pb-32 relative">
          {/* ヘッダー: ハンバーガーのみ右寄せ (ロゴはヒーロー中央へ移動) */}
          <div className="flex justify-end items-center mb-4">
            <button
              type="button"
              aria-label="メニュー"
              className="w-10 h-10 rounded-full bg-white border-2 border-[#3A2D6B] flex items-center justify-center text-[#3A2D6B]"
            >
              ☰
            </button>
          </div>

          {/* Day 2.6: 装飾画像 (4 階層、各装飾の背後に半透明白の outer glow を仕込み
              grid 線をぼかして装飾を浮き上がらせる)
              - 大/中: inset-[-12px|-8px] + blur-xl|lg + bg-white/60 + drop-shadow-md
              - 小:   inset-[-6px] + blur-md + bg-white/50 (sparkle は shadow なし)
              - 極小: glow なし (見た目を軽く保つ)
              全 9 個、pointer-events-none + aria-hidden + z-20 (マスコット z-10 より前面) */}

          {/* === 大型装飾 === */}
          {/* 大ハート (左上、+15deg) */}
          <div
            aria-hidden="true"
            className="absolute top-24 left-2 w-20 h-20 rotate-[15deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-12px] bg-white/60 rounded-full blur-xl" />
            <Image
              src="/decorations/heart-pink.png"
              alt=""
              width={80}
              height={80}
              className="relative w-full h-full object-contain drop-shadow-md"
            />
          </div>
          {/* 大花 (右上、-12deg) */}
          <div
            aria-hidden="true"
            className="absolute top-20 right-2 w-20 h-20 -rotate-[12deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-12px] bg-white/60 rounded-full blur-xl" />
            <Image
              src="/decorations/flower-yellow.png"
              alt=""
              width={80}
              height={80}
              className="relative w-full h-full object-contain drop-shadow-md"
            />
          </div>

          {/* === 中型装飾 (マスコット両脇) === */}
          {/* 黄星 (右、+25deg) */}
          <div
            aria-hidden="true"
            className="absolute top-64 right-6 w-14 h-14 rotate-[25deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-8px] bg-white/60 rounded-full blur-lg" />
            <Image
              src="/decorations/star-yellow.png"
              alt=""
              width={56}
              height={56}
              className="relative w-full h-full object-contain drop-shadow-md"
            />
          </div>
          {/* 青星 (左、-18deg、少し下にずらし) */}
          <div
            aria-hidden="true"
            className="absolute top-72 left-4 w-12 h-12 -rotate-[18deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-8px] bg-white/60 rounded-full blur-lg" />
            <Image
              src="/decorations/star-blue.png"
              alt=""
              width={48}
              height={48}
              className="relative w-full h-full object-contain drop-shadow-md"
            />
          </div>

          {/* === 小型装飾 (見出し / CTA 周辺) === */}
          {/* キラキラ (見出し右横) */}
          <div
            aria-hidden="true"
            className="absolute top-[500px] right-4 w-10 h-10 z-20 pointer-events-none"
          >
            <div className="absolute inset-[-6px] bg-white/50 rounded-full blur-md" />
            <Image
              src="/decorations/sparkle.png"
              alt=""
              width={40}
              height={40}
              className="relative w-full h-full object-contain"
            />
          </div>
          {/* 小ハート (CTA 左下、+20deg) */}
          <div
            aria-hidden="true"
            className="absolute bottom-36 left-8 w-10 h-10 rotate-[20deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-6px] bg-white/50 rounded-full blur-md" />
            <Image
              src="/decorations/heart-pink.png"
              alt=""
              width={40}
              height={40}
              className="relative w-full h-full object-contain drop-shadow-sm"
            />
          </div>
          {/* キラキラ (CTA 右横) */}
          <div
            aria-hidden="true"
            className="absolute bottom-40 right-6 w-8 h-8 z-20 pointer-events-none"
          >
            <div className="absolute inset-[-6px] bg-white/50 rounded-full blur-md" />
            <Image
              src="/decorations/sparkle.png"
              alt=""
              width={32}
              height={32}
              className="relative w-full h-full object-contain"
            />
          </div>

          {/* === 極小装飾 (glow なし、軽く) === */}
          {/* 極小キラキラ (マスコット上の隙間、opacity-70) */}
          <div
            aria-hidden="true"
            className="absolute top-40 right-[35%] w-6 h-6 z-20 pointer-events-none opacity-70"
          >
            <Image
              src="/decorations/sparkle.png"
              alt=""
              width={24}
              height={24}
              className="w-full h-full object-contain"
            />
          </div>
          {/* 極小キラキラ (見出し下の隙間、opacity-60) */}
          <div
            aria-hidden="true"
            className="absolute top-[700px] left-12 w-5 h-5 z-20 pointer-events-none opacity-60"
          >
            <Image
              src="/decorations/sparkle.png"
              alt=""
              width={20}
              height={20}
              className="w-full h-full object-contain"
            />
          </div>

          {/* ブランドロゴ (Brand v2 メインキャッチ、ヒーロー上段中央) */}
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={360}
              height={120}
              priority
              className="w-full max-w-[240px] h-auto"
            />
          </div>

          {/* マスコット (2 ショット) + アーチ背景 */}
          <div className="relative flex justify-center my-6">
            {/* アーチ背景 (Day 2: pink → blue グラデの 40% アルファ) */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 -translate-x-1/2 top-0 w-[300px] h-[280px] bg-gradient-to-b from-pink-200/40 to-blue-200/40 rounded-t-full"
            />

            {/* マスコット (前面) */}
            <Image
              src="/mascot-pair.png"
              alt="ワタシのトリセツのマスコット"
              width={300}
              height={300}
              priority
              className="relative z-10 w-full max-w-[280px] h-auto"
            />
          </div>

          {/* ステッカータグ (2 段重ね、上小逆回転 / 下大正回転) */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="bg-[#FFE993] text-[#3A2D6B] px-4 py-1.5 rounded-full text-xs font-black border-2 border-[#3A2D6B] transform -rotate-3 shadow-[2px_2px_0_#3A2D6B]">
              ぶっちゃけ、自分のこと分かってる？
            </div>
            <div className="bg-[#FFE993] text-[#3A2D6B] px-5 py-2 rounded-full text-sm font-black border-2 border-[#3A2D6B] transform rotate-2 shadow-[2px_2px_0_#3A2D6B]">
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
