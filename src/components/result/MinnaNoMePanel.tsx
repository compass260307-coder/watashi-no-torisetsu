"use client";

// 「みんなの目」タブの解除後パネル。
//   上から: リード文 → ギャップ文(数値なし) → もう一人のワタシ(型ページ遷移) →
//           AI解説文(遅延生成・loading付き) → みんなの言葉(手紙・言葉のみ)。
// AI解説文は /api/minna-no-me/[ownerToken] を POST して取得。生成中は数秒おきに再試行。

import { useEffect, useState } from "react";
import Link from "next/link";

interface MinnaNoMePanelProps {
  ownerToken: string;
  selfEssence: string;
  friendEssence: string;
  friendTypeName: string;
  friendPreviewPath: string;
  matched: boolean;
  gapSentence: string | null;
  favoritePoints: string[];
  letters: { name: string; message: string }[];
  // B-1: 手紙/チップが両方空のとき出すスコア由来の1行 (ルールベース)。無ければ null。
  scoreImpression: string | null;
}

type FetchState =
  | { kind: "loading" }
  | { kind: "done"; text: string }
  | { kind: "error" };

const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 4000;

export function MinnaNoMePanel(props: MinnaNoMePanelProps) {
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  // 手動リトライ用: インクリメントで effect を再実行する。
  const [reloadKey, setReloadKey] = useState(0);
  const { ownerToken } = props;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 生成中 (generating) の間は一定間隔でポーリングし、完了したら本文を表示。
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
  }, [ownerToken, reloadKey]);

  const retryManually = () => setReloadKey((k) => k + 1);

  return (
    <div className="px-1 pt-1 pb-2">
      {/* リード文 */}
      <p className="text-[#3A2D6B]/70 text-sm mb-4">
        友達3人が答えてくれました。ここからは「みんなの目に映るあなた」です。
      </p>

      {/* ギャップ (数値なし・言葉のみ) */}
      {props.gapSentence && (
        <p className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6] mb-6">
          {props.gapSentence}
        </p>
      )}

      {/* もう一人のワタシ */}
      <section className="mb-6">
        <h3 className="text-[#3A2D6B] font-black text-base mb-2">
          もう一人のワタシ
        </h3>
        {props.matched ? (
          <p className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6]">
            みんなの目にも、あなたはあなたのまま映ってる。
            自分で選んできた「{props.selfEssence}」は、
            まわりから見てもブレていないみたい。
          </p>
        ) : (
          <Link
            href={props.friendPreviewPath}
            className="block rounded-2xl border-2 border-[#0094D8]/25 bg-white px-4 py-4 hover:bg-[#FFF0F3] transition-colors"
          >
            <span className="block text-[#3A2D6B]/60 text-sm font-bold">
              自分では
            </span>
            <span className="block text-[#3A2D6B] font-black text-lg mb-2">
              {props.selfEssence}
            </span>
            <span className="block text-[#FE3C72]/70 text-sm font-bold">
              みんなから見ると
            </span>
            <span className="flex items-center justify-between">
              <span className="text-[#FE3C72] font-black text-lg">
                {props.friendEssence}
              </span>
              <span className="text-[#FE3C72] text-sm font-bold shrink-0 ml-2">
                このタイプを見る →
              </span>
            </span>
          </Link>
        )}
      </section>

      {/* AI解説文 (主役) */}
      <section className="mb-6">
        <h3 className="text-[#3A2D6B] font-black text-base mb-2">
          みんなの目に映る、あなた
        </h3>
        {state.kind === "loading" && (
          <div
            className="flex items-center gap-3 text-[#3A2D6B]/60 py-6"
            role="status"
            aria-live="polite"
          >
            <span className="inline-block w-5 h-5 rounded-full border-2 border-[#FE3C72]/30 border-t-[#FE3C72] animate-spin" />
            <span className="text-sm font-bold">
              みんなの言葉から、あなたを読み解いています…
            </span>
          </div>
        )}
        {state.kind === "done" &&
          state.text.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6] mb-4 last:mb-0"
            >
              {para}
            </p>
          ))}
        {state.kind === "error" && (
          <div className="py-4">
            <p className="text-[#3A2D6B]/70 text-sm font-bold mb-3">
              解説文の準備がまだ整っていないみたい。少し時間をおいて試してね。
            </p>
            <button
              type="button"
              onClick={retryManually}
              className="rounded-full border-2 border-[#FE3C72] text-[#FE3C72] font-black text-sm px-4 py-2 hover:bg-[#FFF0F3] transition-colors"
            >
              もう一度読み込む
            </button>
          </div>
        )}
      </section>

      {/* みんなの言葉 (手紙・言葉のみ・スコアなし) */}
      {(props.letters.length > 0 || props.favoritePoints.length > 0) && (
        <section>
          <h3 className="text-[#3A2D6B] font-black text-base mb-3">
            みんなの言葉
          </h3>

          {props.favoritePoints.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {props.favoritePoints.map((p, i) => (
                <span
                  key={`fav-${i}`}
                  className="rounded-full bg-[#FFF0F3] text-[#FE3C72] font-bold text-sm px-3 py-1"
                >
                  {p}
                </span>
              ))}
            </div>
          )}

          {props.letters.map((l, i) => (
            <figure
              key={`letter-${i}`}
              className="rounded-2xl bg-white border-2 border-[#0094D8]/15 px-4 py-3 mb-3 last:mb-0"
            >
              <blockquote className="body-gothic text-[#3A2D6B] font-medium text-base leading-[1.6]">
                {l.message}
              </blockquote>
              <figcaption className="text-[#3A2D6B]/60 text-xs font-bold mt-2 text-right">
                — {l.name}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      {/* B-1: 手紙もチップも無いとき、スコア由来の印象を1行 (別枠・別ラベル)。
          本物の手紙と誤認させないため封筒UIは使わず、ラベルも「スコアから見えるあなた」。 */}
      {props.letters.length === 0 &&
        props.favoritePoints.length === 0 &&
        props.scoreImpression && (
          <section>
            <h3 className="text-[#3A2D6B] font-black text-base mb-2">
              スコアから見えるあなた
            </h3>
            <p className="body-gothic text-[#3A2D6B]/85 text-base leading-[1.7]">
              {props.scoreImpression}
            </p>
          </section>
        )}
    </div>
  );
}
