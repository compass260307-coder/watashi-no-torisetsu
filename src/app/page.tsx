import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
// Day 6.2: <Footer /> の呼び出しを削除しカード内に統合。
// コンポーネント本体 (components/Footer.tsx) は他ページで利用継続。
import FloatingCTABar from "@/components/FloatingCTABar";
// Day 12-A: 装飾だけだった ☰ を 3 項目ハンバーガーメニューに置換
import { HamburgerMenu } from "@/components/HamburgerMenu";
// 診断済みユーザーを自分の結果ページへ自動誘導するための session 解決。
import { getSession } from "@/lib/session";

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
          {/* Day 7.3: ヘッダーロゴ復活 (左 logo.png + 右ハンバーガー大)
              ロゴは halo の代わりに drop-shadow でふんわり grid から浮かす
              Day 12-A: 装飾だけだった ☰ を <HamburgerMenu> に置換
              LP は未ログイン前提のため myTrisetsuUrl は省略
              (fallback /result が localStorage の token から自分の /me に解決、無ければ /diagnosis) */}
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

          {/* Day 7.2: 装飾を 4 つだけに整理 (大ハート / 大花 / キラキラ×2)
              旧 (Day 3.8 まで 6 つ): 小ハート bottom-28 / 極小キラキラ top-[700px] を削除
              全 4 個、pointer-events-none + aria-hidden + z-20 (マスコット z-10 より前面) */}

          {/* 大ハート (左上、+15deg) */}
          <div
            aria-hidden="true"
            className="absolute top-24 left-2 w-20 h-20 rotate-[15deg] z-0 pointer-events-none"
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
            className="absolute top-20 right-2 w-20 h-20 -rotate-[12deg] z-0 pointer-events-none"
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

          {/* キラキラ 1 (中段右、メインロゴ右側) */}
          <div
            aria-hidden="true"
            className="absolute top-[500px] right-4 w-10 h-10 z-0 pointer-events-none"
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
          {/* キラキラ 2 (下段左、サブコピー左側) */}
          <div
            aria-hidden="true"
            className="absolute bottom-32 left-4 w-8 h-8 z-0 pointer-events-none"
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

          {/* Day 3: 中央ロゴ (旧 /logo.png) はヘッダー左上に移動済のため削除。
              メインキャッチは下段の /logo-hero.png に移行 */}

          {/* Day 3.5: マスコット + ロゴ重ね合わせブロック (Koi キャラ風)
              マスコット下半分にロゴが被さるように absolute 配置。
              Day 7.5: z-index 階層をオリジナル設計通り「ロゴが最前面」に修正。
              (Day 7.3 で誤って逆転させたためロゴ文字が胴体被りで読めなくなっていた)
              階層: ロゴ z-30 > マスコット z-10 > 装飾 z-0
              Day 7.4 の bottom-[-100px] / mb-24 は本指示で巻き戻し、bottom-[-30px] / my-6 へ */}
          <div className="relative my-6">
            {/* マスコット + アーチ */}
            <div className="relative flex justify-center">
              {/* アーチ背景 (pink → blue 40% グラデのドーム) */}
              <div
                aria-hidden="true"
                className="absolute left-1/2 -translate-x-1/2 top-0 w-[300px] h-[280px] bg-gradient-to-b from-pink-200/40 to-blue-200/40 rounded-t-full"
              />

              {/* マスコット画像 (Day 7.3: max-w 280 → 320 で拡大、装飾より前面)
                  Day 7.5: z-30 → z-10 へ降格 (ロゴ z-30 を最前面にするため)。
                  装飾 z-0 より前 / ロゴ z-30 より後ろの「中間レイヤー」役割に専念 */}
              <Image
                src="/mascot-pair.png"
                alt="ワタシのトリセツのマスコット"
                width={300}
                height={300}
                priority
                className="relative z-10 w-full max-w-[320px] h-auto"
              />
            </div>

            {/* Day 7.5: ロゴをマスコット下半身に重ねる (bottom-[-30px] でオリジナル設計通り)
                z-20 → z-30 へ昇格で最前面化、マスコット胴体に被さってもロゴ文字は完全可読。
                Day 7.4 の bottom-[-100px] / mb-24 は z-index 階層修正で不要のため巻き戻し */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[-30px] z-30 w-full">
              <div className="relative flex justify-center">
                {/* Day 3.6: 大ロゴの halo を削除 (ロゴ自体の縁取りで十分浮く)
                    Day 7.2: max-w-[380px] → max-w-[440px] でほぼフル幅、ヒーロー主役感を出す */}
                <Image
                  src="/logo-hero.png"
                  alt="ワタシのトリセツ by AI"
                  width={600}
                  height={300}
                  priority
                  className="relative w-full max-w-[440px] h-auto"
                />
              </div>
            </div>
          </div>

          {/* Day 7.3: スペーサー h-12 → h-4 でロゴ画像とサブコピーをセットに見せる */}
          <div aria-hidden="true" className="h-4" />

          {/* Day 7.3: サブコピー halo 削除 (シンプル化、grid 背景上に直で配置)
              deepPurple 文字色は grid 背景 (薄水色〜薄ピンク) に対し十分なコントラスト */}
          <div className="flex justify-center mb-12">
            <p className="text-center text-[#3A2D6B] font-bold text-base leading-relaxed max-w-[340px]">
              自己診断 × 友達評価 × AI で、
              <br />
              自分でも気づかなかった
              <br />
              アナタが見えてくる
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
