import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
// Day 6.2: <Footer /> の呼び出しを削除しカード内に統合。
// コンポーネント本体 (components/Footer.tsx) は他ページで利用継続。
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
        {/* Day 6.2: pb-32 → p-6 (Footer 統合で底に Footer ブロックが来るため
            ボトム余白は p-6 で十分) */}
        <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
          {/* === Day 4.4: ヒーロー本体ラッパー (relative)
              hero+B 統合後、ヒーロー装飾 (bottom-* / top-[XXXpx]) が B セクションに
              はみ出るのを防ぐため、ヒーロー範囲を独立した positioning context にする。
              ラッパー内の absolute 装飾はこの relative wrapper を基準に位置決め。 */}
          <div className="relative">
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

          {/* === 極小装飾 (glow なし、軽く) ===
              Day 3.11: 桃ペンの右目に被る top-40 right-[35%] の極小キラキラを削除
              (マスコット顔をクリアに見せるため。見出し下の極小キラキラは残置) */}
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
                {/* Day 3.6: 大ロゴの halo を削除 (ロゴ自体の縁取りで十分浮く)
                    Day 3.13: max-w-[300px] → max-w-[380px] でカード幅近くまで拡大 (Koi 風) */}
                <Image
                  src="/logo-hero.png"
                  alt="ワタシのトリセツ by AI"
                  width={600}
                  height={300}
                  priority
                  className="relative w-full max-w-[380px] h-auto"
                />
              </div>
            </div>
          </div>

          {/* マスコット + ロゴ重ねブロック分の余白確保 (bottom-[-30px] のはみ出しを吸収)
              Day 3.12: 余白縮小 h-16 (64px) → h-4 (16px)、ロゴとタグの間をコンパクトに */}
          <div aria-hidden="true" className="h-4" />

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
          {/* === Day 4.4: ヒーロー本体ラッパー end === */}

          {/* === Day 4.1: セクション内セパレーター (ヒーロー → B 連結) === */}
          <div aria-hidden="true" className="my-12" />

          {/* === Phase 1.5-α Day 4: B セクション「ちがう自分が、見つかる」(統合) === */}
          {/* Day 4.10: ステッカータグを「友達からの評価で」に変更 + サイズアップ
              「友達からの評価で → ちがう自分が、見つかる」が一連の文として読める設計 */}
          <div className="flex justify-center mb-4">
            <div className="bg-[#FFE993] text-[#3A2D6B] px-5 py-2 rounded-full text-base font-black border-2 border-[#3A2D6B] transform -rotate-2 shadow-[2px_2px_0_#3A2D6B]">
              友達からの評価で
            </div>
          </div>

          {/* Day 4.7: 見出し画像 + 周辺装飾 5 つ (花/星青/ハート/星黄/キラキラ)
              ヒーローカードと密度を揃えてポップさを担保
              Day 4.10: mb-8 → mb-2 でキャラ画像との距離を詰める */}
          <div className="relative flex justify-center mb-2 mt-4">
            {/* halo (Day 4 から引き続き) */}
            <div
              aria-hidden="true"
              className="absolute inset-x-2 inset-y-0 bg-white/25 rounded-3xl blur-2xl pointer-events-none"
            />

            {/* 装飾: 左上 黄色花 (-15deg) */}
            <Image
              src="/decorations/flower-yellow.png"
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
              className="absolute -left-2 top-2 w-14 h-14 rotate-[-15deg] z-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] pointer-events-none"
            />
            {/* 装飾: 右上 青星 (+12deg) */}
            <Image
              src="/decorations/star-blue.png"
              alt=""
              aria-hidden="true"
              width={64}
              height={64}
              className="absolute -right-1 top-0 w-16 h-16 rotate-[12deg] z-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] pointer-events-none"
            />
            {/* 装飾: 左下 ピンクハート (-8deg、小) */}
            <Image
              src="/decorations/heart-pink.png"
              alt=""
              aria-hidden="true"
              width={48}
              height={48}
              className="absolute left-0 bottom-0 w-10 h-10 rotate-[-8deg] z-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] pointer-events-none"
            />
            {/* 装飾: 右下 黄色星 (+20deg) */}
            <Image
              src="/decorations/star-yellow.png"
              alt=""
              aria-hidden="true"
              width={48}
              height={48}
              className="absolute right-2 bottom-2 w-10 h-10 rotate-[20deg] z-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] pointer-events-none"
            />
            {/* 装飾: キラキラ (見出し右寄り、小、アクセント) */}
            <Image
              src="/decorations/sparkle.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="absolute right-8 top-8 w-8 h-8 z-0 pointer-events-none"
            />

            {/* 見出し本体 (z-10 で装飾より前面) */}
            <Image
              src="/heading-section2.png"
              alt="ちがう自分が、見つかる"
              width={600}
              height={400}
              className="relative w-full max-w-[340px] h-auto z-10"
            />
          </div>

          {/* Day 4.9: 白カード撤廃、キャラ + バッジ + 矢印 + ラベルを 1 枚画像に統合。
              CSS で配置調整するアプローチを止め、Koi キャラ風の完成度を画像側で担保。
              /public/section2-fox.png / section2-hamster.png は参照を解除 (ファイル残置)
              Day 4.10: mb-8 mt-4 → mb-2 (mt 削除) で見出し / シチュ文との距離を詰める */}
          <div className="flex justify-center mb-2">
            <Image
              src="/section2-pair.png"
              alt="ワタシから見たワタシと、友達から見たワタシ"
              width={1024}
              height={1024}
              className="w-full max-w-[400px] h-auto drop-shadow-[0_8px_16px_rgba(58,45,107,0.15)]"
            />
          </div>

          {/* シチュ文 (halo 付き、grid 背景の上で読みやすく)
              Day 4.10: mt-0 を明示してキャラ画像直下に詰める */}
          <div className="flex justify-center mb-12 mt-0">
            <p className="text-center text-[#3A2D6B] font-bold text-base leading-relaxed bg-white/50 backdrop-blur-sm rounded-2xl px-5 py-4 max-w-[360px] shadow-sm">
              「ワタシはサバサバ系」って思ってたけど、
              <br />
              友達は「実はめっちゃ甘えん坊」って言う
            </p>
          </div>

          {/* ============================================ */}
          {/* Day 5: a セクション「真のトリセツとは」      */}
          {/* ストーリー: ヒーロー (問い) → B (発見) → a (完成)
              ¥500 価値訴求の主役パート、ヒーロー統合カード内に続く */}
          {/* ============================================ */}
          <section className="my-12">
            {/* 1. ステッカータグ (前置き、B と逆方向 +2deg) */}
            <div className="flex justify-center mb-4">
              <div className="bg-[#FFE993] text-[#3A2D6B] font-black px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-md rotate-2 text-base">
                ぜんぶ揃って、いよいよ
              </div>
            </div>

            {/* 2. 大見出し画像「友達から見たワタシが、書かれる」 */}
            <div className="flex justify-center mb-4 mt-2">
              <Image
                src="/heading-section-a.png"
                alt="友達から見たワタシが、書かれる"
                width={1024}
                height={768}
                className="w-full max-w-[400px] h-auto"
              />
            </div>

            {/* 3. サブコピー (halo、B と同じスタイル) */}
            <div className="flex justify-center mb-8">
              <p className="text-center text-[#3A2D6B] font-bold text-base leading-relaxed bg-white/50 backdrop-blur-sm rounded-2xl px-5 py-3 max-w-[340px] shadow-sm">
                7 章の物語が、
                <br />
                アナタを言葉にする
              </p>
            </div>

            {/* 4. スマホモックアップ (プロダクト見せ) */}
            <div className="flex justify-center mb-10">
              <Image
                src="/phone-mockup.png"
                alt="ワタシのトリセツ アプリ画面の例"
                width={1024}
                height={1024}
                className="w-full max-w-[420px] h-auto drop-shadow-[0_8px_16px_rgba(58,45,107,0.15)]"
              />
            </div>

            {/* 5. 特徴 3 つ (横長白カード) */}
            <div className="flex flex-col gap-3 px-2 mb-8">
              {/* 5-1. 全 7 章のボリュームレポート */}
              <div className="bg-white rounded-2xl px-5 py-4 shadow-md border-2 border-[#0094D8]/20 flex items-center gap-4">
                <Image
                  src="/decorations/icon-book.png"
                  alt=""
                  aria-hidden="true"
                  width={80}
                  height={80}
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-[#3A2D6B] font-black text-sm leading-snug">
                  全 7 章のボリュームレポート
                </p>
              </div>

              {/* 5-2. ギャップ解明 (vividPink で "ギャップ" を強調) */}
              <div className="bg-white rounded-2xl px-5 py-4 shadow-md border-2 border-[#0094D8]/20 flex items-center gap-4">
                <Image
                  src="/decorations/icon-magnifier.png"
                  alt=""
                  aria-hidden="true"
                  width={80}
                  height={80}
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-[#3A2D6B] font-black text-sm leading-snug">
                  自己評価と友達評価の
                  <br />
                  <span className="text-[#FE3C72]">&quot;ギャップ&quot;</span>を解明
                </p>
              </div>

              {/* 5-3. AI 解析 */}
              <div className="bg-white rounded-2xl px-5 py-4 shadow-md border-2 border-[#0094D8]/20 flex items-center gap-4">
                <Image
                  src="/decorations/icon-ai.png"
                  alt=""
                  aria-hidden="true"
                  width={80}
                  height={80}
                  className="w-14 h-14 flex-shrink-0"
                />
                <p className="text-[#3A2D6B] font-black text-sm leading-snug">
                  アナタの回答から、
                  <br />
                  AI が深く解析
                </p>
              </div>
            </div>
          </section>

          {/* ============================================ */}
          {/* Day 6.2: 最終 CTA (簡略化、カード内に移動)
              旧 Day 6.1 のマスコット / キャッチコピー / サブコピー halo を全削除、
              ボタン + 補足テキストのみで「ここで決断」感を直接的に訴求 */}
          {/* ============================================ */}
          <section className="text-center py-8 mt-4">
            <div className="mb-3">
              <Link
                href="/diagnosis"
                className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black text-lg px-10 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_6px_0_#3A2D6B] hover:translate-y-1 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-[5px] active:shadow-[0_1px_0_#3A2D6B] transition-all duration-150"
              >
                無料で診断する →
              </Link>
            </div>
            {/* 補足テキスト (halo: grid 背景上で読みやすく) */}
            <div className="flex justify-center">
              <p className="inline-block text-[#3A2D6B] text-xs font-bold bg-white/40 backdrop-blur-sm rounded-full px-4 py-1.5">
                3 分 ・ 登録不要 ・ 全部無料
              </p>
            </div>
          </section>

          {/* ============================================ */}
          {/* Day 6.2: Footer 統合ブロック (カード内)
              リンク URL / 連絡先 / コピーライトは既存 Footer の内容を流用。
              <Footer /> コンポーネント本体は他ページ用に保持 (削除しない)。
              「特定商取引法」は /legal/commerce (既存ルート)、「お問い合わせ」は
              既存 Footer に従い mailto: のままにする (/contact ルートは未実装) */}
          {/* ============================================ */}
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

            {/* 区切り線 */}
            <div
              aria-hidden="true"
              className="border-t border-[#3A2D6B]/20 mb-4"
            />

            {/* お問い合わせメール (既存 Footer の文言を保持) */}
            <p className="text-[#3A2D6B]/80 text-xs leading-relaxed mb-3">
              お問い合わせ:{" "}
              <a
                href="mailto:support@watashi-torisetsu.com"
                className="font-bold hover:text-[#FE3C72] transition-colors underline underline-offset-2"
              >
                support@watashi-torisetsu.com
              </a>
            </p>

            {/* コピーライト (既存 Footer 文言を保持) */}
            <p className="text-[#3A2D6B]/60 text-xs text-center">
              © {new Date().getFullYear()} ワタシのトリセツ運営事務局
            </p>
          </div>
        </div>
      </section>

      {/* Day 6.2: <Footer /> の呼び出しを削除 (カード内に統合済)。
          コンポーネント本体 components/Footer.tsx は他ページ用に保持 */}

      {/* Phase 1.5-α Day 1: Cookie 状態認識フローティング CTA バー (Server Component) */}
      <FloatingCTABar />
    </div>
  );
}
