// トップページで答えた1問目を、診断ページへ引き継ぐための一時保存。
// sessionStorage に1回分だけ置き、診断ページが読んだら消す (再訪で勝手に復元しない)。
import type { AnswerValue } from "@/lib/types";

const KEY = "wt_first_answer_v1";
// 置いてからこの時間を過ぎたものは使わない (放置したタブで古い回答が入らないように)。
const MAX_AGE_MS = 10 * 60 * 1000;

export interface FirstAnswerHandoff {
  questionSet: string;
  questionId: number;
  answer: AnswerValue;
}

export function saveFirstAnswerHandoff(handoff: FirstAnswerHandoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...handoff, at: Date.now() }));
  } catch {
    // 保存できなくても診断ページへは進める (1問目から答え直しになるだけ)。
  }
}

export function takeFirstAnswerHandoff(): FirstAnswerHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as Partial<FirstAnswerHandoff> & { at?: number };
    if (
      typeof parsed.questionSet !== "string" ||
      !Number.isInteger(parsed.questionId) ||
      !Number.isInteger(parsed.answer) ||
      (parsed.answer as number) < 1 ||
      (parsed.answer as number) > 7 ||
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > MAX_AGE_MS
    ) {
      return null;
    }
    return {
      questionSet: parsed.questionSet,
      questionId: parsed.questionId as number,
      answer: parsed.answer as AnswerValue,
    };
  } catch {
    return null;
  }
}

// ===== トップ → 診断ページの画面つなぎ =====
// トップの小窓で答えた質問カードを、ページ移動をまたいで画面に残すための幕。
// React の外 (body 直下) に置くので、ページが切り替わっても消えない。
//   1. 答えた瞬間: カードの写しをその場に置き、背景を白くしながら画面の横幅いっぱいへ広げる
//      (診断ページの質問と同じ見た目に近づける)。
//   2. 診断ページ側: 同じ質問が幕の質問とぴったり重なる位置へスクロールしてから、幕をふわっと消す。
// 見ている人には、答えた質問がその場に残ったまま、まわりが診断ページに変わったように見える。
const VEIL_ID = "wt-first-answer-veil";
const VEIL_IN_MS = 340;
const VEIL_OUT_MS = 400;
// ページ移動に失敗しても幕が残り続けないようにする保険。
const VEIL_MAX_MS = 6000;

/** 幕を出し終わるまでの時間 (この後にページを移動する)。 */
export const FIRST_ANSWER_VEIL_IN_MS = VEIL_IN_MS;

export function startFirstAnswerVeil(card: HTMLElement): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    document.getElementById(VEIL_ID)?.remove();
    const rect = card.getBoundingClientRect();
    const veil = document.createElement("div");
    veil.id = VEIL_ID;
    veil.setAttribute("aria-hidden", "true");
    veil.style.cssText =
      `position:fixed;inset:0;z-index:2000;background:rgba(255,255,255,0);` +
      `transition:background-color ${VEIL_IN_MS}ms ease, opacity ${VEIL_OUT_MS}ms ease;`;
    const copy = card.cloneNode(true) as HTMLElement;
    copy.style.cssText =
      `position:fixed;margin:0;max-width:none;box-sizing:border-box;` +
      `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;` +
      `transition:left ${VEIL_IN_MS}ms ease, width ${VEIL_IN_MS}ms ease, padding ${VEIL_IN_MS}ms ease,` +
      ` border-radius ${VEIL_IN_MS}ms ease, box-shadow ${VEIL_IN_MS}ms ease;`;
    veil.appendChild(copy);
    document.body.appendChild(veil);
    // 置いた直後の見た目を確定させてから、広げる先の見た目へ動かす。
    void copy.offsetWidth;
    veil.style.background = "rgba(255,255,255,1)";
    copy.style.left = "0px";
    copy.style.width = "100vw";
    // 診断ページの質問カードと同じ左右の余白にする
    // (スマホは 16px。PC は最大幅 1080px を中央に置き、その内側に 32px)。
    const viewport = document.documentElement.clientWidth;
    const side = viewport >= 768 ? Math.max(32, (viewport - 1080) / 2 + 32) : 16;
    copy.style.paddingLeft = `${side}px`;
    copy.style.paddingRight = `${side}px`;
    copy.style.borderRadius = "0px";
    copy.style.boxShadow = "none";
    // 質問文と○の間隔も、診断ページの質問カード (mb-7 = 28px) にそろえる。
    const text = copy.querySelector<HTMLElement>(".top-question-text");
    if (text) {
      text.style.transition = `margin-bottom ${VEIL_IN_MS}ms ease`;
      text.style.marginBottom = "28px";
    }
    window.setTimeout(() => endFirstAnswerVeil(), VEIL_MAX_MS);
    return true;
  } catch {
    return false;
  }
}

/** 幕に写している質問文の、画面上端からの位置。幕が無ければ null。 */
export function firstAnswerVeilQuestionTop(): number | null {
  const text = document.getElementById(VEIL_ID)?.querySelector(".top-question-text");
  return text ? text.getBoundingClientRect().top : null;
}

export function endFirstAnswerVeil(): void {
  const veil = document.getElementById(VEIL_ID);
  if (!veil || veil.dataset.leaving === "1") return;
  veil.dataset.leaving = "1";
  veil.style.pointerEvents = "none";
  veil.style.opacity = "0";
  window.setTimeout(() => veil.remove(), VEIL_OUT_MS + 40);
}
