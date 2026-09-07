"use client";

import { useState } from "react";

type IssueResponse = {
  code?: string;
  expires_at?: string;
  message?: string;
};

export function AliceTransferCodeClient() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);

  async function issueCode() {
    if (isIssuing) return;
    setIsIssuing(true);
    setError(null);

    try {
      const response = await fetch("/api/app/v1/transfer/codes", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = (await response.json().catch(() => null)) as IssueResponse | null;
      if (!response.ok || !body?.code || !body.expires_at) {
        throw new Error(body?.message ?? "コードを発行できませんでした。");
      }
      setCode(body.code);
      setExpiresAt(body.expires_at);
    } catch (caught) {
      setCode(null);
      setExpiresAt(null);
      setError(caught instanceof Error ? caught.message : "コードを発行できませんでした。");
    } finally {
      setIsIssuing(false);
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-[#DDE5FF] bg-white p-6 shadow-[0_18px_50px_rgba(23,42,99,0.10)] sm:p-8">
      {code ? (
        <div className="text-center" aria-live="polite">
          <p className="text-sm font-bold text-[#5B6683]">Aliceアプリへ入力するコード</p>
          <p className="mt-3 select-all font-mono text-3xl font-black tracking-[0.16em] text-[#172A63] sm:text-4xl">
            {code}
          </p>
          <p className="mt-4 text-xs leading-6 text-[#5B6683]">
            有効期限: {formatExpiry(expiresAt)}
            <br />
            このコードは他の人へ送らないでください。新しく発行すると、前のコードは無効になります。
          </p>
          <button
            type="button"
            onClick={issueCode}
            disabled={isIssuing}
            className="mt-6 min-h-12 rounded-full border border-[#3568F4] px-6 text-sm font-bold text-[#3568F4] disabled:opacity-50"
          >
            {isIssuing ? "再発行中…" : "コードを再発行"}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-xl font-black text-[#172A63]">引き継ぎコードを発行</h2>
          <p className="mt-3 text-sm leading-7 text-[#5B6683]">
            発行されたコードは24時間有効です。Aliceアプリでコードを確認後、アプリ側でログインしてください。
          </p>
          {error ? (
            <p className="mt-4 text-sm font-bold text-[#C9364E]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={issueCode}
            disabled={isIssuing}
            className="mt-6 min-h-12 rounded-full bg-[#3568F4] px-8 text-base font-bold text-white shadow-[0_4px_0_#2455D9] disabled:opacity-50"
          >
            {isIssuing ? "発行中…" : "コードを発行する"}
          </button>
        </div>
      )}
    </section>
  );
}

function formatExpiry(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}
