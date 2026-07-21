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
//
// ここは「分析」ではなく即時リダイレクトのみ。分析中アニメ (Big Five 算出) は初回診断
// (/diagnosis の DiagnosisAnalyzingLoader) だけに限定し、ここはニュートラルな短いスピナーにする。

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResultFallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // localStorage 不可環境 (Cookie 全ブロック設定・一部 WebView) では getItem 自体が
    // throw する。KO 版 (KoResultPageClient) と同様に握りつぶして /diagnosis へ。
    let ownerToken: string | null = null;
    try {
      ownerToken = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // 未保存扱いにする
    }
    router.replace(ownerToken ? `/me/${ownerToken}` : "/diagnosis");
  }, [router]);

  // 分析コピーを出さない最小スピナー (リダイレクトは即時なので一瞬のみ表示)。
  return (
    <div className="min-h-screen flex items-center justify-center grid-bg">
      <div
        className="w-10 h-10 rounded-full border-[3px] border-[#2E2E5C]/20 border-t-[#2E2E5C] animate-spin"
        role="status"
        aria-label="読み込み中"
      />
    </div>
  );
}
