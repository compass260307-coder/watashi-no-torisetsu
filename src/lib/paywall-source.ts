// 課金導線の設置場所ID。クライアントから Stripe Webhook まで同じ値を引き継ぎ、
// 「どのロックカードから決済したか」を計測集計で判別する。
//
// クライアント入力をそのまま Stripe metadata に入れないため、現行の設置場所だけを
// allowlist にする。新しい課金導線を追加したときはここにも追記する。

export const DIRECT_PAYWALL_SOURCE = "paywall_direct";
export const FRIEND_INDIVIDUAL_PAYWALL_SOURCE = "friend_individual_paywall";

export const TAKO_PAYWALL_SOURCES = new Set([
  "tako_lock",
  "tako_mote_card",
  "tako_hints_card",
  "tako_kotsu_card",
  "tako_wana_card",
  "tako_johari_card",
  "tako_numa_card",
  "tako_loss_card",
  "tako_kirai_card",
  "tako_kotsu_wana_card",
  // 2人目以降の友達シート全ロック (1人目無料モデル 2026-07-28)
  "tako_sheet_lock",
  "tako_unlocked",
  "tako_promo_card",
]);

const PAYWALL_SOURCES = new Set([
  DIRECT_PAYWALL_SOURCE,
  FRIEND_INDIVIDUAL_PAYWALL_SOURCE,
  "love_payoff_card",
  "love_failure_card",
  "career_fit_card",
  "career_avoid_card",
  "career_relations_card",
  "career_talent_card",
  "deepdive_card",
  "scene_caution_card",
  "moshimo_card",
  "friend_dislike_card",
  "relations_card",
  "sticky_bar",
  "friend_list",
  "aisho_scene",
  // 下部ナビのロック中「相性」タブ → 課金カードモーダル (2026-07-28)
  "nav_aisho_locked",
  // 星読みの案内人で、未購入ユーザーが最初の相談を送信したとき。
  "hoshiyomi_first_send",
  // 下部ナビのロック中「Alice」からコース選択を開いた導線。
  "nav_locked_hoshiyomi",
  // 運命の設計図LPのヒーローCTAから出生情報チャットを開く導線。
  "unmei_hero",
  // 出生情報を保存した後に表示する、運命チャット内のプレミアムカード。
  "unmei_birth_chat",
  // 下部ナビのロック中「運命」からコース選択を開いた導線。
  "nav_locked_unmei",
  // 下部ナビのロック中「タロット」から課金カードを開いた導線。
  "nav_locked_tarot",
  ...TAKO_PAYWALL_SOURCES,
]);

export function normalizePaywallSource(value: unknown): string {
  return typeof value === "string" && PAYWALL_SOURCES.has(value)
    ? value
    : DIRECT_PAYWALL_SOURCE;
}
