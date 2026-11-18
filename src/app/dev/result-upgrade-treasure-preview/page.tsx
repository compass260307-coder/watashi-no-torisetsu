import { notFound } from "next/navigation";
import { TreasurePreviewClient } from "./TreasurePreviewClient";

// ローカル専用: 7問を答えずに、宝箱からクーポンを受け取る演出だけを繰り返し確認する。
export default function ResultUpgradeTreasurePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TreasurePreviewClient />;
}
