// Alice Plus (LINE) Phase 4: 今日の占い (リッチメニュー)。
//
// Big Five スナップショット × 日付で、Alice が今日のひとことを占う。
// JST 1日1回だけ生成し、同日中の再タップは line_daily_fortunes のキャッシュを返す
// (コストと「占いが変わった」違和感の両方を防ぐ)。無料枠 (line_chat_messages) は消費しない。

import { callClaude } from "@/lib/claude.mjs";
import type { LineAliceUser } from "@/lib/line-alice";
import { supabaseAdmin } from "@/lib/supabase-server";

const MAX_OUTPUT_TOKENS = 300;

/** JSTの今日の日付 (YYYY-MM-DD)。 */
export function jstDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getOrCreateDailyFortune(input: {
  lineUserId: string;
  user: LineAliceUser;
}): Promise<string> {
  const fortuneDate = jstDateString();

  const { data: cached } = await supabaseAdmin
    .from("line_daily_fortunes")
    .select("content")
    .eq("line_user_id", input.lineUserId)
    .eq("fortune_date", fortuneDate)
    .maybeSingle();
  if (cached?.content) return cached.content;

  const model =
    process.env.LINE_ALICE_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim();
  if (!model) throw new Error("CLAUDE_MODEL not set");

  const result = await callClaude({
    system: buildFortuneInstructions(input.user),
    prompt: `今日の日付: ${fortuneDate}\nこの人の今日の占いを書いてください。`,
    model,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.9,
    timeoutMs: 40_000,
  });
  const text = (result.text ?? "").trim();
  if (!text) throw new Error("empty_fortune");

  const { error } = await supabaseAdmin.from("line_daily_fortunes").insert({
    line_user_id: input.lineUserId,
    user_id: input.user.id,
    fortune_date: fortuneDate,
    content: text,
    model,
  });
  if (error) {
    // 23505 = 同時タップの先勝ち。キャッシュ側を正としてそちらを返す
    if (error.code === "23505") {
      const { data: raced } = await supabaseAdmin
        .from("line_daily_fortunes")
        .select("content")
        .eq("line_user_id", input.lineUserId)
        .eq("fortune_date", fortuneDate)
        .maybeSingle();
      if (raced?.content) return raced.content;
    }
    console.error("[line-fortune] cache insert failed", {
      message: error.message,
    });
  }
  return text;
}

function buildFortuneInstructions(user: LineAliceUser): string {
  const name = (user.display_name ?? "").trim();
  const scores = user.scores ?? {};
  const scoreLine = ["E", "A", "O", "C", "N"]
    .map((key) => `${key}=${typeof scores[key] === "number" ? scores[key] : "?"}`)
    .join(" ");

  return [
    "あなたはAlice。羊毛フェルトの天使の姿をした、やさしい占い師です。",
    "LINEトークで「今日の占い」を届けます。占いはエンタメとして、読んだ人が今日を少し前向きに過ごせるように書いてください。",
    "",
    "書き方のルール:",
    "- 全体で3〜4文。箇条書き・見出し・Markdownは使わない。絵文字は1〜2個まで",
    "- 相手のBig Five傾向を1つだけ、さりげなく織り込む (数値やアルファベットは出さない。「がんばり屋のあなた」のような言い換えで)",
    "- 最後の1文は「今日のラッキーアクション」をひとつ、具体的で小さな行動で提案する",
    "- 断定・脅し・不安を煽る表現は使わない。医療・金銭・受験などの重大な判断には触れない",
    "- 同じ言い回しを毎日繰り返さないよう、日付から連想を広げて変化をつける",
    "",
    `相手の呼び名: ${name ? `${name}さん` : "あなた"}`,
    `相手の診断スナップショット: Big Five (0〜10, E=外向性 A=協調性 O=開放性 C=誠実性 N=情緒の起伏): ${scoreLine}`,
  ].join("\n");
}
