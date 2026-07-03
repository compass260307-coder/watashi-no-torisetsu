"use client";

// /types: キャラのモーション動画 (AI 生成のアイドルループ) プレイヤー。
//
//   - 背景色をページの帯色と揃えた「疑似透過」動画を前提とする (真の透過は不要)。
//   - パフォーマンス対策: preload="none" + IntersectionObserver で
//     画面付近に入ったときだけ再生し、外れたら止める (32 本並んでも重くならない)。
//   - poster に既存の静止画 (thirtyTwoImagePath) を渡すことで、
//     読み込み前・reduced-motion 時も見た目が静止画版と同一になる。
//   - prefers-reduced-motion: reduce では再生せず poster を出したままにする。

import { useEffect, useRef } from "react";

export function TypeMotionVideo({
  src,
  poster,
  alt,
}: {
  src: string;
  poster: string;
  alt: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // reduced-motion: 再生しない (poster 静止画のまま)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // 自動再生ポリシーで reject されることがあるので握りつぶす
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      // 少し手前 (200px) から再生を始めてスクロール時に止まって見えないように
      { rootMargin: "200px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      className="h-auto w-full"
    />
  );
}
