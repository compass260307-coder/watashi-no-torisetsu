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
// ブランド方針 (T3-5): 絵文字なし、明朝体、和の上品さ。

import { useState } from "react";
import Link from "next/link";

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
    <main className="flex flex-col flex-1 items-center justify-center px-5 py-10 max-w-lg mx-auto w-full">
      <header className="text-center mb-8 animate-fade-in-up">
        <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
          LOGIN
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          ログインリンクを送信
        </h1>
      </header>

      {phase === "sent" && (
        <SentScreen email={trimmed} onReset={reset} />
      )}

      {phase !== "sent" && (
        <form
          onSubmit={submit}
          className="w-full flex flex-col gap-4 animate-fade-in-up stagger-2"
        >
          <p className="text-sm text-foreground leading-relaxed text-center mb-2">
            ご購入時に登録したメールアドレスを入力すると、
            <br />
            ログイン用のリンクをお送りします。
          </p>

          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-bold text-muted mb-2"
            >
              メールアドレス
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={254}
              disabled={phase === "submitting"}
              className="w-full rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={!isValid || phase === "submitting"}
            className={`w-full rounded-full px-8 py-4 text-base font-bold transition-all shadow-md ${
              isValid && phase !== "submitting"
                ? "bg-primary-gradient text-white hover:scale-[1.02] active:scale-[0.98]"
                : "bg-card-border text-muted cursor-not-allowed"
            }`}
          >
            {phase === "submitting" ? "送信中..." : "リンクを送信"}
          </button>

          {phase === "error" && errorMessage && (
            <p className="text-xs text-red-500 text-center whitespace-pre-line">
              {errorMessage}
            </p>
          )}

          <p className="text-[11px] text-muted leading-relaxed text-center mt-2">
            リンクは <strong>1 時間</strong> で失効します。
            <br />
            一度開くと無効になります。
          </p>
        </form>
      )}

      <Link
        href="/"
        className="text-xs text-muted/70 underline hover:text-foreground text-center mt-10"
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
    <section className="w-full flex flex-col items-center text-center animate-fade-in-up stagger-2">
      <div className="w-full rounded-2xl border border-card-border bg-label-bg p-6 mb-6">
        <p className="text-base font-bold mb-3">メールをご確認ください</p>
        <p className="text-sm text-foreground leading-relaxed mb-3">
          <span className="font-semibold break-all">{email}</span>
          <br />
          宛にログインリンクをお送りしました。
        </p>
        <p className="text-xs text-muted leading-relaxed">
          1 時間以内にリンクをクリックしてください。
          <br />
          届かない場合は迷惑メールフォルダもご確認ください。
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="text-xs text-muted underline hover:text-foreground"
      >
        別のメールアドレスで送り直す
      </button>
    </section>
  );
}
