// PR3: ページ内のロック要素を押したとき、最下部の課金案内カード
// (FullAccessPromoCard, id="fullaccess-promo") へスムーズスクロールし、
// 着地を分かりやすくするため 1 回だけパルス(ハイライト)を付ける。
//
// ページ遷移・URL 変更はしない。同一ページ内のスクロール移動のみ。
// パルスの見た目は globals.css の .paywall-pulse (prefers-reduced-motion で無効)。
//
// ブラウザ専用 (onClick 等のイベントハンドラから呼ぶ前提)。SSR 側で呼ばれても no-op。

const PAYWALL_ID = "fullaccess-promo";
const PULSE_CLASS = "paywall-pulse";
const PULSE_MS = 1300;

export function scrollToPaywall(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(PAYWALL_ID);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // 再トリガー時にアニメを確実に再生させるため一旦外してから付け直す。
  el.classList.remove(PULSE_CLASS);
  // reflow を挟んで add (連打でもパルスが復活する)
  void el.offsetWidth;
  el.classList.add(PULSE_CLASS);
  window.setTimeout(() => el.classList.remove(PULSE_CLASS), PULSE_MS);
}
