"use client";

// マジックリンク発行の白カード (16personalities のログインモーダル風)。
//   - /login ページと、ヘッダーから開くログインモーダル (LoginModal) の両方で再利用する。
//   - フロー: email 入力 → POST /api/auth/request-magic-link → 送信完了画面
//     (enumeration 対策で存在判定はサーバ側、常に同じ画面へ)。
//   - onClose を渡すとカード右上に × (モーダル用) を表示する。

import { useState } from "react";
import type { ResultLocale } from "@/i18n/result";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

type Phase = "input" | "submitting" | "sent" | "error";

const LOGIN_COPY = {
  ja: {
    close: "閉じる",
    heading: "ログインリンクをリクエスト",
    description: "ログインリンクをお送りしますので、\nメールアドレスを入力してください。",
    emailLabel: "メールアドレス",
    submitting: "送信中...",
    submit: "リンクを送る",
    sendError: "送信に失敗しました",
    networkError: "通信エラー",
    sentHeading: "メールをご確認ください",
    sentBody: "宛にログインリンクをお送りしました。",
    sentHelp: "1 時間以内にリンクをクリックしてください。\n届かない場合は迷惑メールフォルダもご確認ください。",
    reset: "別のメールアドレスで送り直す",
  },
  ko: {
    close: "닫기",
    heading: "로그인 링크 받기",
    description: "로그인 링크를 보내 드릴게요.\n이메일 주소를 입력해 주세요.",
    emailLabel: "이메일 주소",
    submitting: "보내는 중...",
    submit: "로그인 링크 받기",
    sendError: "전송에 실패했어요",
    networkError: "통신 오류가 발생했어요",
    sentHeading: "이메일을 확인해 주세요",
    sentBody: "주소로 로그인 링크를 보내 드렸어요.",
    sentHelp: "1시간 안에 링크를 눌러 주세요.\n메일이 보이지 않으면 스팸 메일함도 확인해 주세요.",
    reset: "다른 이메일 주소로 다시 받기",
  },
} as const;

export function LoginCard({
  onClose,
  locale = "ja",
}: {
  onClose?: () => void;
  locale?: ResultLocale;
}) {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [errorMessage, setErrorMessage] = useState("");
  const copy = LOGIN_COPY[locale];

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
        body: JSON.stringify({ email: trimmed, locale }),
      });
      // enumeration 対策: 成功・失敗を問わず 200 が返るが、念のため status 確認
      if (!res.ok && res.status !== 200) {
        const data = await res.json().catch(() => null);
        setPhase("error");
        setErrorMessage(
          data?.error ?? `${copy.sendError} (HTTP ${res.status})`,
        );
        return;
      }
      setPhase("sent");
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : copy.networkError);
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
          aria-label={copy.close}
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
        <SentScreen email={trimmed} onReset={reset} locale={locale} />
      ) : (
        <>
          <h1
            className="whitespace-nowrap text-center text-[22px] font-bold leading-snug md:text-[28px]"
            style={{ color: NAVY }}
          >
            {copy.heading}
          </h1>
          <p
            className="mx-auto mt-3 text-center text-[15px] leading-[1.9]"
            style={{ color: `${NAVY}99` }}
          >
            {copy.description.split("\n").map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-[14px] font-bold"
                style={{ color: `${NAVY}B3` }}
              >
                {copy.emailLabel}
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
              {phase === "submitting" ? copy.submitting : copy.submit}
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
  locale,
}: {
  email: string;
  onReset: () => void;
  locale: ResultLocale;
}) {
  const copy = LOGIN_COPY[locale];
  return (
    <div className="flex flex-col items-center text-center">
      <h1
        className="text-[24px] font-bold leading-snug md:text-[28px]"
        style={{ color: NAVY }}
      >
        {copy.sentHeading}
      </h1>
      <p className="mt-4 text-[15px] leading-[1.9]" style={{ color: `${NAVY}CC` }}>
        <span className="break-all font-bold">{email}</span>
        <br />
        {copy.sentBody}
      </p>
      <p
        className="mt-3 text-[13px] leading-relaxed"
        style={{ color: `${NAVY}80` }}
      >
        {copy.sentHelp.split("\n").map((line, index) => (
          <span key={line}>
            {index > 0 && <br />}
            {line}
          </span>
        ))}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-[13px] underline underline-offset-2 transition-colors hover:opacity-70"
        style={{ color: `${NAVY}99` }}
      >
        {copy.reset}
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
