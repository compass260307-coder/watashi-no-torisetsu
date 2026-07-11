"use client";

// ページ最下部に一つだけ置く「全解放 (¥299)」課金カード。
//
// 導線設計 (2026-07-11): 各コンテンツのロックCTA (深掘りのキャリア/成長など) は
//   Stripe を直接叩かず、このカード (#full-access-card) へスクロールしてくる。
//   実際の決済ボタン (FullAccessCta → Stripe Checkout) はここ一箇所に集約する。
//
// デザイン (MBTI の全解放カード参考・2026-07-11 改修):
//   - 画像 (キャラ/シーン) + テキストの横並び (md+)、モバイルは縦積み。
//   - 横幅は本文コンテンツと揃える (w-full)。
//   - 価格は ¥1,299 → ¥299 の値引き表記。CTA ボタンには金額を入れない。
//   - 全解放でできることを全て箇条書き + 30日間の返金保証。
//   - カードの地色/アクセントは、その人の 32タイプのグループ色に合わせる (group)。
//
// 未課金のときだけ親 (/me) がマウントする。世界観は /me 本文と統一
//   (白背景・M PLUS Rounded(global)・ネイビー見出し・16P 風カード)。

import Image from "next/image";
import { FullAccessCta } from "./FullAccessCta";
import { FULL_ACCESS_CARD_ID } from "./full-access-anchor";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

// カード隅の折り紙風ダイヤ装飾 (グループ色の3トーンで折り目の陰影を出す)。
// 左上・右上に配置し、mirror で左右反転して外側へ向ける。
function CornerDecor({
  dark,
  mid,
  light,
  className,
  mirror = false,
}: {
  dark: string;
  mid: string;
  light: string;
  className?: string;
  mirror?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      {/* 中心 (50,50) から 4 分割したダイヤ = 折り紙の折り目 */}
      <path d="M50 4 L4 50 L50 50 Z" fill={light} />
      <path d="M50 4 L96 50 L50 50 Z" fill={mid} />
      <path d="M96 50 L50 96 L50 50 Z" fill={dark} />
      <path d="M4 50 L50 96 L50 50 Z" fill={mid} />
    </svg>
  );
}

// 値引き表記に使う元値と現在価格 (77%OFF)。
const LIST_PRICE = "¥1,299";
const SALE_PRICE = "¥299";
const OFF_PERCENT = 77;

// 全解放で「できるようになること」。太字の見出し + 説明文の形式 (MBTI 参考)。
const UNLOCKS: { title: string; desc: string }[] = [
  {
    title: "全てのセクションを解放",
    desc: "向いてる仕事、強みの活かし方、伸ばし方やつまずき対策まで──ロック中の深掘りが全部読める。",
  },
  {
    title: "ダウンロード可能なレポート",
    desc: "アナタのトリセツを1枚にまとめて保存。あとで見返したり、友達に見せたりできる。",
  },
  {
    title: "友達ひとりずつの回答",
    desc: "誰が・どう見てるかを名前ごとに。もらったメッセージも、自己認識とのズレも全文で。",
  },
];

