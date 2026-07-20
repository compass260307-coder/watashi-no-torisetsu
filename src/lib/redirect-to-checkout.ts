const GTM_EVENT_TIMEOUT_MS = 1_000;
const FALLBACK_REDIRECT_DELAY_MS = GTM_EVENT_TIMEOUT_MS + 100;

type DataLayerEvent = Record<string, unknown>;

type WindowWithDataLayer = Window & {
  dataLayer?: DataLayerEvent[];
};

/**
 * Stripe Checkout Session の作成後だけ、GTM の開始イベントを送ってから遷移する。
 *
 * GTM が未読込・ブロック・設定不備でも購入導線を止めないよう、GTM の
 * eventTimeout とは別にブラウザ側のフォールバックも持つ。
 */
export function redirectToFullAccessCheckout(checkoutUrl: string): void {
  let hasRedirected = false;

  const redirect = () => {
    if (hasRedirected) return;
    hasRedirected = true;

    window.clearTimeout(fallbackTimer);
    window.location.assign(checkoutUrl);
  };

  // dataLayer が GTM に処理されない場合も、購入者を待たせ続けない。
  const fallbackTimer = window.setTimeout(
    redirect,
    FALLBACK_REDIRECT_DELAY_MS,
  );

  try {
    const target = window as WindowWithDataLayer;
    target.dataLayer = target.dataLayer ?? [];
    target.dataLayer.push({
      event: "meta_initiate_checkout",
      value: 499,
      currency: "JPY",
      eventCallback: redirect,
      eventTimeout: GTM_EVENT_TIMEOUT_MS,
    });
  } catch {
    // 計測エラーで Stripe Checkout への遷移自体は止めない。
    redirect();
  }
}
