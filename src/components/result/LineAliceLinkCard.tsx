"use client";

// Alice Plus (LINE) 公開: /me 本人向けの LINE 連携導線。
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
    <section className="mt-16 mb-14">
      <h2 className="mb-3 text-[22px] font-black leading-tight text-[#2E2E5C] md:text-[26px]">
        AliceとLINEで話す
      </h2>
      <p className="body-gothic mb-5 text-[15px] leading-[1.8] text-[#1A1A1A] md:text-[16px]">
        診断結果を知っているAI「Alice」と、LINEでいつでもおしゃべり。今日の占いも毎日引けます。1日3通まで無料です。
      </p>
      <div className="flex flex-col items-start gap-3">
        <a
          href={LINE_ADD_FRIEND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#06C755] px-6 py-3 text-[14px] font-black text-white shadow-[0_4px_0_#049b42] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#049b42]"
        >
          ① Aliceを友だち追加
          <span aria-hidden="true">→</span>
        </a>
        {issue.status === "issued" ? (
          <div className="w-full max-w-[420px] rounded-xl border border-[#E3E6F5] bg-white/95 px-5 py-4 text-center">
            <p className="text-[12px] font-black text-[#2E2E5C]/60">
              ② 連携コード (10分間有効)
            </p>
            <p className="my-1 text-[34px] font-black tracking-[0.3em] text-[#2E2E5C]">
              {issue.code}
            </p>
            <p className="body-gothic text-[12px] leading-relaxed text-[#2E2E5C]/70">
              ③ Aliceとのトークに、この6桁をそのまま送ると連携完了です。
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={issueCode}
            disabled={issue.status === "loading"}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#5B5BEF] px-6 py-3 text-[14px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4] disabled:opacity-60"
          >
            {issue.status === "loading" ? "発行中…" : "② 連携コードを発行する"}
            <span aria-hidden="true">→</span>
          </button>
        )}
        {issue.status === "error" && (
          <p className="body-gothic text-[13px] leading-relaxed text-[#C2410C]">
            {issue.message}
          </p>
        )}
      </div>
    </section>
  );
}
