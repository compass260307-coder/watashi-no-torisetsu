"use client";

// 「みんなの目に映る、あなた」= AI生成の解説長文 (据え置き)。
//   /api/minna-no-me/[ownerToken] を POST して取得。生成中 (generating) の間は
//   一定間隔でポーリングし、完了 (completed) で本文を表示。失敗時は手動リトライ。
// もとは MinnaNoMePanel の一部だったが、タコ結果ページの ② 深掘り統合に伴い、
//   長文プローズ部分だけを再利用可能なコンポーネントとして切り出した (ロジックは不変)。

import { useEffect, useState } from "react";

type FetchState =
  | { kind: "loading" }
  | { kind: "done"; text: string }
  | { kind: "error" };

const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 4000;

export function MinnaNoMeProse({
  ownerToken,
  previewText,
}: {
  ownerToken: string;
  /** dev/プレビュー限定: 実データ形式 (done) の表示を確認するためのダミー本文。
   *  指定時は API を叩かず即 done 表示。本番通常フロー (未指定) の挙動は不変。 */
  previewText?: string;
}) {
  const [state, setState] = useState<FetchState>(
    previewText ? { kind: "done", text: previewText } : { kind: "loading" },
  );
  // 手動リトライ用: インクリメントで effect を再実行する。
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // プレビュー: ダミー本文が渡っていれば fetch せず done のまま。
    if (previewText) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function attempt(retries: number): Promise<void> {
      if (cancelled) return;
      setState({ kind: "loading" });
      try {
        const res = await fetch(`/api/minna-no-me/${ownerToken}`, {
          method: "POST",
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.status === "completed" && typeof data.text === "string") {
          setState({ kind: "done", text: data.text });
          return;
        }
        if (data?.status === "generating" && retries < MAX_RETRIES) {
          timer = setTimeout(() => attempt(retries + 1), RETRY_DELAY_MS);
          return;
        }
        setState({ kind: "error" });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }

    attempt(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [ownerToken, reloadKey, previewText]);

  const retryManually = () => setReloadKey((k) => k + 1);

  return (
    <section>
      {state.kind === "loading" && (
        <div
          className="flex items-center gap-3 text-[#2E2E5C]/60 py-6"
          role="status"
          aria-live="polite"
        >
          <span className="inline-block w-5 h-5 rounded-full border-2 border-[#5B5BEF]/30 border-t-[#5B5BEF] animate-spin" />
          <span className="text-sm font-bold">
            みんなの言葉から、あなたを読み解いています…
          </span>
        </div>
      )}
      {state.kind === "done" &&
        state.text.split("\n\n").map((para, i) => (
          <p
            key={i}
            className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
          >
            {para}
          </p>
        ))}
      {state.kind === "error" && (
        <div className="py-4">
          <p className="text-[#2E2E5C]/70 text-sm font-bold mb-3">
            解説文の準備がまだ整っていないみたい。少し時間をおいて試してね。
          </p>
          <button
            type="button"
            onClick={retryManually}
            className="rounded-full border-2 border-[#5B5BEF] text-[#5B5BEF] font-black text-sm px-4 py-2 hover:bg-[#F4F4FE] transition-colors"
          >
            もう一度読み込む
          </button>
        </div>
      )}
    </section>
  );
}
