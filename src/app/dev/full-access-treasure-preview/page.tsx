import { notFound } from "next/navigation";
import { FullAccessTreasurePreviewClient } from "./FullAccessTreasurePreviewClient";

// ローカル専用: 結果ページの「アンロック」CTAで開く、完全版の宝箱クーポン演出を繰り返し確認する。
export default function FullAccessTreasurePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FullAccessTreasurePreviewClient />;
}
