"use client";

// feat/top-page: トップページ ヒーロー (16Personalities 型・キービジュアル 1 枚構成)
//
// 構成:
//   - 背景: public/characters/keyvisual.webp をフルブリード object-cover /
//     object-position: center bottom → どの画面でもキャラ帯が下端に常に見える
//     (cover で外周フチもクロップ)。
//   - テキスト層: ヒーロー上から ~13% にブロックを置き中央寄せ (縦中央にはしない)。
//     アイラベル → H1 → サブ → CTA → 実績バー の縦並び。max-width 680px。
//   - レスポンシブ: H1/サブ/CTA をスマホで縮小、カラムは左右 24px パディングで全幅。
//
// クライアントコンポーネントなのはメニュー(開閉)のみ。

import Link from "next/link";

// H1・本文ともゴシック (Noto Sans JP)。H1 は 800(極太) で塊感を出す。
const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

export default function TopHero() {
  return (
    <>
      {/* SEO/CWV: ヒーロー背景 (= LCP 要素) を先読みして描画を早める。
          React 19 が <link> を <head> にホイストする。media で PC/SP を出し分け、
          無駄なダブルダウンロードはしない。見た目への影響なし。 */}
      <link
        rel="preload"
        as="image"
        href="/characters/keyvisual.webp"
        media="(min-width: 640px)"
      />
      <link
        rel="preload"
        as="image"
        href="/characters/keyvisual-mobile.webp"
        media="(max-width: 639px)"
      />
    <section
      // 背景キービジュアルは PC=横長 / SP=縦長 を media query で出し分けるため
      // globals.css の .top-hero-bg に分離 (インライン style では出し分け不可)。
      // SP のヒーロー高さは縦長画像のアスペクト比 (941:1672 ≒ 100:178) に固定し、
      // 画像を丸ごと見せる (78vh 固定だと上だけクロップされ、キャラ帯が
      // コピー・CTA の真裏まで上がってきて文字が読めなくなるため)。
      className="top-hero-bg relative h-[178vw] w-full overflow-hidden sm:h-[61vw] sm:min-h-[78vh]"
      style={{ fontFamily: FONT_STACK }}
    >
      {/* 背景: キービジュアルを CSS background (cover/center bottom) でフルブリード。
          上端の純白をクロップして白余白を詰める。上端の雲の切れ目を、青空に届かない
          ごく短い白グラデ(h-5%)だけで軽く溶かす(空を白く曇らせない)。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[5%]"
        style={{
          background:
            "linear-gradient(to bottom, #FFFFFF 0%, rgba(255,255,255,0.5) 55%, rgba(255,255,255,0) 100%)",
        }}
      />

      {/* 文字はブランド濃色 (H1=ネイビー / ラベル・数字=Sora ブルー) にしたため、
          白文字用の暗ヴェールは撤去。空の明るさをそのまま活かす。 */}

      {/* ヘッダー(ロゴ/メニュー)は独立した白いバー <TopHeader /> に分離。 */}

      {/* ── テキスト層 (上から ~13%・中央寄せ・max 680px) ── */}
      {/* テキスト層: ヒーロー高さの ~26% に絶対配置 (上の白雲帯を避け、青空に乗せる)。
          top を % にすることで PC(高さ=66vw) / SP(高さ=78vh) どちらでも白雲の下に来る。 */}
      {/* SP は top 14%: 縦長画像の空きゾーン (上 ~62% が空。キャラ帯は v2 画像で
          少し下がった) に H1 → サブ → CTA を収め、下のキャラ帯に被せない。 */}
      <div className="absolute inset-x-0 top-[14%] z-10 mx-auto w-full max-w-[1160px] px-6 text-center sm:top-[22%] lg:px-0">
        {/* H1: 鉤括弧つきのキャッチ。極太ゴシック(Noto Sans JP 800)・白。
            サイズ/余白は .top-hero-h1 (SP は vw 比例 = ヒーロー高さ 178vw と相似で
            どの幅でも構図が崩れない / 640px〜 は従来の clamp)。 */}
        <h1 className="top-hero-h1">
          「友達には、こんなワタシが見えてたんだ」
        </h1>

        {/* サブ: 500 / lh 1.9 / 白。16Personalities の
            「たった10分で、〜を、不気味なくらい正確に知ることができます」構文を踏襲した
            一文型 (「不気味」はブランドトーンに合わせ「怖いくらい正直」に変換)。
            PC は読点で改行、SP は自然折返し。 */}
        <p className="top-hero-sub mx-auto max-w-[720px]">
          たった10分で、友達から見えている『ほんとうのワタシ』を、
          <br className="hidden sm:inline" />
          怖いくらい正直に知ることができます。
        </p>

        {/* CTA: どっしり横長 / 全幅(SP)。「無料」でハードル除去 */}
        <div className="top-hero-cta-wrap">
          <Link
            href="/diagnosis"
            className="sora-cta top-hero-cta block w-full rounded-full px-16 py-5 text-center font-bold transition-all duration-150 hover:translate-y-px active:translate-y-0.5 lg:inline-block lg:w-auto lg:min-w-[380px]"
            style={{ boxShadow: "0 8px 20px rgba(91,91,239,0.30)" }}
          >
            無料で診断をはじめる →
          </Link>
        </div>
      </div>
    </section>
    </>
  );
}
