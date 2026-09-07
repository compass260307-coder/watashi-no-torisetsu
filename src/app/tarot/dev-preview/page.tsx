import { notFound } from "next/navigation";
import TarotLanding from "@/components/tarot/TarotLanding";

// 実データや決済履歴を変更せず、購入後の下部ナビを確認するローカル専用ページ。
export default function TarotPaidPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <TarotLanding />;
}
