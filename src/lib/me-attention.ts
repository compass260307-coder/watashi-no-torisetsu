// 友達診断に回答してくれた「まだ自己診断していない人」を自己診断へ誘うための
// localStorage キー。評価送信後ページ (/evaluate/sent = FriendIndividualGuide) 到達時に
// MeAttentionOnGuide が付与し、下部ナビ「自己診断」タブに赤バッジを出す。
// 解除は BottomNav が担う: タブをタップ / /diagnosis 到達 / 診断完了 (owner_token 出現)。
// 対象が未診断者のため owner_token では鍵れず、単純フラグ ("1") にする。
export const ME_ATTENTION_PENDING_KEY = "wt_me_attention_pending_v1";

// 付与を BottomNav が同一ページ内で拾うための通知イベント (tako バッジの
// TAKO_ATTENTION_GRANTED_EVENT と同じ流儀)。BottomNav の再評価契機が
// pathname 変化だけだと、付与前に判定が走ったきりになり滞在中バッジが出ない。
export const ME_ATTENTION_GRANTED_EVENT = "wt_me_attention_granted_v1";
