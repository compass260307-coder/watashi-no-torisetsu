// 確認専用: 診断結果作成中ページ (DiagnosisAnalyzingLoader) を単体で見られる
// プレビュールート。本来は /diagnosis の送信中にしか表示されないため、
// デザイン確認用にここから直接踏めるようにする (/preview/[typeId] と同じ扱い)。
import type { Metadata } from "next";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PreviewAnalyzingPage() {
  return <DiagnosisAnalyzingLoader />;
}
