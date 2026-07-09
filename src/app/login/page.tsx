"use client";

// プレミアム化 v3 Day 8: マジックリンク発行 UI (Web ファースト永続アクセス点)
//
// 用途:
//   - Cookie 切れ / 別端末からアクセスしたいユーザーのログイン入口
//   - 完成通知メールの本文からも誘導される
//
// フロー:
//   email 入力 → POST /api/auth/request-magic-link → 送信完了画面 (enumeration 対策で
//   存在判定はサーバ側で行わない、常に同じ画面に遷移)
//
// デザイン: 16personalities のログインモーダル風。淡い背景の上に中央の白カード、
//   タイトル + 一言説明 + メールアイコン付き入力 + 塗りボタン (Sora ブルー)。

import { useState } from "react";
import Link from "next/link";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

type Phase = "input" | "submitting" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [errorMessage, setErrorMessage] = useState("");

  const trimmed = email.trim();
  const isValid =
    trimmed.length > 0 &&
    trimmed.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || phase === "submitting") return;
    setPhase("submitting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      // enumeration 対策: 成功・失敗を問わず 200 が返るが、念のため status 確認
      if (!res.ok && res.status !== 200) {
        const data = await res.json().catch(() => null);
        setPhase("error");
        setErrorMessage(
          data?.error ?? `送信に失敗しました (HTTP ${res.status})`,
        );
        return;
      }
      setPhase("sent");
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "通信エラー");
    }
  };

  const reset = () => {
    setPhase("input");
    setErrorMessage("");
  };

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center px-5 py-14"
      style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
    >
      {/* モーダル風の白カード */}
      <section
        className="w-full max-w-[420px] rounded-2xl bg-white px-6 py-8 md:px-8"
        style={{ boxShadow: "0 18px 50px rgba(46,46,92,0.16)" }}
      >
        {phase === "sent" ? (
          <SentScreen email={trimmed} onReset={reset} />
        ) : (
          <>
            <h1
              className="text-center text-[20px] font-bold leading-snug md:text-[22px]"
              style={{ color: NAVY }}
            >
              ログインリンクをリクエスト
            </h1>
            <p
              className="mx-auto mt-3 max-w-[300px] text-center text-[13px] leading-[1.9]"
              style={{ color: `${NAVY}99` }}
            >
              ログインリンクをお送りしますので、
              メールアドレスを入力してください。
            </p>

            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-[12px] font-bold"
                  style={{ color: `${NAVY}B3` }}
                >
                  メールアドレス
                </label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                    style={{ color: `${NAVY}66` }}
                  >
                    <MailIcon />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@gmail.com"
                    maxLength={254}
                    disabled={phase === "submitting"}
                    className="w-full rounded-lg border py-3 pl-11 pr-4 text-[14px] focus:outline-none focus:ring-2 disabled:opacity-60"
                    style={
                      {
                        borderColor: "#DBDCEB",
                        color: NAVY,
                        "--tw-ring-color": `${SORA}55`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isValid || phase === "submitting"}
                className="w-full rounded-lg py-3.5 text-[15px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: SORA }}
              >
                {phase === "submitting" ? "送信中..." : "リンクを送る"}
              </button>

              {phase === "error" && errorMessage && (
                <p className="whitespace-pre-line text-center text-[12px] text-red-500">
                  {errorMessage}
                </p>
              )}

              <p
                className="text-center text-[11px] leading-relaxed"
                style={{ color: `${NAVY}80` }}
              >
                リンクは 1 時間で失効します。一度開くと無効になります。
              </p>
            </form>
          </>
        )}
      </section>

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

function SentScreen({
  email,
  onReset,
}: {
  email: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1
        className="text-[20px] font-bold leading-snug md:text-[22px]"
        style={{ color: NAVY }}
      >
        メールをご確認ください
      </h1>
      <p
        className="mt-4 text-[13px] leading-[1.9]"
        style={{ color: `${NAVY}CC` }}
      >
        <span className="break-all font-bold">{email}</span>
        <br />
        宛にログインリンクをお送りしました。
      </p>
      <p
        className="mt-3 text-[12px] leading-relaxed"
        style={{ color: `${NAVY}80` }}
      >
        1 時間以内にリンクをクリックしてください。
        <br />
        届かない場合は迷惑メールフォルダもご確認ください。
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[12px] underline underline-offset-2 transition-colors hover:opacity-70"
        style={{ color: `${NAVY}99` }}
      >
        別のメールアドレスで送り直す
      </button>
    </div>
  );
}

// 封筒アイコン (入力欄の左内側)。currentColor で文字色に追従。
function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 7.5l8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
