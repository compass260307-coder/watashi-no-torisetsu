"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UnmeiBirthChat from "@/components/uranai/UnmeiBirthChat";
import type { ResultLocale } from "@/i18n/result";

type State = "no_birth" | "pending" | "timeout" | "ready";

type Props = {
  initialState: "no_birth" | "pending";
  // 未購入からの購入フロー: チャット内で 入力→決済→生成 を行う。
  // 未指定 (null) は従来の購入済み入力フロー。
  purchase?: {
    ownerToken: string | null;
    product: "full_access" | "premium_bundle";
  } | null;
  locale?: ResultLocale;
  ownerToken?: string | null;
  /** devプレビューでは保存・計測・決済を実行しない。 */
  previewMode?: boolean;
  /** 生成完了時の挙動の差し替え。/unmei 以外 (例: /me のオーバーレイ) に埋め込む場合、
   *  router.refresh() では鑑定表示に切り替わらないため、遷移をここで指定する。 */
  onReady?: () => void;
  /** /me モーダルではヘッダー右端に✕を重ねるため、装飾の✦を出さない。 */
  hideHeaderStars?: boolean;
  /** チャット冒頭挨拶の差し替え (/me はプロモカードの吹き出しを引き継ぐ)。 */
  intro?: readonly string[] | null;
};

const CLIENT_COPY = {
  ja: {
    title: "あなたの運命の設計図",
    timeout: "鑑定の生成に時間がかかっています。少し時間をおいて、もう一度お試しください。",
    retry: "再度試す",
    pending: "鑑定を生成しています。しばらくお待ちください。",
  },
  ko: {
    title: "나의 운명 설계도",
    timeout: "설계도 생성에 시간이 걸리고 있어요. 잠시 후 다시 시도해 주세요.",
    retry: "다시 시도하기",
    pending: "태어난 순간의 하늘과 성격 진단을 함께 읽고 있어요. 잠시만 기다려 주세요.",
  },
} as const;

// 生成完了までのタイムアウト (指示書④: 無限スピナー禁止・60秒で再試行案内)
const TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;
// 60秒で完了しなかった場合、手動リトライ案内を出す前に自動で再生成を試みる回数。
// (サーバ側の生成試行上限とは別の、クライアント発の再キック。上限超過はサーバが 'failed' で止める)
const MAX_AUTO_RETRIES = 2;

export default function UnmeiClient({
  initialState,
  purchase = null,
  locale = "ja",
  ownerToken = null,
  previewMode = false,
  onReady,
  hideHeaderStars = false,
  intro = null,
}: Props) {
  const router = useRouter();
  const copy = CLIENT_COPY[locale];
  const purchaseOwnerToken = purchase?.ownerToken ?? null;
  const [state, setState] = useState<State>(initialState);
  // チャット経由で保存した直後は、生成待ちもチャット画面のまま見せる
  // (別画面のスピナーに切り替えず、会話の続きとして待たせる)。
  const [viaChat, setViaChat] = useState(false);
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
      const localeOwnerToken = purchaseOwnerToken ?? ownerToken;
      if (locale === "ko" && localeOwnerToken) {
        const preference = await fetch("/api/account/preferred-locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerToken: localeOwnerToken, locale }),
        });
        if (!preference.ok) return;
      }
      await fetch("/api/unmei/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
    } catch {
      /* ポーリング側で回復可能なので握りつぶす */
    }
  }, [locale, ownerToken, purchaseOwnerToken]);

  // 60秒で MAX_AUTO_RETRIES まで自動再生成、尽きたら手動案内。
  const startPolling = useCallback(() => {
    stopPolling();
    deadlineRef.current = Date.now() + TIMEOUT_MS;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/unmei/status", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          if (j?.state === "ready") {
            stopPolling();
            setState("ready");
            if (onReady) onReady();
            else router.refresh(); // サーバコンポーネントを再描画して鑑定を表示
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
  }, [router, stopPolling, kickGeneration, onReady]);

  const startPending = useCallback(() => {
    setState("pending");
    startPolling();
  }, [startPolling]);

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
      autoRetriesRef.current = MAX_AUTO_RETRIES;
      void kickGeneration(false);
      startPolling();
    }
    return () => stopPolling();
  }, [initialState, kickGeneration, startPolling, stopPolling]);

  const handleSaved = useCallback(() => {
    setViaChat(true);
    drive(false);
  }, [drive]);
  // 手動リトライはサーバの上限を超えて再試行するため force=true
  const handleRetry = useCallback(() => drive(true), [drive]);

  // no_birth はチャット入力。保存後 (viaChat) は pending/ready になっても
  // チャットを表示し続け、waiting バブルで生成完了 (router.refresh) を待つ。
  // 同じ位置・同じコンポーネントを返し続けることで会話ログの state を保つ。
  if (
    state === "no_birth" ||
    (viaChat && (state === "pending" || state === "ready"))
  ) {
    return (
      <UnmeiBirthChat
        onSaved={handleSaved}
        waiting={state !== "no_birth"}
        mode={purchase ? "purchase" : "input"}
        ownerToken={purchaseOwnerToken ?? ownerToken}
        purchaseProduct={purchase?.product}
        locale={locale}
        previewMode={previewMode}
        hideHeaderStars={hideHeaderStars}
        intro={intro}
      />
    );
  }

  if (state === "timeout") {
    return (
      <main className="mx-auto max-w-[640px] px-6 py-12 text-center">
        <h1 className="mb-4 text-2xl font-black">{copy.title}</h1>
        <p className="mb-6 text-gray-700">
          {copy.timeout}
        </p>
        <button
          onClick={handleRetry}
          className="rounded-full bg-[#5B5BEF] px-6 py-3 font-bold text-white"
        >
          {copy.retry}
        </button>
      </main>
    );
  }

  // pending / ready(refresh 待ち)
  return (
    <main className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-16 text-center">
      <h1 className="mb-4 text-2xl font-black">{copy.title}</h1>
      <p className="mb-8 text-gray-700">{copy.pending}</p>
      <div className="h-24 w-24 animate-spin rounded-full border-4 border-gray-200 border-t-[#5B5BEF]" />
    </main>
  );
}
