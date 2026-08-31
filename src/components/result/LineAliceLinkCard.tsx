"use client";

// Alice Plus (LINE) 公開: LINE 連携導線カード。設置場所は /hoshiyomi のホームのみ
// (2026-08-31 オーナー指示。/me → /alice を経て確定)。星読みのインディゴ系に合わせる。
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
    return "診断した時のスマホ・ブラウザで開くと発行できます。診断がまだの人は、先に無料診断からどうぞ。";
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
    <section className="rounded-2xl border border-[#5B5BEF]/15 bg-white p-6 shadow-[0_12px_34px_rgba(46,46,92,0.08)] md:p-8">
      <p className="text-[11px] font-black tracking-[0.14em] text-[#06C755]">
        LINE
      </p>
      <h2 className="mt-1 text-[20px] font-black text-[#2E2E5C] md:text-[24px]">
        LINEでもAliceと話せます
      </h2>
      <p className="mt-3 text-[14px] font-medium leading-[1.9] text-[#2E2E5C]/65 md:text-[15px]">
        診断結果を知っているAliceと、LINEでいつでもおしゃべり。今日の占いも毎日引けます。1日3通まで無料です。
      </p>
      <div className="mt-5 flex flex-col gap-3 md:max-w-[420px]">
        <a
          href={LINE_ADD_FRIEND_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#06C755] px-6 text-[15px] font-black text-white transition-transform active:scale-95"
        >
          ① Aliceを友だち追加
        </a>
        {issue.status === "issued" ? (
          <div className="rounded-xl border border-[#5B5BEF]/15 bg-[#F3F0FF] px-5 py-4 text-center">
            <p className="text-[11px] font-black text-[#2E2E5C]/55">
              ② 連携コード (10分間有効)
            </p>
            <p className="my-1 text-[32px] font-black tracking-[0.3em] text-[#2E2E5C]">
              {issue.code}
            </p>
            <p className="text-[12px] font-medium leading-relaxed text-[#2E2E5C]/65">
              ③ Aliceとのトークに、この6桁をそのまま送ると連携完了です。
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={issueCode}
            disabled={issue.status === "loading"}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#5B5BEF] px-6 text-[15px] font-black text-white transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {issue.status === "loading" ? "発行中…" : "② 連携コードを発行する"}
          </button>
        )}
        {issue.status === "error" && (
          <p className="text-[13px] font-bold leading-relaxed text-[#C2410C]">
            {issue.message}
          </p>
        )}
      </div>
    </section>
  );
}
