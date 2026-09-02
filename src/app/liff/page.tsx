// LIFF入口 (リッチメニュー「自分のタイプ」「Alice Plus」の着地点)。
//
// リッチメニューのURLボタンは全ユーザー共通の固定URLしか持てないため、
// LIFF経由で「タップした人が誰か」を確認し、本人専用のページへ即リダイレクトする。
// 遷移解決は /api/line/liff-route (アクセストークン検証つき) が担う。

import type { Metadata } from "next";

import LiffRouterClient from "./LiffRouterClient";

export const metadata: Metadata = {
  title: "ひらいています… | ワタシのトリセツ",
  robots: { index: false, follow: false },
};

export default function LiffPage() {
  return <LiffRouterClient />;
}
