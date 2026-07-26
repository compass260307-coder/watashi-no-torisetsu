import type { ReactNode } from "react";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { UnmeiAttentionClear } from "@/components/uranai/UnmeiAttentionClear";

// /unmei の全状態 (未購入ティーザー / 出生情報入力 / 生成中 / 鑑定表示) に
// サイト共通のヘッダー・フッターを付ける (2026-07-26 指示)。
// 本文は page.tsx 側の各状態コンポーネントが描画する。
export default function UnmeiLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* 下部ナビ「運命」の赤バッジ解除 (どの状態でも到達 = 確認済み扱い) */}
      <UnmeiAttentionClear />
      <TopHeader />
      {children}
      <TopFooter />
    </>
  );
}
