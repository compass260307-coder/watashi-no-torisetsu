import { notFound } from "next/navigation";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { JA_DIAGNOSIS_SETTINGS } from "@/i18n/ja/diagnosis";

// 自己診断の解析待ち画面 (日本語) の UI確認専用ページ。
// 本番デプロイではページ自体を公開しない。
// 本番と同じ i18n コピー・表示時間で再生される。リロードで最初から再生される。
export default function AnalyzingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const analyzing = JA_DIAGNOSIS_SETTINGS.copy.analyzing;
  return (
    <DiagnosisAnalyzingLoader
      messages={analyzing.messages}
      steps={analyzing.steps}
      messageDurationsMs={analyzing.messageDurationsMs}
    />
  );
}
