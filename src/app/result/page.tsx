"use client";

// Phase 1.5-α Day 12-Polish: 旧 8 タイプの自己結果フォールバック表示を廃止。
//
// 自己診断結果の正規サーフェスは /me/[token] (16 タイプ) に一本化する。
// 通常フローは /diagnosis → /result/[ownerToken] → /me/[token] (308) で既に /me に着地するが、
// この no-arg /result は preview / API 失敗時のフォールバックとして残っていた。
// 旧実装は localStorage(torisetsu_result) から 8 タイプ結果を描画しており、/me(16 タイプ) と
// 自己診断結果が二重になっていたため、描画はやめてリダイレクトのみ行う。
//
//   - owner_token あり → /me/[token] (16 タイプの本来の結果)
//   - owner_token なし (未保存) → /diagnosis (再診断で token を発行し /me に到達)

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnalyzingLoader } from "@/components/AnalyzingLoader";

export default function ResultFallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const ownerToken = localStorage.getItem("torisetsu_owner_token");
    router.replace(ownerToken ? `/me/${ownerToken}` : "/diagnosis");
  }, [router]);

  return <AnalyzingLoader />;
}
