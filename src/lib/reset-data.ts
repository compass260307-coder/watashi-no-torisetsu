// 「データをリセット」で消すストレージキー (診断フロー関連) を一元管理する。
// SP ハンバーガーメニュー (TopHeader) と 自己診断結果ページ (/me) の両方から使う。
// 対象外: torisetsu_admin_key (管理者用) / wt_acq_* (first-touch 流入元。リセットで
// 診断をやり直しても「最初にどこから来たか」は変えない)。
export const RESET_KEYS = [
  "torisetsu_owner_token",
  "torisetsu_result",
  "torisetsu_result_ko",
  "torisetsu_invite_code",
  "torisetsu_preview",
  // 計測セッション (track.ts)。"torisetsu_session" は旧キーの掃除用に残す。
  "torisetsu_session",
  "torisetsu_session_v2",
  // 診断の途中保存とニックネーム (i18n/diagnosis.ts の progressStorageKey 等)
  "torisetsu_answers_v2",
  "torisetsu_answers_v2_ko",
  "torisetsu_nickname_v2",
  "torisetsu_nickname_v2_ko",
] as const;

// sessionStorage 側のキー。プレビューモードと diagnosis_started の dedup フラグは
// sessionStorage に保存されるため、localStorage と別に消す必要がある。
export const SESSION_RESET_KEYS = [
  "torisetsu_preview",
  "torisetsu_diag_started",
  "torisetsu_diag_started_ko",
] as const;

// 診断データを消して最初からやり直す。消えたことが伝わるようトップへ遷移して再読込。
export function resetLocalData() {
  try {
    RESET_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage 不可環境: 何もしない。
  }
  try {
    SESSION_RESET_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // sessionStorage 不可環境: 何もしない。
  }
  window.location.href = "/";
}
