"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UnmeiBirthChat from "@/components/uranai/UnmeiBirthChat";
import type { AppResultLocale } from "@/i18n/result";
import { isTerminalPollResponse, startVisiblePolling } from "@/lib/visible-polling";

type State = "no_birth" | "pending" | "timeout" | "ready";

type Props = {
  initialState: "no_birth" | "pending";
  // 未購入からの購入フロー: チャット内で 入力→決済→生成 を行う。
  // 未指定 (null) は従来の購入済み入力フロー。
  purchase?: {
    ownerToken: string | null;
    product: "full_access" | "premium_bundle";
  } | null;
  locale?: AppResultLocale;
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
  en: {
    title: "Your Destiny Blueprint",
    timeout: "Your reading is taking longer than expected. Please wait a moment and try again.",
    retry: "Try again",
    pending: "I’m combining your personality with the sky at your birth. Please wait a moment.",
  },
  id: {
    title: "Peta Takdirmu",
    timeout: "Pembacaanmu memerlukan waktu lebih lama dari perkiraan. Tunggu sebentar lalu coba lagi.",
    retry: "Coba lagi",
    pending: "Aku sedang menggabungkan kepribadianmu dengan langit saat kamu lahir. Tunggu sebentar.",
  },
} as const;

// 生成完了までのタイムアウト (指示書④: 無限スピナー禁止・60秒で再試行案内)
const TIMEOUT_MS = 60_000;
// ポーリングは 3 秒から始めて徐々に間隔を広げる (×1.4、上限 8 秒)。
// 生成は数十秒かかることが多く、固定 3 秒間隔だと 1 回の生成で 20 回の
// Function 呼び出しになるため、後半を疎にして呼び出し回数を約半分に抑える。
const INITIAL_POLL_INTERVAL_MS = 3_000;
const POLL_BACKOFF_FACTOR = 1.4;
const MAX_POLL_INTERVAL_MS = 8_000;
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
  const pollRef = useRef<(() => void) | null>(null);
  const autoRetriesRef = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      pollRef.current();
      pollRef.current = null;
    }
  }, []);

  // 生成をキック。force=true はサーバ側の自動再生成上限を超えた手動リトライ。
  const kickGeneration = useCallback(async (force: boolean, signal: AbortSignal) => {
    try {
      const localeOwnerToken = purchaseOwnerToken ?? ownerToken;
      if (locale !== "ja" && localeOwnerToken) {
        const preference = await fetch("/api/account/preferred-locale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ownerToken: localeOwnerToken, locale }),
          signal,
        });
        if (signal.aborted || !preference.ok) return false;
      }
      const response = await fetch("/api/unmei/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force, locale }),
        signal,
      });
      return !signal.aborted && !isTerminalPollResponse(response);
    } catch {
      // 開始要求が届いている可能性があるので、再送せずstatusで確認する。
      return !signal.aborted;
    }
  }, [locale, ownerToken, purchaseOwnerToken]);

  // Visible, serial checks. Each run owns its AbortSignal so a replaced run
  // cannot update the UI, re-kick generation, or schedule another timer.
  const startPolling = useCallback((force = false) => {
    stopPolling();
    let kicked = false;
    let failures = 0;
    let retryGraceUntil = 0;
    let delay = INITIAL_POLL_INTERVAL_MS;
    pollRef.current = startVisiblePolling(async (signal) => {
      if (!kicked) {
        kicked = true;
        deadlineRef.current = Date.now() + TIMEOUT_MS;
        const started = await kickGeneration(force, signal);
        if (signal.aborted) return false;
        if (!started) {
          setState("timeout");
          return false;
        }
        if (force) retryGraceUntil = Date.now() + 10_000;
        delay = Math.round(delay * POLL_BACKOFF_FACTOR);
        return INITIAL_POLL_INTERVAL_MS;
      }
      try {
        const res = await fetch(`/api/unmei/status?locale=${locale}`, {
          cache: "no-store",
          signal,
        });
        if (signal.aborted) return false;
        if (isTerminalPollResponse(res)) {
          setState("timeout");
          return false;
        }
        if (!res.ok) throw new Error("Status unavailable");
        const j = await res.json();
        if (signal.aborted) return false;
        failures = 0;
        if (j?.state === "pending") retryGraceUntil = 0;
        if (j?.state === "ready") {
          setState("ready");
          if (onReady) onReady();
          else router.refresh();
          return false;
        }
        if (j?.state === "no_birth") {
          setState("no_birth");
          return false;
        }
        if ((j?.state === "failed" && Date.now() >= retryGraceUntil) || j?.state === "unpurchased") {
          setState("timeout");
          return false;
        }
      } catch {
        if (signal.aborted) return false;
        failures += 1;
      }
      if (failures >= 5) {
        setState("timeout");
        return false;
      }
      if (document.hidden) return delay;
      if (deadlineRef.current && Date.now() >= deadlineRef.current) {
        if (autoRetriesRef.current > 0) {
          autoRetriesRef.current -= 1;
          deadlineRef.current = Date.now() + TIMEOUT_MS;
          delay = INITIAL_POLL_INTERVAL_MS;
          const started = await kickGeneration(false, signal);
          if (signal.aborted) return false;
          if (!started) {
            setState("timeout");
            return false;
          }
        } else {
          setState("timeout");
          return false;
        }
      }
      const nextDelay = delay;
      delay = Math.min(Math.round(delay * POLL_BACKOFF_FACTOR), MAX_POLL_INTERVAL_MS);
      return nextDelay;
    });
  }, [locale, router, stopPolling, kickGeneration, onReady]);

  const drive = useCallback((force: boolean) => {
    autoRetriesRef.current = MAX_AUTO_RETRIES;
    setState("pending");
    startPolling(force);
  }, [startPolling]);

  useEffect(() => {
    if (initialState === "pending") {
      autoRetriesRef.current = MAX_AUTO_RETRIES;
      startPolling();
    }
    return stopPolling;
  }, [initialState, startPolling, stopPolling]);

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
