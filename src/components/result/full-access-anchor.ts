// 課金導線の共通アンカー。ページ内に1つだけ置く最下部の課金カード
// (#full-access-card) の id と、そこへのスムーススクロール関数を集約する。
//
// 導線: 各コンテンツのロックCTA → scrollToFullAccessCard() で最下部カードへ移動
//       → 最下部カードの決済ボタン (FullAccessCta) で Stripe へ。
// 決済 (Stripe を叩く) は最下部カード1箇所に集約し、各所は「そこへ誘導」に徹する。

export const FULL_ACCESS_CARD_ID = "full-access-card";

/**
 * 最下部の課金カードへスムーススクロールする。<a href="#..."> の既定ジャンプを
 * 上書きしてアニメーション付きにする (要素が無ければ何もしない = ハッシュ遷移に委ねる)。
 */
export function scrollToFullAccessCard(
  e?: { preventDefault: () => void },
): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(FULL_ACCESS_CARD_ID);
  if (!el) return; // カード未マウント時はデフォルトのハッシュ遷移に任せる
  e?.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
