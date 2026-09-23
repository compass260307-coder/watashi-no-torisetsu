// プレミアム化 v3 Day 8: マジックリンク発行 UI (Web ファースト永続アクセス点)
//
// 用途:
//   - Cookie 切れ / 別端末からアクセスしたいユーザーのログイン入口 (直接 /login 訪問)
//   - 完成通知メールの本文からも誘導される
//
// ※ カード本体 (フォーム/送信/完了画面) は components/LoginCard に共通化し、
//    ヘッダーから開くログインモーダル (LoginModal) と同じ見た目・挙動を共有する。
//
// 2026-07-30 デザイン改良: 孤立したカード1枚 → サイト共通chrome (TopHeader/TopFooter)
// + おかえり感のあるキャラ挿絵 (dog_R: おうちの前で出迎える犬) + ポップな見出し。
// カード本体は共有コンポーネントのため変更しない (モーダル/購入完了ページに波及させない)。

import type { Metadata } from "next";
import LoginPageContent from "@/components/login/LoginPageContent";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "ログイン",
  alternates: localizedAlternates(
    "ja",
    "/login",
    "/ko/login",
    "/en/login",
    "/id/login",
  ),
};

export default function LoginPage() {
  return <LoginPageContent locale="ja" />;
}
