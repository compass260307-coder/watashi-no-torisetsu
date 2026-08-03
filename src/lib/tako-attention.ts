// 自己診断完了後、下部ナビの「友達診断」を一度だけ目立たせるための
// localStorage キー。owner_token を値にして、再診断で別ユーザー行が作られても
// 以前の確認状態を引き継がない。
export const TAKO_ATTENTION_PENDING_KEY =
  "wt_tako_attention_pending_owner_v1";

const TAKO_ATTENTION_IMPRESSION_PREFIX =
  "wt_tako_attention_impression_v1:";

export function takoAttentionImpressionKey(ownerToken: string): string {
  return `${TAKO_ATTENTION_IMPRESSION_PREFIX}${ownerToken}`;
}

// 課金 (full_access) 後にバッジを1回だけ付与するためのマーカー。
// 2026-07-20 変更: バッジは「自己診断完了時」ではなく「課金完了後」に出す。
const TAKO_ATTENTION_PAID_GRANTED_PREFIX =
  "wt_tako_attention_paid_granted_v1:";

export function takoAttentionPaidGrantedKey(ownerToken: string): string {
  return `${TAKO_ATTENTION_PAID_GRANTED_PREFIX}${ownerToken}`;
}

// /me 滞在中に付与されたバッジを BottomNav が同一ページ内で拾うための通知イベント。
// BottomNav の再評価契機が pathname 変化だけだと、/me/[token] の loading.tsx が
// コミットされた時点 (= 付与前) に判定が走ったきりになり、/me を読んでいる間
// バッジが一度も出ない (2026-08-04 修正。バッジ表示率 37.5% の原因)。
export const TAKO_ATTENTION_GRANTED_EVENT = "wt_tako_attention_granted_v1";
