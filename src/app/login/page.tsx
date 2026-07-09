"use client";

// プレミアム化 v3 Day 8: マジックリンク発行 UI (Web ファースト永続アクセス点)
//
// 用途:
//   - Cookie 切れ / 別端末からアクセスしたいユーザーのログイン入口 (直接 /login 訪問)
//   - 完成通知メールの本文からも誘導される
//
// ※ カード本体 (フォーム/送信/完了画面) は components/LoginCard に共通化し、
//    ヘッダーから開くログインモーダル (LoginModal) と同じ見た目・挙動を共有する。
//    このページは淡背景の上にカードを中央配置し「トップに戻る」を添えるだけ。

import Link from "next/link";
import { LoginCard } from "@/components/LoginCard";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

export default function LoginPage() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-5 py-14"
      style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
    >
      <LoginCard />

      <Link
        href="/"
        className="mt-8 text-center text-[12px] underline underline-offset-2 transition-colors hover:opacity-70"
        style={{ color: `${NAVY}80` }}
      >
        トップに戻る
      </Link>
    </main>
  );
}
