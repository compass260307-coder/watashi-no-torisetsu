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

export default function UnmeiClient({ initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>(initialState);
  const deadlineRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // 生成をキック (fire-and-forget)。完了はポーリングで検知する。
  const kickGeneration = useCallback(async () => {
    try {
      await fetch("/api/unmei/generate", { method: "POST" });
    } catch {
      /* ポーリング側でリトライ可能なので握りつぶす */
    }
  }, []);

  // pending 状態のポーリング開始 (60秒でタイムアウト)
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
            // サーバコンポーネントを再描画して鑑定を表示
            router.refresh();
            return;
          }
          if (j?.state === "no_birth") {
            stopPolling();
            setState("no_birth");
            return;
          }
        }
      } catch {
        /* 一時的なネットワークエラーは次のポーリングで回復 */
      }
      if (deadlineRef.current && Date.now() >= deadlineRef.current) {
        stopPolling();
        setState("timeout");
      }
    }, POLL_INTERVAL_MS);
  }, [router, stopPolling]);

  // 初期状態が pending の場合、マウント時に一度生成をキックしてからポーリング
  useEffect(() => {
    if (initialState === "pending") {
      void kickGeneration();
      startPending();
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 出生データ保存後: 生成をキックして pending へ
  const handleSaved = useCallback(() => {
    void kickGeneration();
    startPending();
  }, [kickGeneration, startPending]);

  const handleRetry = useCallback(() => {
    void kickGeneration();
    startPending();
  }, [kickGeneration, startPending]);

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
