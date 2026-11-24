import { notFound } from "next/navigation";
import { PurchaseLoadingScreen } from "@/components/result/PurchaseLoadingScreen";

// 完全版の購入直後の準備画面の UI 確認専用ページ。本番デプロイではページ自体を公開しない。
// 本番と同じ文言・20秒で流れ、終わると最初から流し直す。
export default function PurchaseLoadingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PurchaseLoadingScreen ownerToken="preview" waitingForAccess={false} preview />;
}