export function FullAccessPaywallCard({
  // このページの owner_token。決済に本人解決用として渡す (Cookie 不在のスマホ対策)。
  ownerToken,
  // カード左 (md+) / 上 (モバイル) に出す挿絵。無ければ画像枠ごと省略。
  imageSrc,
  imageAlt = "",
  // その人の 32タイプのグループ (海/空/陸/未知)。カードの地色・アクセントに反映。
  group = "unknown",
}: {
  ownerToken?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
}) {
  const tone = cardColorsForGroup(group);
  const { heroBg } = heroColorsForGroup(group); // 装飾の中間トーン

  return (
    // scroll-mt: スクロール着地時にヘッダー下に隠れないよう上方マージンを確保。
    // 横幅は本文コンテンツと揃える (親 max-w-[1080px] いっぱい)。
    // relative: 隅の折り紙装飾をカード角に被せる (カード外へ少しはみ出す) ため。
    <section
      id={FULL_ACCESS_CARD_ID}
      className="relative mt-16 scroll-mt-24"
      aria-label="全解放の購入"
    >
      {/* 右上・左下の折り紙風装飾 (カード角に半分被せて外へ) */}
      <CornerDecor
        dark={tone.accent}
        mid={heroBg}
        light={tone.border}
        mirror
        className="pointer-events-none absolute -right-3 -top-3 z-10 h-14 w-14 rotate-[12deg] drop-shadow-sm md:h-16 md:w-16"
      />
      <CornerDecor
        dark={tone.accent}
        mid={heroBg}
        light={tone.border}
        className="pointer-events-none absolute -bottom-3 -left-3 z-10 h-14 w-14 rotate-[-12deg] drop-shadow-sm md:h-16 md:w-16"
      />
      <div
        className="overflow-hidden rounded-3xl border-2 shadow-[0_16px_48px_rgba(46,46,92,0.12)] md:flex md:items-stretch"
        style={{ backgroundColor: tone.softBg, borderColor: tone.border }}
      >
        {/* ===== 挿絵 (md+: 左カラム / モバイル: 上) ===== */}
        {imageSrc && (
          <div
            className="flex items-center justify-center px-6 pt-7 md:w-[42%] md:px-6 md:py-8"
            style={{ backgroundColor: tone.panelBg }}
          >
            <Image
              src={imageSrc}
              alt={imageAlt}
              width={640}
              height={640}
              className="h-auto w-full max-w-[300px] md:max-w-[360px]"
            />
          </div>
        )}

        {/* ===== テキスト (md+: 右カラム) ===== */}
        <div className="px-6 py-8 md:flex-1 md:px-9 md:py-10">
          {/* 見出し上のピル型バッジ (★ + 今すぐロックを解除)。白地チップでティント地から浮かせ、
              ★とテキストにグループ色を効かせる。 */}
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.10)]"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              style={{ color: tone.accent }}
            >
              <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
            </svg>
            今すぐロックを解除
          </span>
          <h2 className="mt-3 text-[24px] font-black leading-[1.4] text-[#2E2E5C] md:text-[30px]">
            あなたの性格タイプ
            <br />
            についてのすべてを解放
          </h2>
          <p className="mt-3 text-[14px] font-bold leading-[1.7] text-[#5A5A72]">
            あなたの詳細な性格タイプから、友達から見たアナタの印象まで、
            自分では気づけなかった魅力や本質を1つのパッケージにまとめました。
          </p>

          {/* できること (太字見出し + 説明文のチェックリスト) */}
          <ul className="mt-6 space-y-3">
            {UNLOCKS.map(({ title, desc }) => (
              <li key={title} className="flex items-start gap-2.5 text-left">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: tone.accent }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12l5 5L20 6" />
                  </svg>
                </span>
                <span className="text-[14px] leading-[1.5]">
                  <span className="font-black text-[#2E2E5C]">{title}</span>
                  <span className="text-[#5A5A72] font-bold">
                    {" "}
                    — {desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {/* 価格: ¥1,299 → ¥299 の値引き表記 (金額は CTA ではなくカードに出す) */}
          <div className="mt-7 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span
              className="rounded-md px-2 py-0.5 text-[12px] font-black text-white"
              style={{ backgroundColor: tone.accent }}
            >
              {OFF_PERCENT}%OFF
            </span>
            <span className="text-[16px] font-bold text-[#A0A0B4] line-through">
              {LIST_PRICE}
            </span>
            <span
              className="text-[36px] font-black leading-none"
              style={{ color: tone.accent }}
            >
              {SALE_PRICE}
            </span>
          </div>

          {/* 決済ボタン (Stripe)。金額はカード側に出したのでボタンからは外す。 */}
          <div className="mt-4">
            <FullAccessCta ownerToken={ownerToken}>
              すべてのロックを解除
            </FullAccessCta>
          </div>

          {/* 30日間の返金保証 */}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#7A7A92]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            30日間の返金保証つき
          </p>
        </div>
      </div>
    </section>
  );
}
