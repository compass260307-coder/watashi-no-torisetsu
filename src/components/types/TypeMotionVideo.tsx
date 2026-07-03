"use client";

// /types: キャラのモーション動画 (AI 生成のアイドルループ) プレイヤー。
//
//   - 背景色をページの帯色と揃えた「疑似透過」動画を前提とする (真の透過は不要)。
//     動画側の背景が僅かに暗い場合は ffmpeg の lutrgb で帯色に補正して収録する。
//   - 再生トリガー:
//       * ホバーできる環境 (PC) = マウスを乗せている間だけ再生、離すと一時停止。
//         初回ホバーで待たされないよう、画面付近に入った時点で読み込みだけ済ませる。
//       * ホバーがない環境 (スマホ) = 画面内に入ったら再生、外れたら停止。
//   - poster に既存の静止画 (thirtyTwoImagePath) を渡すことで、
//     読み込み前・reduced-motion 時も見た目が静止画版と同一になる。
//   - prefers-reduced-motion: reduce では一切再生しない。

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

    const hoverCapable = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;

    const play = () => video.play().catch(() => {});
    const pause = () => video.pause();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (hoverCapable) {
            // PC: 再生はホバーに任せ、ここでは読み込みだけ温めておく
            if (entry.isIntersecting && video.preload === "none") {
              video.preload = "auto";
              video.load();
            }
          } else if (entry.isIntersecting) {
            play();
          } else {
            pause();
          }
        }
      },
      // 少し手前 (200px) から準備してスクロール時に待たせない
      { rootMargin: "200px" },
    );
    observer.observe(video);

    if (hoverCapable) {
      video.addEventListener("mouseenter", play);
      video.addEventListener("mouseleave", pause);
    }

    return () => {
      observer.disconnect();
      if (hoverCapable) {
        video.removeEventListener("mouseenter", play);
        video.removeEventListener("mouseleave", pause);
      }
    };
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
