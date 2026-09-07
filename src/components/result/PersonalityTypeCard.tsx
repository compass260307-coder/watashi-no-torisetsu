// /me 結果トップの「性格タイプ」ヒーローカード (2026-08-19)。
// 16personalities の結果トップを参考にした無彩色ベースのカード:
//   [性格タイプ ラベル] → [型名 (称号)] → [OCEAN コード] → [キャラを淡色帯に] → [短い説明]
// ブランドの全幅カラー帯 (ResultHero) は /me では使わず、白基調のクリーンなカードに。
// キャラは AnimatedCharacter (動画があれば再生・無ければ静止画のまま。動かさない)。
//
// server component (自身はインタラクションなし)。動画再生部は AnimatedCharacter (client)。

import { AnimatedCharacter } from "./AnimatedCharacter";
import { cardColorsForGroup } from "@/lib/hero-colors";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

// キャラが立つ「白い丘」の稜線。16personalities 参考のゆるやかな horizon にする。
// 低振幅 (上辺は 6〜14% の間) の広い波で、左側がやや高く右へなだらかに下る。
const GENTLE_HILL_CLIP =
  "polygon(0% 13%, 7% 10%, 14% 7.5%, 21% 6.5%, 29% 7%, 36% 8.5%, 43% 10.5%, 50% 12.5%, 57% 13.5%, 64% 13.8%, 71% 13.3%, 79% 12%, 86% 10.8%, 93% 10%, 100% 9.8%, 100% 100%, 0% 100%)";

export function PersonalityTypeCard({
  label,
  essence,
  code,
  imageSrc,
  animSrc,
  alt,
  description,
  group = "unknown",
}: {
  /** 型名の上の小ラベル (例「性格タイプ」/ 獲得モードは「◯◯さんの性格タイプ」) */
  label: string;
  /** 称号 (大見出し・ページの主見出し h1) */
  essence: string;
  /** OCEAN コード (高=大文字/低=小文字。例 "OCeAN")。大小で高低を無彩色に表す。 */
  code: string;
  imageSrc: string;
  animSrc?: string | null;
  alt: string;
  description?: string;
  /** カード上端のアクセントバー色に使うタイプのグループ (16P のロール色に相当)。 */
  group?: ThirtyTwoGroup;
}) {
  // 16P 参考: 上端にタイプ別カラーのアクセントバー + 地色を淡いタイント + 下部に白い丘
  // (キャラが立つ地面)。透過版キャラ画像 (characters/cut) 前提で背景に馴染ませる。
  const { accent, softBg } = cardColorsForGroup(group);
  return (
    <section aria-label={label} className="mb-5 md:mb-0 md:h-full">
      {/* md:flex-col + md:h-full: PC の2カラムで右(性格特性)カードと高さを揃える。
          差分はキャラ枠(flex-1)が吸収し、説明文はカード下端に収まる。
          overflow-hidden: 上端のアクセントバーを角丸に沿ってクリップする。 */}
      <div
        className="flex h-full flex-col overflow-hidden rounded-3xl border border-[#E7E7EF] bg-white shadow-[0_8px_24px_rgba(46,46,92,0.06)]"
      >
        {/* 上端のタイプ別カラーバー */}
        <div
          aria-hidden="true"
          className="h-1.5 w-full flex-shrink-0"
          style={{ backgroundColor: accent }}
        />
        <div className="relative flex flex-1 flex-col px-5 pb-7 pt-7 md:px-7 md:pb-8 md:pt-8">
        {/* 背景シーン: 淡いタイント (上) → 白い丘 (下)。キャラはこの丘に立つ。 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-x-0 top-0 h-[68%]"
            style={{ background: softBg }}
          />
          {/* 白い丘: 上端をゆるやかな稜線にする (clip-path)。 */}
          <div
            className="absolute inset-x-0 bottom-0 top-[30%] bg-white"
            style={{ clipPath: GENTLE_HILL_CLIP }}
          />
        </div>
        {/* ラベル + 型名（コードをカッコ書きで同じ行に） */}
        <div className="relative z-10 text-center">
          {/* 16P 参考: ラベルは大きめ・中間グレー・軽い字送り。 */}
          <p className="mb-2 text-[15px] font-medium tracking-[0.01em] text-[#6E7684] md:text-[16px]">
            {label}
          </p>
          {/* 16P 参考: 「型名 (コード)」。MBTI は使わず自社の OCEAN コード (大文字=高/小文字=低)。
              コードは型名と同色・同サイズ・太字 (薄くしない)。文字色は濃いスレートグレー。 */}
          <h1 className="text-[24px] font-black leading-[1.25] text-[#3A3F49] md:text-[22px]">
            {essence}
            <span className="ml-1.5 whitespace-nowrap tracking-[0.02em]">({code})</span>
          </h1>
        </div>

        {/* キャラ (背景の淡いタイント＋白い丘の上に立つ)。PC は flex-1 で伸縮し、
            右カードとの高さ差を吸収する (キャラは中央寄せ)。 */}
        <div className="relative z-10 mx-auto mt-5 flex h-[260px] w-full max-w-[340px] items-center justify-center md:mt-6 md:h-auto md:min-h-[200px] md:flex-1">
          <AnimatedCharacter
            imageSrc={imageSrc}
            animSrc={animSrc}
            alt={alt}
            priority
            sizes="(min-width: 768px) 360px, 90vw"
            className="drop-shadow-[0_10px_18px_rgba(46,46,92,0.10)]"
          />
        </div>

        {/* 説明文 (型の本文冒頭。カード下端に置く) */}
        {description && (
          <p className="relative z-10 mx-auto mt-5 max-w-[460px] text-[13px] font-medium leading-[1.85] text-[#5A5A6E] md:text-[14px]">
            {description}
          </p>
        )}
        </div>
      </div>
    </section>
  );
}
