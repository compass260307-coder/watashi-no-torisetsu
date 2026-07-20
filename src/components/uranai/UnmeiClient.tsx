"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BirthProfileForm from "@/components/birth/BirthProfileForm";

type State = "no_birth" | "pending" | "timeout" | "ready";

type Props = {
  initialState: "no_birth" | "pending";
};

// 生成完了までのタイムアウト (指示書④: 無限スピナー禁止・60秒で再試行案内)
const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;
// 60秒で完了しなかった場合、手動リトライ案内を出す前に自動で再生成を試みる回数。
// (サーバ側の生成試行上限とは別の、クライアント発の再キック。上限超過はサーバが 'failed' で止める)
const MAX_AUTO_RETRIES = 2;

export default function UnmeiClient({ initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(initialState);
  const deadlineRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRetriesRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // 生成をキック。force=true はサーバ側の自動再生成上限を超えた手動リトライ。
  const kickGeneration = useCallback(async (force = false) => {
    try {
      await fetch("/api/unmei/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
    } catch {
      /* ポーリング側で回復可能なので握りつぶす */
    }
  }, []);

  // pending 状態のポーリング開始。60秒で MAX_AUTO_RETRIES まで自動再生成、尽きたら手動案内。
  const startPending = useCallback(() => {
    stopPolling();
    setState("pending");
    deadlineRef.current = Date.now() + TIMEOUT_MS;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/unmei/status", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          if (j?.state === "ready") {
            stopPolling();
            setState("ready");
            router.refresh(); // サーバコンポーネントを再描画して鑑定を表示
            return;
          }
          if (j?.state === "no_birth") {
            stopPolling();
            setState("no_birth");
            return;
          }
          if (j?.state === "failed") {
            // サーバが自動再生成の上限に達した → 手動リトライ待ち
            stopPolling();
            setState("timeout");
            return;
          }
        }
      } catch {
        /* 一時的なネットワークエラーは次のポーリングで回復 */
      }
      if (deadlineRef.current && Date.now() >= deadlineRef.current) {
        if (autoRetriesRef.current > 0) {
          // 自動再生成: もう一度キックして待機時間を延長
          autoRetriesRef.current -= 1;
          deadlineRef.current = Date.now() + TIMEOUT_MS;
          void kickGeneration(false);
        } else {
          stopPolling();
          setState("timeout");
        }
      }
    }, POLL_INTERVAL_MS);
  }, [router, stopPolling, kickGeneration]);

  // 新規の生成ドライブ開始(自動再生成カウンタをリセット)。
  const drive = useCallback(
    (force: boolean) => {
      autoRetriesRef.current = MAX_AUTO_RETRIES;
      void kickGeneration(force);
      startPending();
    },
    [kickGeneration, startPending],
  );

  // 初期状態が pending の場合、マウント時に生成をドライブ
  useEffect(() => {
    if (initialState === "pending") {
      drive(false);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaved = useCallback(() => drive(false), [drive]);
  // 手動リトライはサーバの上限を超えて再試行するため force=true
  const handleRetry = useCallback(() => drive(true), [drive]);

  if (state === "no_birth") {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-12">
        <h1 className="mb-2 text-2xl font-black">あなたの設計図を描くために</h1>
        <p className="mb-6 text-sm text-gray-600">
          生まれた日を教えてください。ホロスコープ（出生図）の計算にのみ使用します。
        </p>
        <BirthProfileForm required onSaved={handleSaved} />
      </main>
    );
  }

  if (state === "timeout") {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-12 text-center">
        <h1 className="mb-4 text-2xl font-black">あなたの運命の設計図</h1>
        <p className="mb-6 text-gray-700">
          鑑定の生成に時間がかかっています。少し時間をおいて、もう一度お試しください。
        </p>
        <button
          onClick={handleRetry}
          className="rounded-full bg-[#5B5BEF] px-6 py-3 font-bold text-white"
        >
          再度試す
        </button>
      </main>
    );
  }

  // pending / ready(refresh 待ち)
  return (
    <main className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-16 text-center">
      <h1 className="mb-4 text-2xl font-black">あなたの運命の設計図</h1>
      <p className="mb-8 text-gray-700">鑑定を生成しています。しばらくお待ちください。</p>
      <div className="h-24 w-24 animate-spin rounded-full border-4 border-gray-200 border-t-[#5B5BEF]" />
    </main>
  );
}
