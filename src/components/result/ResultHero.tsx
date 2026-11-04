// 結果ページのヒーロー帯 (色帯 + 斜めクリップ + グロー + フェルトドット + 称号/OCEAN + キャラ画像)。
// 自己診断 (/me) と 友達診断 (/tako) の結果ページで共用し、世界観を統一する。
//   - /me: 2カラム (label+称号+OCEAN 左 / キャラ 右)、本文幅 1080。
//   - /tako: 単カラム縦積み (中央)、本文幅 560。ヒーロー帯は全幅で共通。
// 色 (heroBg / codeTint / dotColor) は呼び出し側で算出して渡す (グループ別トーンを各ページで解決)。

import { CharacterHero } from "./CharacterHero";
import type { CharacterHeroJobSlot } from "./CharacterHero";
import { SmoothImage } from "@/components/ui/SmoothImage";
import type { BigFiveDimension } from "@/lib/types";
import type { AppResultLocale } from "@/i18n/result";

interface ResultHeroProps {
  /** 称号の上の小ラベル (例「あなたの性格タイプ:」) */
  label: string;
  /** 称号 (大見出し) */
  essence: string;
  /** OCEAN 高低判定に使う 0-10 スコア (≥5 = 高) */
  scores: Partial<Record<BigFiveDimension, number>>;
  /** ヒーロー帯の背景色 (グループ別) */
  heroBg: string;
  /** OCEAN コードの色 (帯背景より一段暗い脇役トーン) */
  codeTint: string;
  /** フェルトドット色 (既定: 半透明白) */
  dotColor?: string;
  /** キャラ画像 */
  imageSrc: string;
  /** 指定時はキャラ枠を出さず、生成画像をヒーロー全面に敷く。 */
  fullBleedImageSrc?: string;
  alt: string;
  /** CharacterHero 内部で使う名前 (動物名)。表示はされない (essence が主役)。 */
  name: string;
  description?: string;
  /** キャラ画像アスペクト/上限 (未指定は /me 既定) */
  imageAspectClassName?: string;
  /** SP でキャラ画像を引き上げる量 (画像の上端透過余白ぶん)。未指定は 0。 */
  heroPullClass?: string;
  jobSlot?: CharacterHeroJobSlot;
  /** 本文幅に合わせた中身の最大幅 (既定 max-w-[1080px]) */
  contentMaxWidthClass?: string;
  /** true で md 以上 2カラム (/me)、false で常に縦積み中央 (/tako)。既定 true。 */
  twoColumn?: boolean;
  locale?: AppResultLocale;
}

const OCEAN: readonly BigFiveDimension[] = ["O", "C", "E", "A", "N"];
const DOTS = [
  { w: 11, h: 11, top: "15%", left: "6%" },
  { w: 8, h: 8, top: "42%", left: "9%" },
  { w: 13, h: 13, top: "20%", right: "7%" },
  { w: 8, h: 8, top: "50%", right: "10%" },
  { w: 10, h: 10, top: "72%", left: "13%" },
  { w: 7, h: 7, top: "78%", right: "15%" },
] as const;

