// 鑑定プロンプトに渡す内容レイヤーの入力 (Big Five スコア + 32タイプ名 + 称号) を解決する。
// 称号・タイプ名マスタは TS 側にあるため、worker(.mjs) ではなく呼び出し側でここを使い、
// runForUser に opts として渡す。因子ランキング/象限/主語の言語化 (plan) は prompts.mjs 側
// (buildUnmeiPlan・スコアのみで完結) が担当し、この層はスコア/称号/タイプ名の解決に専念する。
//
// 2026-08-06: /unmei 表紙の「星のアイデンティティカード」用に catchphrase / group も返す。
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyThirtyTwoType,
  thirtyTwoAnimalSlug,
  thirtyTwoCatchphrase,
  thirtyTwoColor,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoName,
} from "@/lib/thirty-two-types";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";

type Scores = Record<string, number>;

// 生息地グループの日本語ラベル (空/陸/海/未知)。表紙カードのタイプ表記に使う。
const GROUP_LABEL: Record<ThirtyTwoGroup, string> = {
  sky: "空",
  land: "陸",
  sea: "海",
  unknown: "未知",
};
const KO_GROUP_LABEL: Record<ThirtyTwoGroup, string> = {
  sky: "하늘",
  land: "육지",
  sea: "바다",
  unknown: "미지",
};

export type UnmeiIdentity = {
  typeName: string; // きらめきクラゲ
  catchphrase: string; // 心に寄り添いながら、世界を知っていく。
  groupLabel: string; // 海
  groupColor: string; // #8EC5E8
};

export async function resolveUnmeiPromptInputs(
  supabaseAdmin: SupabaseClient,
  userId: string,
  requestedLocale?: "ja" | "ko",
): Promise<{
  scores: Scores | null;
  essence: string | null;
  typeName: string | null;
  animalSlug: string | null; // キャラクター星座 (/unmei 表紙) のアート選択用
  identity: UnmeiIdentity | null; // 表紙カードの副次情報 (キャラ名・キャッチ・グループ)
}> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("scores, preferred_locale")
    .eq("id", userId)
    .maybeSingle();
  const scores = (data?.scores as Scores | undefined) ?? null;
  if (!scores)
    return {
      scores: null,
      essence: null,
      typeName: null,
      animalSlug: null,
      identity: null,
    };
  try {
    const id = classifyThirtyTwoType(scores);
    const group = thirtyTwoGroup(id);
    const locale = requestedLocale ?? (data?.preferred_locale === "ko" ? "ko" : "ja");
    const koCopy = locale === "ko" ? KO_RESULT_TYPES[id] : null;
    const typeName = koCopy?.name ?? thirtyTwoName(id);
    const essence = koCopy?.essence ?? thirtyTwoEssence(id);
    return {
      scores,
      essence,
      typeName,
      animalSlug: thirtyTwoAnimalSlug(id),
      identity: {
        typeName,
        catchphrase: koCopy?.oneLiner ?? thirtyTwoCatchphrase(id),
        groupLabel: locale === "ko" ? KO_GROUP_LABEL[group] : GROUP_LABEL[group],
        groupColor: thirtyTwoColor(id),
      },
    };
  } catch {
    return {
      scores,
      essence: null,
      typeName: null,
      animalSlug: null,
      identity: null,
    };
  }
}
