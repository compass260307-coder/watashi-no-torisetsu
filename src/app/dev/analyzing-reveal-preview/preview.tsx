"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { JA_DIAGNOSIS_SETTINGS } from "@/i18n/ja/diagnosis";
import { showAnalyzingVeil } from "@/lib/analyzing-veil";

export function AnalyzingRevealPreview({
  waitMs,
  previewType,
}: {
  waitMs: number;
  previewType: string;
}) {
  const router = useRouter();
  useEffect(() => {
    // 移動先: 見本データで描く結果ページ (実ユーザーのデータは参照しない。開発環境のみ有効)。
    const RESULT_PREVIEW_PATH = `/me/x?previewType=${previewType}&previewLock=1`;
    const analyzing = JA_DIAGNOSIS_SETTINGS.copy.analyzing;
    // スライドの切り替えは、本番 (20秒) と同じ割合で待ち時間に合わせて縮める。
    const scale = waitMs / (analyzing.minLoadingMs ?? 20000);
    showAnalyzingVeil(
      <DiagnosisAnalyzingLoader
        messages={analyzing.messages}
        steps={analyzing.steps}
        totalMs={waitMs}
        slides={analyzing.slides}
        slideDurationsMs={analyzing.slideDurationsMs?.map((ms) => ms * scale)}
        slidesLabel={analyzing.slidesLabel}
      />,
    );
    try {
      router.prefetch(RESULT_PREVIEW_PATH);
    } catch {
      // 先読みは任意。
    }
    const timeout = setTimeout(() => router.push(RESULT_PREVIEW_PATH), waitMs);
    return () => clearTimeout(timeout);
  }, [router, waitMs, previewType]);

  // 層に出しているあいだ、このページ自体は同じ地色の空の画面にしておく (本番の診断ページと同じ)。
  return <div className="min-h-screen flex-1 bg-[#FCFCFC]" aria-busy="true" />;
}
