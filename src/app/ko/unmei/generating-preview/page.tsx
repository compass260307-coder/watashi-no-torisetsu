import { notFound } from "next/navigation";
import UnmeiClient from "@/components/uranai/UnmeiClient";

export const dynamic = "force-dynamic";

// 運命の設計図の生成待ち画面 (韓国語) を確認するローカル専用ページ。
// 保存・決済・AI生成は行わない。約24秒で完成状態になり、「結果を見る」で
// 鑑定のサンプル (/ko/unmei/reading-preview) へ進む。本番デプロイでは公開しない。
export default function KoreanUnmeiGeneratingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <UnmeiClient initialState="pending" locale="ko" previewMode />;
}
