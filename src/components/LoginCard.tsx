"use client";

// マジックリンク発行の白カード (16personalities のログインモーダル風)。
//   - /login ページと、ヘッダーから開くログインモーダル (LoginModal) の両方で再利用する。
//   - フロー: email 入力 → POST /api/auth/request-magic-link → 送信完了画面
//     (enumeration 対策で存在判定はサーバ側、常に同じ画面へ)。
//   - onClose を渡すとカード右上に × (モーダル用) を表示する。

import { useState } from "react";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

type Phase = "input" | "submitting" | "sent" | "error";

export function LoginCard({ onClose }: { onClose?: () => void }) {
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
    <section
      className="relative w-full max-w-[440px] rounded-2xl bg-white px-6 py-8 md:px-8"
      style={{
        fontFamily: FONT_STACK,
        boxShadow: "0 18px 50px rgba(46,46,92,0.16)",
      }}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#2E2E5C]/5"
          style={{ color: `${NAVY}99` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {phase === "sent" ? (
        <SentScreen email={trimmed} onReset={reset} />
      ) : (
        <>
          <h1
            className="whitespace-nowrap text-center text-[22px] font-bold leading-snug md:text-[28px]"
            style={{ color: NAVY }}
          >
            ログインリンクをリクエスト
          </h1>
          <p
            className="mx-auto mt-3 text-center text-[15px] leading-[1.9]"
            style={{ color: `${NAVY}99` }}
          >
            ログインリンクをお送りしますので、
            <br />
            メールアドレスを入力してください。
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-[14px] font-bold"
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
                  className="w-full rounded-lg border py-3.5 pl-11 pr-4 text-[16px] focus:outline-none focus:ring-2 disabled:opacity-60"
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
              className="w-full rounded-lg py-4 text-[17px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: SORA }}
            >
              {phase === "submitting" ? "送信中..." : "リンクを送る"}
            </button>

            {phase === "error" && errorMessage && (
              <p className="whitespace-pre-line text-center text-[13px] text-red-500">
                {errorMessage}
              </p>
            )}
          </form>
        </>
      )}
    </section>
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
        className="text-[24px] font-bold leading-snug md:text-[28px]"
        style={{ color: NAVY }}
      >
        メールをご確認ください
      </h1>
      <p className="mt-4 text-[15px] leading-[1.9]" style={{ color: `${NAVY}CC` }}>
        <span className="break-all font-bold">{email}</span>
        <br />
        宛にログインリンクをお送りしました。
      </p>
      <p
        className="mt-3 text-[13px] leading-relaxed"
        style={{ color: `${NAVY}80` }}
      >
        1 時間以内にリンクをクリックしてください。
        <br />
        届かない場合は迷惑メールフォルダもご確認ください。
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[13px] underline underline-offset-2 transition-colors hover:opacity-70"
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
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
