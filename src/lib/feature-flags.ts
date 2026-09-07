// feature flag utilities

/**
 * 32タイプは日韓とも正式公開済み。
 * 環境変数の設定漏れで片方だけ16タイプへ戻らないよう、常時有効にする。
 */
export function isThirtyTwoEnabled(): boolean {
  return true;
}

export type PaywallCardMode = "legacy" | "three-course";

/**
 * 自己診断・友達診断・相性で表示する課金カード。
 *
 * - legacy（未設定時）: 現行カード（日本語・韓国語とも同じ構成）
 * - three-course: 比較用のプランカード（開発確認用）
 *
 * 本番は常に旧カードデザイン。開発環境だけ環境変数で
 * 比較用カードへ切り替えられる。
 */
export function paywallCardMode(): PaywallCardMode {
  return process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_PAYWALL_CARD_MODE === "three-course"
    ? "three-course"
    : "legacy";
}
