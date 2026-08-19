"use client";

// 「動くキャラ」表示の器 (2026-08-19)。
//
// 目的: 結果ヒーローのキャラを、瞬き・手振り等のループ動画で動かせるようにする。
//   ただしキャラ別の動画アセットは順次用意していくため、
//   - 動画 (public/characters/anim/<slug>.webm) が有るキャラ → 透過ループ動画を再生
//   - 無いキャラ → 従来の静止画 (webp) ＋ 微アニメ (animate-character-idle) で「生きてる感」
//   の二段構えにする。動画は「置くだけ」で自動的に使われる (scenes 画像と同じ運用)。
//
// 実装メモ:
//   - 透過を保つため webm (VP9 + alpha) を想定。muted+playsInline+loop+autoPlay で
//     モバイルの自動再生制約を満たす。iOS Safari 対策で poster に静止画を敷き、
//     動画がデコードできない環境では静止画がそのまま残る。
//   - 動画読み込み/再生に失敗したら静止画へフォールバックする (onError)。
//   - prefers-reduced-motion は CSS 側 (animate-character-idle) で静止。動画自体は
//     ユーザー設定に関わらず再生するが、内容は穏やかな待機モーション前提。

import { useState } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";

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
  /** ループ動画 (webm)。null のときは静止画＋微アニメ。 */
  animSrc?: string | null;
  alt: string;
  sizes?: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  // 動画の再生に失敗したら静止画へ。初期値は「動画あり」を尊重する。
  const [videoFailed, setVideoFailed] = useState(false);
  const useVideo = Boolean(animSrc) && !videoFailed;

  if (useVideo) {
    return (
      <video
        className={`h-full w-full object-contain ${className}`.trim()}
        // poster で静止画を敷き、動画デコード前/失敗時も絵が出る。
        poster={imageSrc}
        autoPlay
        loop
        muted
        playsInline
        // 再生できない環境では poster が残る。デコード不能時はフォールバック。
        onError={() => setVideoFailed(true)}
        aria-label={alt}
      >
        <source src={animSrc!} type="video/webm" />
      </video>
    );
  }

  // 静止画フォールバック。ゆっくり上下＋わずかに揺れる待機アニメで「動いている」印象に。
  return (
    <div className="animate-character-idle h-full w-full">
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
