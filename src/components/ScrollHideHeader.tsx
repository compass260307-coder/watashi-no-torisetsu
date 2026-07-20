"use client";

// 16P と同じ挙動のスクロール連動ヘッダーラッパー:
//   - 下にスクロール中 = 上に滑って非表示
//   - 上にスクロール = すっと現れて sticky で追従
//   - ページ最上部付近では常に表示
// 中身 (TopHeader 等) は children で受け取る (このラッパーは挙動のみ担当)。

import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScrollHideHeader({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 40) {
        // 最上部付近は常に表示
        setHidden(false);
      } else {
        // 下方向 = 隠す / 上方向 = 出す (数px の揺れは無視)
        const delta = y - lastY.current;
        if (delta > 4) setHidden(true);
        else if (delta < -4) setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="sticky top-0 z-50 transition-transform duration-300"
      // 表示中は transform を持たせない (undefined)。translateY(0) でも transform が
      // 付いていると、この div が中の TopHeader の fixed 要素 (SPメニュー/オーバーレイ) の
      // containing block になってしまい、メニューがヘッダーの高さに潰れて背景が消える。
      style={{ transform: hidden ? "translateY(-100%)" : undefined }}
    >
      {children}
    </div>
  );
}
