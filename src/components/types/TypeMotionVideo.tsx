"use client";

// /types: キャラのモーション動画 (AI 生成のアイドルループ) プレイヤー。
//
//   - 背景を Vision で切り抜いた「真の透過」動画を再生する。
//     アルファ付き動画はブラウザごとに形式が分かれるため 2 ソース構成:
//       * <slug>.mov  = HEVC + alpha (hvc1) … Safari / iOS
//       * <slug>.webm = VP9 + alpha        … Chrome / Edge / Firefox / Android
//     Safari は quicktime を先に拾い、Chrome は再生不可なので webm へ落ちる。
//   - poster には切り抜き済みの透過 PNG を渡す (読み込み前・reduced-motion 時も
//     見た目が静止画版と揃う)。
//   - 再生トリガー:
//       * ホバーできる環境 (PC) = マウスを乗せている間だけ再生、離すと一時停止。
//         初回ホバーで待たされないよう、画面付近に入った時点で読み込みだけ済ませる。
//       * ホバーがない環境 (スマホ) = 画面内に入ったら再生、外れたら停止。
//   - prefers-reduced-motion: reduce では一切再生しない。

import { useEffect, useRef } from "react";

export function TypeMotionVideo({
  movSrc,
  webmSrc,
  poster,
  alt,
}: {
  movSrc: string;
  webmSrc: string;
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
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      className="h-auto w-full"
    >
      {/* Safari (HEVC+alpha) を先に。Chrome 系は quicktime を飛ばして webm を拾う */}
      <source src={movSrc} type='video/quicktime; codecs="hvc1"' />
      <source src={webmSrc} type='video/webm; codecs="vp9"' />
    </video>
  );
}
