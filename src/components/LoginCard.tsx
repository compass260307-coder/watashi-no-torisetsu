"use client";

// マジックリンク発行の白カード (16personalities のログインモーダル風)。
//   - /login ページと、ヘッダーから開くログインモーダル (LoginModal) の両方で再利用する。
//   - フロー: email 入力 → POST /api/auth/request-magic-link → 6桁コード入力
//     (enumeration 対策で存在判定はサーバ側、常に同じ画面へ)。
//   - onClose を渡すとカード右上に × (モーダル用) を表示する。

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import LoginCodeScreen from "./login/LoginCodeScreen";
import type { ResultLocale } from "@/i18n/result";

type LoginLocale = ResultLocale | "en" | "id";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";
const SORA = "#5B5BEF";

type Phase = "input" | "submitting" | "sent" | "error";

const LOGIN_COPY = {
  ja: {
    close: "閉じる",
    heading: "ログインリンクをリクエスト",
    description:
      "登録したメールアドレスにログインリンクをお送りします。",
    emailLabel: "メールアドレス",
    submitting: "送信中...",
    submit: "リンクを送る",
    sendError: "送信に失敗しました",
    networkError: "通信エラー",
    sentHeading: "メールをご確認ください",
    sentBody: "宛にログインリンクをお送りしました。",
    sentHelp:
      "1 時間以内にリンクをクリックしてください。\n届かない場合は迷惑メールフォルダもご確認ください。",
    reset: "別のメールアドレスで送り直す",
  },
  ko: {
    close: "닫기",
    heading: "로그인 링크 받기",
    description: "로그인 링크를 보내 드릴게요.\n이메일 주소를 입력해 주세요.",
    emailLabel: "이메일 주소",
    passwordHelp: "비밀번호 없이 이메일의 링크로 로그인할 수 있어요.",
    submitting: "보내는 중...",
    submit: "로그인 링크 받기",
    sendError: "전송에 실패했어요",
    networkError: "통신 오류가 발생했어요",
    sentHeading: "이메일을 확인해 주세요",
    sentBody: "주소로 로그인 링크를 보내 드렸어요.",
    sentHelp:
      "1시간 안에 링크를 눌러 주세요.\n메일이 보이지 않으면 스팸 메일함도 확인해 주세요.",
    reset: "다른 이메일 주소로 다시 받기",
  },
  en: {
    close: "Close",
    heading: "Get a sign-in link",
    description:
      "Enter your email and we’ll send you a secure sign-in link.\nNo password needed.",
    emailLabel: "Email address",
    passwordHelp: "No password needed. Sign in using the link in your email.",
    submitting: "Sending...",
    submit: "Send sign-in link",
    sendError: "We couldn’t send the link",
    networkError: "A network error occurred",
    sentHeading: "Check your email",
    sentBody: "We sent a sign-in link to this address.",
    sentHelp:
      "Open the link within 1 hour.\nIf you don’t see it, check your spam folder.",
    reset: "Use a different email address",
  },
  id: {
    close: "Tutup",
    heading: "Dapatkan tautan masuk",
    description: "Masukkan email Anda dan kami akan mengirim tautan masuk yang aman.\nTanpa kata sandi.",
    emailLabel: "Alamat email",
    passwordHelp: "Tanpa kata sandi. Masuk melalui tautan di email Anda.",
    submitting: "Mengirim...",
    submit: "Kirim tautan masuk",
    sendError: "Tautan tidak dapat dikirim",
    networkError: "Terjadi gangguan jaringan",
    sentHeading: "Periksa email Anda",
    sentBody: "Kami telah mengirim tautan masuk ke alamat ini.",
    sentHelp: "Buka tautan dalam 1 jam.\nJika tidak terlihat, periksa folder spam.",
    reset: "Gunakan alamat email lain",
  },
} as const;

