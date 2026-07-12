"use client";

// ゲスト決済 (未ログインで購入) の着地ページ。
//
// 導線: /aisho など匿名ページで購入 → Stripe → ここ。
//   全解放は購入時のメールアドレスに紐付く (webhook が email 優先で plan='full')。
//   同じメールでログイン (magic link) すれば、全解放されたトリセツ/相性/友達の結果が見られる。
//   LoginCard をそのまま置き、購入直後にログイン (= magic link 発行) できるようにする。

import Link from "next/link";
import { LoginCard } from "@/components/LoginCard";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

export default function PurchaseCompletePage() {
  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-5 py-14"
      style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
    >
      <div className="mb-6 w-full max-w-[420px] text-center">
        <div
          aria-hidden="true"
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white"
          style={{ background: "#3FA96A" }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1
          className="text-[22px] font-black leading-[1.4]"
          style={{ color: NAVY }}
        >
          購入ありがとうございます！
        </h1>
      </div>

      {/* 購入直後にそのままログイン (magic link 発行)。届いたリンクから本人確認。 */}
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
