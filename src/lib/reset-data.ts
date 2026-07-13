// 「データをリセット」で消す localStorage キー (診断フロー関連) を一元管理する。
// SP ハンバーガーメニュー (TopHeader) と 自己診断結果ページ (/me) の両方から使う。
// admin_key は管理者用のため対象外にする。
export const RESET_KEYS = [
  "torisetsu_owner_token",
  "torisetsu_result",
  "torisetsu_invite_code",
  "torisetsu_preview",
  "torisetsu_session",
] as const;

// 診断データを消して最初からやり直す。消えたことが伝わるようトップへ遷移して再読込。
export function resetLocalData() {
  try {
    RESET_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage 不可環境: 何もしない。
  }
  window.location.href = "/";
}
