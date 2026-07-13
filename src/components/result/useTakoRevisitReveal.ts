"use client";

// 再訪リビール「◯人届いた！」の状態コーディネータ (追加機能②)。
//
// 真実 = サーバの回答者数 serverAnswered。クライアントは「既読 = 前回見た回答者数」だけを
// cookie に持つ (tako_ls)。サーバ状態は一切書き換えない。
//
// ★SSRフラッシュ対策 (Option A): 既読を cookie に置くことで、サーバが「旧状態」を初期HTMLとして
//   直接レンダリングできる。よって初期HTML自体が“演出の開始フレーム”になり、最終値(あと1・
//   スロット埋め・霧が晴れた奥)を演出前に見せてしまうことが原理的に起きない。
//   → このフックは「サーバが決めた初期表示 ssrInitialAnswered」を起点に、現在値へ動かすだけ。
//     初期 state = ssrInitialAnswered なので SSR HTML と一致 (ハイドレーション不整合なし)。
//
// 表示ロジック:
//   pending = serverAnswered > ssrInitialAnswered (= サーバが「増えた」と判定済み)。
//   pending かつ非reduced: 旧状態を少し見せてから現在値へバウンド減算 + スロット順次リビール。
//   pending かつ reduced: 即時に現在値へ (アニメ無し)。
//   非pending (初回/据え置き): 現在値のまま。いずれも最後に cookie 既読 = serverAnswered を書く。

import { useLayoutEffect, useRef, useState } from "react";

const REVEAL_DELAY_MS = 650; // 旧状態を見せてから減算に入るまで
const BANNER_HOLD_MS = 4200; // 「◯人届いた！」を出しておく時間
const COOKIE_NAME = "tako_ls";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1年

function writeCookie(scope: string, value: number, preview: boolean) {
  if (preview) return; // プレビューは既読を書かない (何度でも再現可能に)
  try {
    const payload = encodeURIComponent(JSON.stringify({ s: scope, n: value }));
    document.cookie = `${COOKIE_NAME}=${payload}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    /* cookie 書込不可は無視 (次回も演出しないだけ) */
  }
}

export interface RevisitReveal {
  /** いま画面に出す回答者数 (演出中は ssrInitial → server へ動く)。 */
  displayAnswered: number;
  /** 「◯人届いた！」バナー用。0 なら非表示。 */
  deliveredCount: number;
  /** 数字バウンドの再発火キー (増えるたびに1回バウンド)。 */
  bounceKey: number;
  /** 演出時の起点 (これ以上の index のスロットを順次ポップ)。 */
  revealFromIndex: number;
}

export function useTakoRevisitReveal({
  serverAnswered,
  ssrInitialAnswered,
  storageScope,
  previewMode,
}: {
  serverAnswered: number;
  /** サーバが cookie/preview から決めた初期表示値 (旧状態 or 現在値)。 */
  ssrInitialAnswered: number;
  /** cookie 既読をスコープするキー (通常は owner_token)。 */
  storageScope: string;
  /** プレビュー時 true: cookie を書かない。 */
  previewMode: boolean;
}): RevisitReveal {
  const [displayAnswered, setDisplayAnswered] = useState(ssrInitialAnswered);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [bounceKey, setBounceKey] = useState(0);
  const revealFromIndex = ssrInitialAnswered; // 起点は SSR が描いた旧状態の answered 数
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // set-state-in-effect の同期呼び出しは意図的 (SSR整合 & 演出制御)。カスケードは起きない。
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    clearTimers();

    const delta = serverAnswered - ssrInitialAnswered;

    // 非pending (初回/据え置き/減少): 現在値のまま既読を更新するだけ。
    if (delta <= 0) {
      setDisplayAnswered(serverAnswered);
      writeCookie(storageScope, serverAnswered, previewMode);
      return clearTimers;
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduced) {
      // 即時反映 + 静的バナーのみ。
      setDisplayAnswered(serverAnswered);
      setDeliveredCount(delta);
      writeCookie(storageScope, serverAnswered, previewMode);
      const t = setTimeout(() => setDeliveredCount(0), BANNER_HOLD_MS);
      timers.current.push(t);
      return clearTimers;
    }

    // 旧状態(=ssrInitial)は初期 state で既に描かれている。バナーを出し、少し見せてから減算。
    setDeliveredCount(delta);
    const tReveal = setTimeout(() => {
      setDisplayAnswered(serverAnswered);
      setBounceKey((k) => k + 1);
      writeCookie(storageScope, serverAnswered, previewMode); // 演出開始=既読更新 (二重発火防止)
    }, REVEAL_DELAY_MS);
    const tBanner = setTimeout(
      () => setDeliveredCount(0),
      REVEAL_DELAY_MS + BANNER_HOLD_MS,
    );
    timers.current.push(tReveal, tBanner);
    return clearTimers;
  }, [serverAnswered, ssrInitialAnswered, storageScope, previewMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { displayAnswered, deliveredCount, bounceKey, revealFromIndex };
}
