"use client";

// 「動くキャラ」表示の器 (2026-08-19)。
//
// 目的: 結果ヒーローのキャラを、瞬き・手振り等のループ動画で動かせるようにする。
//   ただしキャラ別の動画アセットは順次用意していくため、
//   - 動画 (public/characters/anim/<slug>.webm|mp4) が有るキャラ → ループアニメを再生
//   - 無いキャラ → 静止画 (webp) をそのまま表示 (動かさない)
//   の二段構えにする。動画は「置くだけ」で自動的に使われる (scenes 画像と同じ運用)。
//
// 実装メモ:
//   - スマホ/タブレットでは動画プレイヤーの透過互換性を避けるため、
//     public/characters/anim-mobile/<slug>.webp の透過アニメーション画像を使う。
//   - PC は透過 WebM (VP9 + alpha) と Kling 等が出力する MP4 の両方を扱う。
//     WebM と同名の HEVC+alpha MOV がある場合は先に候補へ入れる。
//     poster に静止画を敷き、動画がデコードできない環境でも絵を残す。
//   - 静止画は動かさない (待機アニメ廃止)。動画自体はユーザー設定に関わらず再生するが、
//     内容は穏やかな待機モーション前提。

import { useState } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";

// iOS の動画キャッシュは同じ URL の差し替えを保持することがあるため、
// HEVC+alpha を再生成したときだけ更新するキャッシュキーを付ける。
const IOS_ALPHA_ASSET_VERSION = "20260821-2";
const MOBILE_ALPHA_ASSET_VERSION = "20260827-1";
const MOBILE_POINTER_QUERY =
  "(max-width: 767px), (hover: none) and (pointer: coarse)";
const DESKTOP_POINTER_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export function AnimatedCharacter({
  imageSrc,
  animSrc,
  alt,
  sizes,
  className = "",
  width = 960,
  height = 960,
  priority = false,
}: {
  /** 静止画 (webp)。動画が無い/失敗したときの表示。poster にも使う。 */
  imageSrc: string;
  /** ループ動画 (webm / mp4)。null のときは静止画 (動かさない)。 */
  animSrc?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const [mobileAnimationFailed, setMobileAnimationFailed] = useState(false);
  const mobileAnimSrc = animSrc?.toLowerCase().endsWith(".webm")
    ? `${animSrc.replace("/characters/anim/", "/characters/anim-mobile/").replace(/\.webm$/i, ".webp")}?v=${MOBILE_ALPHA_ASSET_VERSION}`
    : null;
  const useAnimation = Boolean(animSrc);
  const videoType = animSrc?.toLowerCase().endsWith(".mp4")
    ? "video/mp4"
    : "video/webm";
  const hevcAlphaSrc = animSrc?.toLowerCase().endsWith(".webm")
    ? `${animSrc.replace(/\.webm$/i, ".mov")}?v=${IOS_ALPHA_ASSET_VERSION}`
    : null;

  if (useAnimation) {
    return (
      <>
        <picture
          className="character-mobile-animation h-full w-full"
          data-character-animation="mobile-webp"
        >
          {mobileAnimSrc && !mobileAnimationFailed && (
            <source
              media={MOBILE_POINTER_QUERY}
              srcSet={mobileAnimSrc}
              type="image/webp"
            />
          )}
          <SmoothImage
            src={imageSrc}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            sizes={sizes}
            unoptimized
            onError={() => setMobileAnimationFailed(true)}
            className={`h-full w-full object-contain ${className}`.trim()}
          />
        </picture>

        <video
          data-character-animation="desktop-video"
          className={`character-desktop-animation h-full w-full object-contain ${className}`.trim()}
          // poster で静止画を敷き、動画デコード前/失敗時も絵が出る。
          poster={imageSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          aria-label={alt}
        >
          {hevcAlphaSrc && (
            <source
              media={DESKTOP_POINTER_QUERY}
              src={hevcAlphaSrc}
              type={'video/quicktime; codecs="hvc1"'}
            />
          )}
          <source
            media={DESKTOP_POINTER_QUERY}
            src={animSrc!}
            type={videoType}
          />
          {alt}
        </video>
      </>
    );
  }

  // 静止画表示。キャラは動かさない (待機アニメは無し)。
  return (
    <div className="h-full w-full" data-character-animation="static-image">
      <SmoothImage
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className={`h-full w-full object-contain ${className}`.trim()}
      />
    </div>
  );
}
