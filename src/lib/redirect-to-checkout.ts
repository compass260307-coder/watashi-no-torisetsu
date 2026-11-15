/**
 * Stripe Checkout Session の URL を受け取ったら即座に遷移する。
 *
 * 広告タグの eventCallback を待ってから遷移する実装は、GTM が未読込・ブロック・
 * 処理遅延のとき遷移を最大 1.1 秒止めていた。遷移前に完了を待つ計測をここへ
 * 戻さないこと (購入系の計測はサーバーの checkout_requested / 購入完了ページ側で行う)。
 */
export function redirectToFullAccessCheckout(checkoutUrl: string): void {
  window.location.assign(checkoutUrl);
}
