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
        <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 pb-32 relative border-[3px] border-[#0094D8]">
          {/* ヘッダー: 左ロゴ (小) + 右ハンバーガー
              Day 3.8: 控えめ halo (bg-white/35 blur-md) を復活、grid との被り解消 */}
          <div className="flex justify-between items-center mb-4">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute inset-[-6px] bg-white/35 rounded-2xl blur-md pointer-events-none"
              />
              <Image
                src="/logo.png"
                alt="ワタシのトリセツ"
                width={160}
                height={54}
                priority
                className="relative h-auto w-[140px]"
              />
            </div>
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
              - 大/中: inset-[-12px|-8px] + blur-xl|lg + bg-white/30 + drop-shadow-md
              - 小:   inset-[-6px] + blur-md + bg-white/25 (sparkle は shadow なし)
              Day 3.6: 白もや軽減のため glow 不透明度を 60/50 → 30/25 に下げた
              - 極小: glow なし (見た目を軽く保つ)
              全 9 個、pointer-events-none + aria-hidden + z-20 (マスコット z-10 より前面) */}

          {/* === 大型装飾 === */}
          {/* 大ハート (左上、+15deg) */}
          <div
            aria-hidden="true"
            className="absolute top-24 left-2 w-20 h-20 rotate-[15deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-12px] bg-white/30 rounded-full blur-xl" />
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
            <div className="absolute inset-[-12px] bg-white/30 rounded-full blur-xl" />
            <Image
              src="/decorations/flower-yellow.png"
              alt=""
              width={80}
              height={80}
              className="relative w-full h-full object-contain drop-shadow-md"
            />
          </div>

          {/* === 中型装飾 (Day 3.8 で削除) ===
              旧: 黄星 (top-[420px] right-4) + 青星 (top-[440px] left-4) の 2 個
              いずれもマスコット体に被るため完全削除。star-yellow.png / star-blue.png
              のアセット自体は /public/decorations/ に残置 (将来 ヒーロー以外で利用可) */}

          {/* === 小型装飾 (見出し / CTA 周辺) === */}
          {/* キラキラ (見出し右横) */}
          <div
            aria-hidden="true"
            className="absolute top-[500px] right-4 w-10 h-10 z-20 pointer-events-none"
          >
            <div className="absolute inset-[-6px] bg-white/25 rounded-full blur-md" />
            <Image
              src="/decorations/sparkle.png"
              alt=""
              width={40}
              height={40}
              className="relative w-full h-full object-contain"
            />
          </div>
          {/* 小ハート (CTA 左下、+20deg) — Day 3: bottom-36 left-8 → bottom-28 left-6 で CTA から離す */}
          <div
            aria-hidden="true"
            className="absolute bottom-28 left-6 w-10 h-10 rotate-[20deg] z-20 pointer-events-none"
          >
            <div className="absolute inset-[-6px] bg-white/25 rounded-full blur-md" />
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
            <div className="absolute inset-[-6px] bg-white/25 rounded-full blur-md" />
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

          {/* Day 3: 中央ロゴ (旧 /logo.png) はヘッダー左上に移動済のため削除。
              メインキャッチは下段の /logo-hero.png に移行 */}

          {/* Day 3.5: マスコット + ロゴ重ね合わせブロック (Koi キャラ風)
              マスコット下半分にロゴが被さるように absolute 配置。
              ロゴは z-20 でマスコット z-10 より前面、下に bottom-[-30px] で食み出させる */}
          <div className="relative my-6">
            {/* マスコット + アーチ */}
            <div className="relative flex justify-center">
              {/* アーチ背景 (pink → blue 40% グラデのドーム) */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 -translate-x-1/2 top-0 w-[300px] h-[280px] bg-gradient-to-b from-pink-200/40 to-blue-200/40 rounded-t-full"
              />

              {/* マスコット画像 (前面) */}
              <Image
                src="/mascot-pair.png"
                alt="ワタシのトリセツのマスコット"
                width={300}
                height={300}
                priority
                className="relative z-10 w-full max-w-[280px] h-auto"
              />
            </div>

            {/* ロゴをマスコット下半分に重ねる (bottom-[-30px] で食み出し、z-20 で前面) */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[-30px] z-20 w-full">
              <div className="relative flex justify-center">
                {/* Day 3.6: 大ロゴの halo を削除 (ロゴ自体の縁取りで十分浮く) */}
                <Image
                  src="/logo-hero.png"
                  alt="ワタシのトリセツ by AI"
                  width={600}
                  height={300}
                  priority
                  className="relative w-full max-w-[300px] h-auto"
                />
              </div>
            </div>
          </div>

          {/* マスコット + ロゴ重ねブロック分の余白確保 (bottom-[-30px] のはみ出しを吸収) */}
          <div aria-hidden="true" className="h-16" />

          {/* ステッカータグ (2 段重ね、ロゴの下に移動) */}
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="bg-[#FFE993] text-[#3A2D6B] px-4 py-1.5 rounded-full text-xs font-black border-2 border-[#3A2D6B] transform -rotate-3 shadow-[2px_2px_0_#3A2D6B]">
              ぶっちゃけ、自分のこと分かってる？
            </div>
            <div className="bg-[#FFE993] text-[#3A2D6B] px-5 py-2 rounded-full text-sm font-black border-2 border-[#3A2D6B] transform rotate-2 shadow-[2px_2px_0_#3A2D6B]">
              友達には、こう映ってるかも
            </div>
          </div>

          {/* Day 3.7: 見出し画像「真のアナタを、知ろう。」を再追加
              ステッカータグ 2 段の下、サブコピーの上に配置。メインキャッチとして強調。
              halo は薄め (bg-white/25) で白もや軽減 */}
          <div className="relative flex justify-center mb-6">
            <div
              aria-hidden="true"
              className="absolute inset-x-4 inset-y-0 bg-white/25 rounded-3xl blur-2xl pointer-events-none"
            />
            <Image
              src="/heading-hero.png"
              alt="真のアナタを、知ろう。"
              width={400}
              height={300}
              priority
              className="relative w-full max-w-[300px] h-auto"
            />
          </div>

          {/* サブコピー — Day 3.6: halo 不透明度 50 → 25 に下げて白もや軽減 */}
          <div className="relative mb-8 px-4">
            <div
              aria-hidden="true"
              className="absolute inset-x-2 inset-y-[-8px] bg-white/25 rounded-2xl blur-xl pointer-events-none"
            />
            <p className="relative text-center text-[#2A2856] text-base font-bold leading-relaxed">
              自己診断 × 友達評価 × AI で、
              <br />
              自分でも気づかなかった
              <br />
              アナタが見えてくる
            </p>
          </div>

          {/* メイン CTA — Day 3.6: halo を削除 (ボタン黄色背景で grid から十分浮く) */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Link
                href="/diagnosis"
                className="relative bg-[#FFE993] text-[#3A2D6B] px-10 py-4 rounded-full text-lg font-black border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:shadow-[0_2px_0_#3A2D6B] hover:translate-y-[2px] active:shadow-[0_0_0_#3A2D6B] active:translate-y-[4px] transition-all"
              >
                無料で診断する →
              </Link>
            </div>
          </div>

          {/* 補足 — Day 3.6: halo 不透明度 70 → 40 に下げて白もや軽減 */}
          <div className="relative flex justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-x-1/4 inset-y-[-10px] bg-white/40 rounded-full blur-lg pointer-events-none"
            />
            <p className="relative text-center text-sm text-[#2A2856]/70 font-medium">
              3 分 ・ 登録不要 ・ 全部無料
            </p>
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
