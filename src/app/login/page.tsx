"use client";

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

import { LoginCard } from "@/components/LoginCard";
import { SmoothImage } from "@/components/ui/SmoothImage";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

export default function LoginPage() {
  return (
    <>
      <TopHeader />
      <main
        className="flex flex-1 flex-col items-center px-5 pb-16 pt-8 md:pt-12"
        style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
      >
        {/* おかえり感の挿絵 (おうちの前で出迎える犬)。装飾なので alt は空。 */}
        <SmoothImage
          src="/characters/cut/dog_R.webp"
          alt=""
          width={480}
          height={480}
          priority
          className="h-auto w-[190px] md:w-[230px]"
        />
        <h1
          className="mt-1 text-center text-[26px] font-black leading-snug md:text-[30px]"
          style={{ color: NAVY }}
        >
          おかえりなさい！
        </h1>
        <p
          className="mt-2 mb-6 text-center text-[13px] font-bold leading-[1.9]"
          style={{ color: `${NAVY}99` }}
        >
          メールに届くリンクをタップするだけ。
          <br />
          パスワードは要りません。
        </p>
        <LoginCard />
      </main>
      <TopFooter />
    </>
  );
}
