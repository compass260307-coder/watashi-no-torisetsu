// feature flag utilities
//
// 厳格 string 比較 ("true" のみ true、それ以外は false) で、
// 想定外の値 ("True" / "TRUE" / "1" 等) はすべて OFF 扱いとする (fail-safe)。

/**
 * 32 タイプ本文 (N 軸差分) が有効か。
 *
 * off (未設定/false): 従来 16 タイプ表示のまま。
 * on (true): /me の自己診断本文を 32 タイプで出し分ける。
 */
export function isThirtyTwoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_THIRTYTWO_ENABLED === "true";
}

export type PaywallCardMode = "legacy" | "three-course";

/**
 * 自己診断・友達診断・相性で表示する課金カード。
 *
 * - legacy（未設定時）: 3コース化以前の単一カード
 * - three-course: お試し・完全版・プレミアムの松竹梅カード
 *
 * NEXT_PUBLIC_PAYWALL_CARD_MODE=three-course にして再ビルドすれば、
 * コンポーネントを変更せず松竹梅へ戻せる。
 */
export function paywallCardMode(): PaywallCardMode {
  return process.env.NEXT_PUBLIC_PAYWALL_CARD_MODE === "three-course"
    ? "three-course"
    : "legacy";
}
