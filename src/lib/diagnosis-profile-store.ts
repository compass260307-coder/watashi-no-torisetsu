import { supabaseAdmin } from "@/lib/supabase-server";
import type { ProfileAgeGroup, ProfileGender } from "@/lib/diagnosis-profile";

// 診断の最後に任意で選んだ性別・年代を user_demographics に残す。
// 集計のための付随データなので、失敗しても診断の保存は止めない (呼び出し側は結果を待つだけ)。
// 選ばなかった項目は送らないので、再診断で未選択でも前の値は消えない。
export async function saveUserDemographics(
  userId: string,
  profile: { gender: ProfileGender | null; ageGroup: ProfileAgeGroup | null },
): Promise<void> {
  if (!profile.gender && !profile.ageGroup) return;
  try {
    const { error } = await supabaseAdmin.from("user_demographics").upsert(
      {
        user_id: userId,
        ...(profile.gender ? { gender: profile.gender } : {}),
        ...(profile.ageGroup ? { age_group: profile.ageGroup } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.error("[diagnosis] user_demographics save failed:", error.code, error.message);
    }
  } catch (err) {
    console.error("[diagnosis] user_demographics save threw:", err);
  }
}
