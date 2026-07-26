import { notFound } from "next/navigation";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";

// /purchase-complete の成功画面をStripe決済なしで確認するローカル専用プレビュー。
// 本物のページは cs_test_... の session_id 検証が必須で、ローカルで気軽に開けないため。
export default function PurchaseCompletePreviewPage() {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  return <PurchaseCompleteView />;
}
