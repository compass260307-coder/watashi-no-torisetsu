// 診断の最後に任意で聞く「性別」「年代」。
// 画面 (DiagnosisPageContent) が送る値と、保存 API が受け取る値をここでそろえる。
// 保存先は user_demographics (supabase/migrations/20261125220000_user_demographics.sql)。

export const PROFILE_GENDERS = ["male", "female", "other"] as const;
export type ProfileGender = (typeof PROFILE_GENDERS)[number];

export const PROFILE_AGE_GROUPS = [
  "10s",
  "20s_early",
  "20s_late",
  "30s",
  "40s",
  "50s_plus",
] as const;
export type ProfileAgeGroup = (typeof PROFILE_AGE_GROUPS)[number];

// 決めた選択肢以外 (古い画面の値・書き換えられた値) は保存しない。
export function normalizeProfileGender(value: unknown): ProfileGender | null {
  return PROFILE_GENDERS.includes(value as ProfileGender)
    ? (value as ProfileGender)
    : null;
}

export function normalizeProfileAgeGroup(value: unknown): ProfileAgeGroup | null {
  return PROFILE_AGE_GROUPS.includes(value as ProfileAgeGroup)
    ? (value as ProfileAgeGroup)
    : null;
}
