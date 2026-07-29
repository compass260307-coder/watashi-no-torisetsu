// 鑑定プロンプトに渡す内容レイヤーの入力 (Big Five スコア + 32タイプ名 + 称号) を解決する。
// 称号・タイプ名マスタは TS 側にあるため、worker(.mjs) ではなく呼び出し側でここを使い、
// runForUser に opts として渡す。因子ランキング/象限/主語の言語化 (plan) は prompts.mjs 側
// (buildUnmeiPlan・スコアのみで完結) が担当し、この層はスコア/称号/タイプ名の解決に専念する。
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoName,
} from "@/lib/thirty-two-types";

type Scores = Record<string, number>;

export async function resolveUnmeiPromptInputs(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<{
  scores: Scores | null;
  essence: string | null;
  typeName: string | null;
}> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("scores")
    .eq("id", userId)
    .maybeSingle();
  const scores = (data?.scores as Scores | undefined) ?? null;
  if (!scores) return { scores: null, essence: null, typeName: null };
  try {
    const id = classifyThirtyTwoType(scores);
    return { scores, essence: thirtyTwoEssence(id), typeName: thirtyTwoName(id) };
  } catch {
    return { scores, essence: null, typeName: null };
  }
}
