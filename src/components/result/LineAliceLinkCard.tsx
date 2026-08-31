"use client";

// Alice Plus (LINE) 公開: LINE 連携導線カード。設置場所は /alice のみ (2026-08-31
// オーナー指示で /me からは撤去)。/alice の青系カードデザインに合わせている。
//
// ①友だち追加 → ②連携コード発行 (POST /api/line/link-code・要ログインセッション)
// → ③トークに6桁送信、の3ステップ。連携完了の計測は webhook 側の
// line_link_completed が担うので、ここでは発行の成否だけを扱う。

import { useState } from "react";

const LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/%40867domoo";

type IssueState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "issued"; code: string }
  | { status: "error"; message: string };

function errorMessage(errorCode: string | undefined, httpStatus: number): string {
  if (httpStatus === 401 || errorCode === "login_required") {
    return "この結果を作ったスマホ・ブラウザで開くと発行できます。";
  }
  if (httpStatus === 409 || errorCode === "diagnosis_required") {
    return "先にWeb診断を完了すると発行できます。";
  }
  if (httpStatus === 429 || errorCode === "rate_limited") {
    return "発行回数が多いようです。1時間ほどおいてもう一度どうぞ。";
  }
  return "うまく発行できませんでした。少し時間をおいてもう一度どうぞ。";
}

export default function LineAliceLinkCard() {
  const [issue, setIssue] = useState<IssueState>({ status: "idle" });

  const issueCode = async () => {
    if (issue.status === "loading") return;
    setIssue({ status: "loading" });
    try {
      const res = await fetch("/api/line/link-code", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        code?: string;
        error?: string;
      };
      if (!res.ok || !body.code) {
        setIssue({ status: "error", message: errorMessage(body.error, res.status) });
        return;
      }
      setIssue({ status: "issued", code: body.code });
    } catch {
      setIssue({
        status: "error",
        message: "通信がうまくいきませんでした。電波の良いところでもう一度どうぞ。",
      });
    }
  };

  return (
    <section className="rounded-[28px] border border-[#DDE5FF] bg-white p-8 shadow-[0_18px_60px_rgba(53,104,244,0.10)]">
      <h2 className="text-xl font-black text-[#17336F]">LINEでAliceと話す</h2>
      <p className="mt-3 text-sm leading-7 text-[#596786]">
        診断結果を知っているAliceと、LINEでいつでもおしゃべり。今日の占いも毎日引けます。1日3通まで無料です。
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <a
          href={LINE_ADD_FRIEND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#06C755] px-6 text-base font-black text-white shadow-[0_6px_0_#049b42]"
        >
          ① Aliceを友だち追加
        </a>
        {issue.status === "issued" ? (
          <div className="rounded-2xl border border-[#DDE5FF] bg-[#F7F9FF] px-5 py-4 text-center">
            <p className="text-xs font-black text-[#596786]">
              ② 連携コード (10分間有効)
            </p>
            <p className="my-1 text-[34px] font-black tracking-[0.3em] text-[#17336F]">
              {issue.code}
            </p>
            <p className="text-xs leading-6 text-[#596786]">
              ③ Aliceとのトークに、この6桁をそのまま送ると連携完了です。
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={issueCode}
            disabled={issue.status === "loading"}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[#3568F4] px-6 text-base font-black text-white shadow-[0_6px_0_#244BC0] disabled:opacity-60"
          >
            {issue.status === "loading" ? "発行中…" : "② 連携コードを発行する"}
          </button>
        )}
        {issue.status === "error" && (
          <p className="text-sm leading-6 text-[#C2410C]">{issue.message}</p>
        )}
      </div>
    </section>
  );
}
