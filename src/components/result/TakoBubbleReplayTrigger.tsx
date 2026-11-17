"use client";

// /me の「あなたの注意点」の直前に置く見えない目印。
// ここまでスクロールしたら、下部ナビの吹き出し「友達診断はここから！」を
// もう一度出すよう BottomNav へ知らせる (ページ表示ごとに1回だけ)。
// 吹き出しを実際に出すかどうか (未確認バッジが残っているか・日本語か) は BottomNav 側が決める。
import { useEffect, useRef } from "react";
import { TAKO_BUBBLE_REPLAY_EVENT } from "@/lib/tako-attention";

export function TakoBubbleReplayTrigger() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        window.dispatchEvent(new Event(TAKO_BUBBLE_REPLAY_EVENT));
        observer.disconnect();
      },
      // 画面の下端に入った瞬間ではなく、見出しが下から3割ほど上がった位置で知らせる。
      { rootMargin: "0px 0px -30% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} aria-hidden="true" className="block h-px w-full" />;
}