export function ResultHero({
  label,
  essence,
  scores,
  heroBg,
  codeTint,
  dotColor = "rgba(255,255,255,0.55)",
  imageSrc,
  fullBleedImageSrc,
  alt,
  name,
  description,
  imageAspectClassName = "aspect-square max-h-[54vh] md:max-h-[500px]",
  heroPullClass = "",
  jobSlot,
  contentMaxWidthClass = "max-w-[1080px]",
  twoColumn = true,
  locale = "ja",
}: ResultHeroProps) {
  const isHigh = (k: BigFiveDimension) =>
    (typeof scores[k] === "number" ? (scores[k] as number) : 5) >= 5;
  const hasFullBleedImage = Boolean(fullBleedImageSrc);

  return (
    <div
      className={`relative mx-[calc(50%-50vw)] w-screen overflow-hidden ${
        hasFullBleedImage ? "md:min-h-[640px]" : ""
      }`}
      style={{
        background: heroBg,
        clipPath:
          "polygon(0 0, 100% 0, 100% 100%, 0 calc(100% - clamp(24px, 3.2vw, 64px)))",
      }}
    >
      {fullBleedImageSrc && (
        <>
          {/* 生成キャラ画像はセッション認証付き API 配信のため常に unoptimized。
              next/image の内部フェッチは元リクエストの Cookie を引き継がず 404 になる
              (fetchInternalImage は url/method/socket のみのモックで実行される)。 */}
          <div className="relative w-full md:absolute md:inset-y-0 md:right-0 md:flex md:w-[60%] md:items-center md:justify-center md:[mask-image:radial-gradient(ellipse_65%_65%_at_55%_50%,black_50%,transparent_100%)]">
            <SmoothImage
              src={fullBleedImageSrc}
              alt={alt}
              width={1024}
              height={1024}
              priority
              unoptimized
              sizes="(min-width: 768px) 60vw, 100vw"
              className="block h-auto w-full md:max-h-[640px] md:object-contain"
            />
          </div>
          {/* 写真の明暗に左右されず、左側のタイプ名を読めるようにする。 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden md:block md:bg-[linear-gradient(90deg,rgba(21,24,55,0.5)_0%,rgba(21,24,55,0.24)_35%,transparent_60%)]"
          />
        </>
      )}
      {/* 上部中央の放射状グロー */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-[320px] ${
          hasFullBleedImage ? "hidden md:block md:opacity-30" : ""
        }`}
        style={{
          background:
            "radial-gradient(ellipse at top center, rgba(255,255,255,0.6) 0%, transparent 68%)",
        }}
      />
      {/* フェルトドット */}
      {DOTS.map((d, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`pointer-events-none absolute rounded-full ${hasFullBleedImage ? "hidden md:block" : ""}`}
          style={{
            background: dotColor,
            width: d.w,
            height: d.h,
            top: d.top,
            ...("left" in d ? { left: d.left } : { right: d.right }),
          }}
        />
      ))}
      {/* 中身: SP=縦積み中央 / PC(twoColumn)=2カラム */}
      <div
        className={`relative ${contentMaxWidthClass} mx-auto px-4 md:px-8 ${
          hasFullBleedImage
            ? "flex items-center bg-[#243e52] pb-12 pt-6 md:min-h-[640px] md:bg-transparent md:pb-16 md:pt-16"
            : "pb-2 pt-9 md:pt-14"
        } ${
          twoColumn && !hasFullBleedImage
            ? "md:flex md:items-center md:gap-8"
            : ""
        }`}
      >
        <div
          className={
            hasFullBleedImage
              ? "min-w-0 w-full md:w-[42%]"
              : twoColumn
                ? "md:flex-1"
                : ""
          }
        >
          {/* 称号 (label + essence) */}
          <div className={`text-center ${twoColumn ? "md:text-left" : ""}`}>
            <p className="mb-1 text-[16px] font-bold tracking-[0.02em] text-white md:text-[19px]">
              {label}
            </p>
            {/* 型名はページの主見出し。見た目は据え置きで <h1> にし、見出し構造/a11y/SEO を満たす。
                weight は Noto Sans JP の実配信ウェイト (400/700) に合わせ 700 (2026-09-04)。 */}
            <h1
              className={hasFullBleedImage
                ? "whitespace-normal break-words font-bold leading-[1.25] text-white [overflow-wrap:anywhere]"
                : "whitespace-nowrap font-bold leading-[1.04] text-white"}
              style={{
                fontSize: hasFullBleedImage
                  ? "clamp(24px, 4.5vw, 48px)"
                  : `clamp(32px, min(14vw, ${(88 / Math.max(essence.length, 1)).toFixed(2)}vw), 72px)`,
                textShadow: hasFullBleedImage
                  ? "0 3px 18px rgba(12, 15, 40, 0.42)"
                  : undefined,
              }}
            >
              {essence}
            </h1>
          </div>
          {/* OCEAN コード行 */}
          <div
            className={`mt-1.5 md:mt-2 flex items-baseline justify-center gap-1.5 ${
              twoColumn ? "md:justify-start" : ""
            }`}
          >
            {OCEAN.map((k) => {
              const high = isHigh(k);
              return (
                <span
                  key={k}
                  className="font-extrabold leading-none"
                  style={{
                    fontSize: high ? "30px" : "20px",
                    color: hasFullBleedImage ? "#FFFFFF" : codeTint,
                    opacity: high ? 1 : 0.55,
                  }}
                >
                  {high ? k : k.toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
        {/* キャラ画像 */}
        {!hasFullBleedImage && (
          <div
            className={`max-w-[640px] mx-auto ${heroPullClass} md:mt-0 md:max-w-[560px] ${
              twoColumn ? "md:flex-1" : ""
            }`}
          >
            <CharacterHero
              imageSrc={imageSrc}
              alt={alt}
              essence={essence}
              name={name}
              description={description}
              imageAspectClassName={imageAspectClassName}
              imageFitClassName="object-contain"
              imageCardClassName=""
              imageSizes="(min-width: 768px) 600px, 100vw"
              hideDecorations
              hideJobGauge
              jobSlot={jobSlot}
              locale={locale}
            />
          </div>
        )}
      </div>
    </div>
  );
}
