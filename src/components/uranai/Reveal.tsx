"use client";

// スクロールで要素が浮かび上がる汎用ラッパー (/unmei 結果ページの夜空演出用)。
// IntersectionObserver で一度だけ発火し、以後は表示のまま。
// prefers-reduced-motion: reduce では即時表示 (アニメなし)。
// SSR 初期状態は opacity-0 (JS 到達後に順次表示される前提。このアプリは全面 JS 必須)。

import React, { useEffect, useRef, useState } from "react";

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number; // transition-delay (ms)。表紙のスタッガー用
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // reduced-motion は CSS (motion-reduce:opacity-100 等) で常時表示になるため、
    // ここでは分岐しない (IO の発火は無害)。
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      // 画面下端ギリギリでは発火させず、少し入ってから (読み始める位置で見せる)
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        inView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      } ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
