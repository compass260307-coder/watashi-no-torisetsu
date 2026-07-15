// 課金導線の設置場所ID。クライアントから Stripe Webhook まで同じ値を引き継ぎ、
// 「どのロックカードから決済したか」を管理画面で集計する。
//
// クライアント入力をそのまま Stripe metadata に入れないため、現行の設置場所だけを
// allowlist にする。新しい課金導線を追加したときはここにも追記する。

export const DIRECT_PAYWALL_SOURCE = "paywall_direct";

const PAYWALL_SOURCES = new Set([
  DIRECT_PAYWALL_SOURCE,
  "love_payoff_card",
  "love_failure_card",
  "career_fit_card",
  "career_talent_card",
  "deepdive_card",
  "scene_caution_card",
  "friend_dislike_card",
  "relations_card",
  "sticky_bar",
  "friend_list",
  "aisho_scene",
]);

export function normalizePaywallSource(value: unknown): string {
  return typeof value === "string" && PAYWALL_SOURCES.has(value)
    ? value
    : DIRECT_PAYWALL_SOURCE;
}
