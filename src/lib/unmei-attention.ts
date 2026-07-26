// 課金 (full_access) 後、下部ナビの「運命」タブを一度だけ目立たせるための
// localStorage キー。友達診断の tako-attention と同じ流儀:
// owner_token を値にして、再診断で別ユーザー行が作られても以前の確認状態を
// 引き継がない。/unmei を見たら解除し、再表示はしない。
export const UNMEI_ATTENTION_PENDING_KEY =
  "wt_unmei_attention_pending_owner_v1";

const UNMEI_ATTENTION_IMPRESSION_PREFIX =
  "wt_unmei_attention_impression_v1:";

export function unmeiAttentionImpressionKey(ownerToken: string): string {
  return `${UNMEI_ATTENTION_IMPRESSION_PREFIX}${ownerToken}`;
}

// 課金 (full_access) 後にバッジを1回だけ付与するためのマーカー。
// 友達診断バッジと同時に「課金済みの /me 表示」で付与する (2026-07-27 指示)。
const UNMEI_ATTENTION_PAID_GRANTED_PREFIX =
  "wt_unmei_attention_paid_granted_v1:";

export function unmeiAttentionPaidGrantedKey(ownerToken: string): string {
  return `${UNMEI_ATTENTION_PAID_GRANTED_PREFIX}${ownerToken}`;
}