export function LoginCard({
  onClose,
  locale = "ja",
  notice,
}: {
  onClose?: () => void;
  notice?: string;
  locale?: LoginLocale;
}) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [errorMessage, setErrorMessage] = useState("");
  const [challenge, setChallenge] = useState("");
  const [preview, setPreview] = useState(false);
  const copy = LOGIN_COPY[locale];
  const [googleAvailable, setGoogleAvailable] = useState(false);
  useEffect(() => {
    if (locale !== "ja") return;
    let active = true;
    void fetch("/api/auth/google", { cache: "no-store" })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (active) setGoogleAvailable(data?.available === true); })
      .catch(() => {});
    return () => { active = false; };
  }, [locale]);

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
      // 登録の有無では表示を分けず、通信失敗と再送制限のみ案内する。
      if (!res.ok && res.status !== 200) {
        setPhase("error");
        setErrorMessage(
          res.status === 429
            ? ({ ja: "新しいコードは60秒後にリクエストできます。", en: "Please wait 60 seconds before requesting another code.", ko: "60초 후 새 코드를 요청해 주세요.", id: "Tunggu 60 detik sebelum meminta kode baru." }[locale])
            : copy.sendError,
        );
        return;
      }
      const data = await res.json();
      if (typeof data.challenge !== "string") throw new Error(copy.sendError);
      setChallenge(data.challenge);
      setPreview(data.preview === true);
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
      className="relative w-full max-w-[540px] rounded-2xl bg-white px-5 py-8 sm:px-8 sm:py-9"
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
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#2E2E5C]/15 transition-colors hover:bg-[#2E2E5C]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B5BEF]"
          style={{ color: `${NAVY}99` }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
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
        <LoginCodeScreen email={trimmed} initialChallenge={challenge} onReset={reset} locale={locale} preview={preview} />
      ) : (
        <>
          {/* 見出しは h2: 設置先ページ (/login の「おかえりなさい！」や
              /purchase-complete の「購入ありがとうございます！」) が h1 を持つため。 */}
          <h2
            className="pr-7 text-[22px] font-bold leading-[1.5] tracking-tight sm:text-[28px]"
            style={{ color: NAVY }}
          >
            {copy.heading}
          </h2>
          <p
            className="mt-2 text-[14px] leading-[1.9] sm:text-[15px]"
            style={{ color: `${NAVY}99` }}
          >
            {copy.description.split("\n").map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </p>

          {notice && <p role="status" className="mt-4 rounded-lg bg-[#5B5BEF]/5 p-3 text-[13px] leading-relaxed text-[#2E2E5C]">{notice}</p>}
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <div>
              <label
                htmlFor={emailId}
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
                  id={emailId}
                  aria-describedby={locale === "ja" ? undefined : `${emailId}-help`}
                  required
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  maxLength={254}
                  disabled={phase === "submitting"}
                  className="w-full rounded-lg border py-3.5 pl-11 pr-4 text-[16px] transition-shadow placeholder:text-[#85859C] focus:outline-none focus:ring-2 disabled:opacity-60"
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

            {locale !== "ja" && (
              <p id={`${emailId}-help`} className="-mt-1 text-[12px] leading-[1.8] text-[#2E2E5C]/65">
                {LOGIN_COPY[locale].passwordHelp}
              </p>
            )}

            {locale === "ko" ? (
              <p className="-mt-1 text-[11px] leading-[1.7] text-[#2E2E5C]/55">
                이메일 주소는 로그인 링크 발송과 결과 복구를 위해 처리됩니다.
                자세한 내용은{" "}
                <Link
                  href="/ko/privacy"
                  className="font-bold underline underline-offset-2"
                >
                  개인정보처리방침
                </Link>
                에서 확인할 수 있습니다.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={!isValid || phase === "submitting"}
              className="w-full rounded-full py-4 text-[17px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B5BEF] disabled:opacity-50"
              style={{ backgroundColor: SORA }}
            >
              {phase === "submitting" ? copy.submitting : copy.submit}
            </button>

            {phase === "error" && errorMessage && (
              <p role="alert" className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-[13px] leading-relaxed text-red-700">
                {errorMessage}
              </p>
            )}
          </form>
          {locale === "ja" && googleAvailable && (
            <div className="mt-7">
              <p className="mb-3 text-center text-[13px] leading-relaxed text-[#2E2E5C]/65">
                以下の方法でもログインできます
              </p>
              <form action="/api/auth/google" method="post">
                <button
                  type="submit"
                  disabled={phase === "submitting"}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#DADCE0] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#3C4043] transition-colors hover:bg-[#F8F9FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B5BEF] disabled:opacity-50"
                >
                  <GoogleIcon />
                  Googleでログイン
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// 封筒アイコン (入力欄の左内側)。currentColor で文字色に追従。
function MailIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.85 46.98 24.55Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}
