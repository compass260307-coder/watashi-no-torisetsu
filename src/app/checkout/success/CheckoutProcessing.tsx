"use client";

// プレミアム化 v2 Week 2 T2-5: 決済成功後の AI 生成ポーリング UI
//
// /checkout/success?session_id=cs_xxx に到達後、5 秒ごとに /api/checkout/status を
// 叩いて状態を表示。完了したら /integrated/[id] へ遷移。
//
// 状態表示:
//   - resolving:  決済情報を確認しています (payment_history 未着信 = Webhook 待ち)
//   - generating: AI が真のトリセツを生成しています (通常 30-90 秒)
//   - completed:  完成。/integrated/[id] へ自動遷移
//   - failed:     失敗。サポート連絡案内
//   - timeout:    3 分超過。LINE 通知を待つ画面に遷移

import { useEffect, useRef, useState } from "react";
// useState の lazy initializer は React 公式の純粋性ルールを満たす
// (useRef(Date.now()) は render 中の impure call 扱いになるため避ける)
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Props {
  sessionId: string;
}

type PollResponse = {
  payment_status:
    | "unknown"
    | "pending"
    | "completed"
    | "failed"
    | "refunded";
  generation_status:
    | "none"
    | "pending"
    | "generating"
    | "completed"
    | "failed";
  integrated_trisetsu_id?: string;
  failure_reason?: string;
};

type Phase =
  | "resolving"
  | "generating"
  | "completed"
  | "failed"
  | "timeout";

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 180_000; // 3 分

export function CheckoutProcessing({ sessionId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("resolving");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [failureDetail, setFailureDetail] = useState<string | null>(null);
  // useState の lazy initializer はマウント時に一度だけ評価されるため
  // Date.now() を呼んでも render purity を満たす
  const [startedAt] = useState<number>(() => Date.now());

  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    const ctrl = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as PollResponse;
        if (stoppedRef.current) return;

        if (data.generation_status === "completed" && data.integrated_trisetsu_id) {
          setPhase("completed");
          setTimeout(() => {
            router.replace(`/integrated/${data.integrated_trisetsu_id}`);
          }, 500);
          return;
        }
        if (data.generation_status === "failed" || data.payment_status === "failed") {
          setPhase("failed");
          if (data.failure_reason) setFailureDetail(data.failure_reason);
          return;
        }
        if (data.payment_status === "unknown") {
          setPhase("resolving");
          return;
        }
        setPhase("generating");
      } catch {
        // network / abort は次のポーリングへ
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    const tickId = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    const timeoutId = setTimeout(() => {
      if (!stoppedRef.current) setPhase("timeout");
    }, TIMEOUT_MS);

    return () => {
      stoppedRef.current = true;
      ctrl.abort();
      clearInterval(intervalId);
      clearInterval(tickId);
      clearTimeout(timeoutId);
    };
  }, [sessionId, router, startedAt]);

  // ===== UI =====
  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col items-center px-5 py-12 max-w-md mx-auto w-full">
        <header className="text-center mb-10">
          <p className="text-[10px] font-bold tracking-[0.4em] text-primary/70 mb-3">
            CHECKOUT
          </p>
          <h1 className="font-serif text-xl sm:text-2xl text-foreground leading-snug">
            {renderTitle(phase)}
          </h1>
        </header>

        {/* 状態インジケーター (絵文字不使用、テキスト + 装飾で表現) */}
        <div className="mb-8" aria-hidden>
          {phase === "completed" ? (
            <p className="font-serif text-base tracking-[0.4em] text-primary">
              完了
            </p>
          ) : phase === "failed" ? (
            <p className="font-serif text-base tracking-[0.4em] text-foreground">
              エラー
            </p>
          ) : phase === "timeout" ? (
            <p className="font-serif text-sm tracking-[0.3em] text-muted">
              お待ちください
            </p>
          ) : (
            <Spinner />
          )}
        </div>

        {/* 説明文 */}
        <div className="text-center text-sm text-foreground leading-relaxed mb-8 whitespace-pre-line">
          {renderBody(phase, elapsedSec, failureDetail)}
        </div>

        {/* セカンダリ案内 */}
        {phase === "generating" && (
          <p className="text-xs text-muted text-center leading-relaxed mb-6">
            完了したら LINE でもお知らせします。{"\n"}
            このページを閉じても大丈夫です。
          </p>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3 w-full">
          {phase === "failed" && (
            <Link
              href="/integrated/new"
              className="w-full rounded-full border-2 border-primary text-primary text-center px-6 py-3 text-sm font-bold"
            >
              もう一度試す
            </Link>
          )}
          {phase === "timeout" && (
            <p className="text-xs text-muted text-center leading-relaxed">
              生成が長引いています。LINE で完了通知をお待ちください。{"\n"}
              （通常 30〜90 秒で完了します）
            </p>
          )}
          <Link
            href="/zukan-mine"
            className="text-xs text-muted underline text-center hover:text-foreground transition-colors mt-2"
          >
            マイ図鑑に戻る
          </Link>
        </div>
      </main>
    </div>
  );
}

function renderTitle(phase: Phase): string {
  switch (phase) {
    case "resolving":
      return "決済を確認しています";
    case "generating":
      return "真のトリセツを生成中";
    case "completed":
      return "完成しました";
    case "failed":
      return "問題が発生しました";
    case "timeout":
      return "完了通知をお待ちください";
  }
}

function renderBody(
  phase: Phase,
  elapsedSec: number,
  failureDetail: string | null,
): string {
  switch (phase) {
    case "resolving":
      return "決済情報を確認しています。\nそのままお待ちください。";
    case "generating":
      return (
        `AI が 7 章構成の真のトリセツを書いています。\n` +
        `通常 30〜90 秒ほどで完成します。\n` +
        `\n` +
        `経過: ${elapsedSec} 秒`
      );
    case "completed":
      return "完成しました。トリセツ画面に移動します...";
    case "failed":
      return failureDetail
        ? `AI 生成中に問題が発生しました。\n\n詳細: ${failureDetail}\n\nサポート (公式 LINE のこのトーク) にご返信ください。`
        : "AI 生成中に問題が発生しました。\nサポート (公式 LINE のこのトーク) にご返信ください。";
    case "timeout":
      return "AI 生成に予想より時間がかかっています。完成したら LINE でお知らせします。";
  }
}

function Spinner() {
  return (
    <div
      className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary"
      style={{ animation: "spin 1.1s linear infinite" }}
    />
  );
}
