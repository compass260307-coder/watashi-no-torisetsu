// プレミアム化 v2 Week 2 T2-5: 決済成功後のランディングページ
//
// Stripe Checkout の success_url で /checkout/success?session_id={CHECKOUT_SESSION_ID}
// に到達する。
//
// 役割:
//   1. session_id を URL クエリから取り出す
//   2. CheckoutProcessing (Client Component) に渡してポーリング UI を起動
//
// session_id 自体は Stripe が払い出した文字列 (推測困難) なので、
// URL を知っている人 = 決済した本人と見なして認可なしで閲覧可能。
// 個人情報の表示はせず、生成ステータスのみ表示する。

import { redirect } from "next/navigation";
import { CheckoutProcessing } from "./CheckoutProcessing";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ session_id?: string }>;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId || typeof sessionId !== "string") {
    // session_id が無い場合は新規生成画面に戻す
    redirect("/integrated/new");
  }

  return <CheckoutProcessing sessionId={sessionId} />;
}

export function generateMetadata() {
  return {
    title: "決済確認中 | ワタシのトリセツ",
    description: "AI 統合トリセツを生成中です。",
    // ステータス画面なのでクロール拒否
    robots: { index: false, follow: false },
  };
}
