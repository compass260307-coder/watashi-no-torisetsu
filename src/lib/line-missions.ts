// リテンションミッションの達成判定。/line/missions ページ (表示) と
// LINE webhook の handleThemeFortune (報酬受取) の両方から使う。
// 節目キー (:talk / :streak3) はその2箇所と対で保つこと。

import { supabaseAdmin } from "@/lib/supabase-server";

export const LINE_FRIEND_MISSION_TIERS = [
  { min: 1, keySuffix: "", title: "友達1人の回答を集める" },
  { min: 3, keySuffix: ":m3", title: "友達3人の回答を集める" },
  { min: 5, keySuffix: ":m5", title: "友達5人の回答を集める" },
] as const;

export const LINE_SOCIAL_MISSION_NETWORKS = ["x", "fb", "th"] as const;
export type LineSocialMissionNetwork =
  (typeof LINE_SOCIAL_MISSION_NETWORKS)[number];

// Aliceに話しかけたことがあるか (role='user' の会話行が1件でもあれば達成)。
// キーワード応答 (「ミッション」等) は line_chat_messages に残らないので、
// 実際の会話かテーマ占いだけが達成になる。
export async function hasTalkedToAlice(lineUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("line_chat_messages")
    .select("id")
    .eq("line_user_id", lineUserId)
    .eq("role", "user")
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// 今日の占いの連続日数 (JST)。line_daily_fortunes は1日1行 (unique) なので
// fortune_date の並びだけで判定できる。
//   best:    これまでの最長連続日数 (達成判定用・一度3日続けば達成のまま)
//   current: 今日または昨日を終端とする継続中の連続日数 (進捗表示用)
export async function fortuneStreak(
  lineUserId: string,
): Promise<{ best: number; current: number }> {
  const { data } = await supabaseAdmin
    .from("line_daily_fortunes")
    .select("fortune_date")
    .eq("line_user_id", lineUserId)
    .order("fortune_date", { ascending: false })
    .limit(60);
  const dayNums = (data ?? []).map((row) =>
    Math.floor(Date.parse(row.fortune_date as string) / 86_400_000),
  );
  if (dayNums.length === 0) return { best: 0, current: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < dayNums.length; i++) {
    run = dayNums[i - 1] - dayNums[i] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const todayJst = Math.floor((Date.now() + 9 * 3_600_000) / 86_400_000);
  let current = 0;
  if (todayJst - dayNums[0] <= 1) {
    current = 1;
    for (let i = 1; i < dayNums.length; i++) {
      if (dayNums[i - 1] - dayNums[i] !== 1) break;
      current++;
    }
  }
  return { best, current };
}
