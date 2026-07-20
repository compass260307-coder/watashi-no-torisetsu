// 鑑定プロンプトに渡す入力 (Big Five スコア + 32タイプ称号) を解決する。
// 称号マスタは TS 側にあるため、worker(.mjs) ではなく呼び出し側でここを使い、
// runForUser に opts として渡す。
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyThirtyTwoType, thirtyTwoEssence } from "@/lib/thirty-two-types";

type Scores = Record<string, number>;

export async function resolveUnmeiPromptInputs(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<{ scores: Scores | null; essence: string | null }> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("scores")
    .eq("id", userId)
    .maybeSingle();
  const scores = (data?.scores as Scores | undefined) ?? null;
  if (!scores) return { scores: null, essence: null };
  try {
    const id = classifyThirtyTwoType(scores);
    return { scores, essence: thirtyTwoEssence(id) };
  } catch {
    return { scores, essence: null };
  }
}
