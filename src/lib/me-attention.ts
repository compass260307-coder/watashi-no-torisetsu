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

// 評価者→自己診断のバイラル帰属 (users.source_user_id) を、URL の ?source= が
// 失われる導線でも維持するための保存キー。評価送信後ページで親の invite_code を
// 保存し、診断完了の送信時に URL パラメータが無ければフォールバックとして使う。
//   - 下部ナビ赤バッジの遷移先は素の /diagnosis のため URL では帰属できない
//   - 50問を中断して素の /diagnosis から再開しても URL の source は戻らない
// 期限を切るのは、後日の無関係な診断まで親に帰属させないため。
export const ME_PENDING_SOURCE_KEY = "wt_me_pending_source_v1";
const PENDING_SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function savePendingSourceCode(code: string) {
  try {
    localStorage.setItem(
      ME_PENDING_SOURCE_KEY,
      JSON.stringify({ code, at: Date.now() }),
    );
  } catch {
    // localStorage 不可環境では帰属なし (実害なし)
  }
}

export function readPendingSourceCode(): string | null {
  try {
    const raw = localStorage.getItem(ME_PENDING_SOURCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (
      typeof parsed.code === "string" &&
      parsed.code &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at <= PENDING_SOURCE_TTL_MS
    ) {
      return parsed.code;
    }
    localStorage.removeItem(ME_PENDING_SOURCE_KEY);
    return null;
  } catch {
    return null;
  }
}

export function clearPendingSourceCode() {
  try {
    localStorage.removeItem(ME_PENDING_SOURCE_KEY);
  } catch {
    // 無視
  }
}
