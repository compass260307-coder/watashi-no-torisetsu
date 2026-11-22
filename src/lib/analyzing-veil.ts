// 自己診断の解析待ち画面を、ページ移動をまたいで出し続けるための置き場。
//   これまでは、待ち時間が終わると解析待ち画面ごと結果ページへ切り替わり、ぱっと画面が変わっていた。
//   解析待ち画面をルートレイアウトの層 (AnalyzingVeilHost) に載せておくと、結果ページへ移動しても
//   画面は残る。結果ページが裏で用意できてから、ふわっと消して結果ページへつなぐ
//   (友達診断の「ようこそ」画面の終わり方と同じ)。
import type { ReactNode } from "react";

export type AnalyzingVeilState = {
  // 層に出す画面 (解析待ち画面)。null のときは何も出さない。
  node: ReactNode | null;
  // 消えていく途中か。
  leaving: boolean;
};

// 消えるのにかける時間。globals.css の friend-welcome-leave と同じ長さにする。
export const ANALYZING_VEIL_LEAVE_MS = 2000;

const EMPTY: AnalyzingVeilState = { node: null, leaving: false };
let state: AnalyzingVeilState = EMPTY;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: AnalyzingVeilState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeAnalyzingVeil(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAnalyzingVeil() {
  return state;
}

export function getServerAnalyzingVeil() {
  return EMPTY;
}

/** 解析待ち画面を層に出す。 */
export function showAnalyzingVeil(node: ReactNode) {
  clearTimeout(leaveTimer);
  set({ node, leaving: false });
}

/** すぐ消す (送信に失敗して質問へ戻るときなど)。 */
export function hideAnalyzingVeil() {
  clearTimeout(leaveTimer);
  if (state.node !== null) set(EMPTY);
}

/** ふわっと消し始める。消え終わったら片づける。 */
export function releaseAnalyzingVeil() {
  if (state.node === null || state.leaving) return;
  set({ node: state.node, leaving: true });
  leaveTimer = setTimeout(() => set(EMPTY), ANALYZING_VEIL_LEAVE_MS);
}
