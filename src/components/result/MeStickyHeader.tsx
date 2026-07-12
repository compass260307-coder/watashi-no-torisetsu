"use client";

// /me (自己診断結果) 専用のヘッダー + アンロックバー (16P 参考、2026-07-13 指示)。
//
// 挙動:
//   - ヘッダー部分は従来の ScrollHideHeader と同じ (下スクロールで隠れ、上で出る)
//   - その直下のバー (すべての結果のロックを解除) は「常時表示」。ヘッダーが隠れる
//     ときはヘッダーの高さぶんだけ全体を持ち上げ、バーが画面最上部に残る。
// ScrollHideHeader は children ごと -100% 平行移動するためバーも消えてしまう。
// ここではヘッダー実高を測り、隠すときは -headerHeight だけ動かす (バーは残る)。
//
// バーは /me だけの導線なのでこのファイルに同居 (他ページは従来 ScrollHideHeader)。

import { useEffect, useRef, useState, type ReactNode } from "react";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";

interface MeStickyHeaderProps {
  /** ヘッダー本体 (TopHeader)。 */
  children: ReactNode;
  /** バーを出すか (第二部が未解放のときのみ true)。false なら従来ヘッダーと同じ。 */
  showUnlockBar: boolean;
}

export function MeStickyHeader({ children, showUnlockBar }: MeStickyHeaderProps) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    // ヘッダー実高を測る (リサイズにも追従)
    const measure = () => setHeaderH(headerRef.current?.offsetHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 40) {
        setHidden(false);
      } else {
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
    <div className="sticky top-0 z-50">
      <div
        className="transition-transform duration-300"
        style={{
          transform: hidden && showUnlockBar ? `translateY(-${headerH}px)` : hidden ? "translateY(-100%)" : "translateY(0)",
        }}
      >
        <div ref={headerRef}>{children}</div>

        {showUnlockBar && (
          <div className="flex items-center justify-end border-b border-[#E9E9F2] bg-white px-4 py-2 md:px-8">
            <button
              type="button"
              onClick={scrollToPaywall}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-2 text-[12px] font-black text-white shadow-[0_3px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] md:text-[13px]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              すべての結果のロックを解除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
