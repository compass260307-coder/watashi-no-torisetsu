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
