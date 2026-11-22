"use client";

// 自己診断の解析待ち画面を載せる層 (src/lib/analyzing-veil.ts)。ルートレイアウトに1つだけ置く。
// ページ移動をまたいで残り、移動先 (結果ページ) が出てから、ふわっと消える。
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getAnalyzingVeil,
  getServerAnalyzingVeil,
  hideAnalyzingVeil,
  releaseAnalyzingVeil,
  subscribeAnalyzingVeil,
} from "@/lib/analyzing-veil";

// 移動先のページが描かれるのを待つ時間 (移動が確定してから消し始めるまで)。
const SETTLE_MS = 150;
// 層を出したままページ移動が起きなかったときに、出しっぱなしを防ぐ上限。
// 解析待ちは最低20秒 + 保存の応答待ちなので、それより十分長くする。
const STUCK_LIMIT_MS = 90000;

export function AnalyzingVeilHost() {
  const veil = useSyncExternalStore(
    subscribeAnalyzingVeil,
    getAnalyzingVeil,
    getServerAnalyzingVeil,
  );
  const pathname = usePathname();
  const shown = veil.node !== null;

  // 層を出した時点のページを覚えておき、別のページへ移ったら消し始める。
  const shownAtPath = useRef<string | null>(null);
  useEffect(() => {
    if (!shown) {
      shownAtPath.current = null;
      return;
    }
    if (shownAtPath.current === null) {
      shownAtPath.current = pathname;
      return;
    }
    if (shownAtPath.current === pathname) return;
    const timeout = setTimeout(releaseAnalyzingVeil, SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [shown, pathname]);

  useEffect(() => {
    if (!shown) return;
    const timeout = setTimeout(hideAnalyzingVeil, STUCK_LIMIT_MS);
    return () => clearTimeout(timeout);
  }, [shown]);

  if (!shown) return null;
  return (
    <div
      className={`fixed inset-0 z-[70] flex flex-col overflow-y-auto overscroll-contain bg-[#FCFCFC] ${
        veil.leaving ? "friend-welcome-leave pointer-events-none" : ""
      }`}
    >
      {veil.node}
    </div>
  );
}
