// Alice Plus (LINE) Phase 4: 今日の占い (リッチメニュー) とテーマ別深掘り占い (Plus特典)。
//
// 今日の占い: Big Five × 日付で Alice が今日のひとことを占う。JST 1日1回だけ生成し、
// 同日中の再タップは line_daily_fortunes のキャッシュを返す。生成時は line_chat_messages
// にも assistant 発言として残し、占いの続きをそのまま会話できるようにする
// (user 行は書かないので無料枠は消費しない)。
//
// テーマ別占い (恋愛運/友達運/勉強運): Plus 特典。最近の会話履歴を織り込んで生成し、
// user + assistant の両方を履歴に残す (会話の一部として扱う)。

import { callClaude } from "@/lib/claude.mjs";
import {
  loadRecentHistory,
  persistExchange,
  type LineAliceUser,
} from "@/lib/line-alice";
import { supabaseAdmin } from "@/lib/supabase-server";

const MAX_OUTPUT_TOKENS = 340;

export type FortuneTheme = "love" | "friend" | "study";

export const FORTUNE_THEMES: Record<
  FortuneTheme,
  { label: string; focus: string }
> = {
  love: {
    label: "恋愛運",
    focus: "恋愛・好きな人との距離感・出会い。恋人がいない可能性も自然に考慮する",
  },
  friend: {
    label: "友達運",
    focus: "友達・サークルやバイト先の人間関係・グループでの立ち回り",
  },
  study: {
    label: "勉強運",
    focus: "勉強・課題・テスト・将来に向けたがんばりごと全般",
  },
};

/** JSTの今日の日付 (YYYY-MM-DD)。 */
export function jstDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dialogueModel(): string {
  const value =
    process.env.LINE_ALICE_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim();
  if (!value) throw new Error("CLAUDE_MODEL not set");
  return value;
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

  const model = dialogueModel();
  const result = await callClaude({
    system: buildDailyInstructions(input.user),
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

  // 占いを会話履歴に残す (assistant のみ = 無料枠は消費しない)。
  // 生成できた1回だけ書くので、キャッシュ再タップで履歴は増えない
  await persistAssistantOnly(input.lineUserId, input.user.id, `今日の占い: ${text}`);
  return text;
}

/** テーマ別深掘り占い (Plus特典)。最近の会話を織り込み、会話履歴にも残す。 */
export async function generateThemeFortune(input: {
  lineUserId: string;
  user: LineAliceUser;
  theme: FortuneTheme;
  requestText: string;
}): Promise<string> {
  const theme = FORTUNE_THEMES[input.theme];
  const history = await loadRecentHistory(input.lineUserId);
  const model = dialogueModel();

  const lines: string[] = [];
  if (history.length > 0) {
    lines.push("最近の会話:");
    for (const entry of history) {
      lines.push(
        `${entry.role === "assistant" ? "Alice" : "ユーザー"}: ${entry.content}`,
      );
    }
    lines.push("");
  }
  lines.push(`今日の日付: ${jstDateString()}`);
  lines.push(`この人の「${theme.label}」を深掘りして占ってください。`);

  const result = await callClaude({
    system: buildThemeInstructions(input.user, input.theme),
    prompt: lines.join("\n"),
    model,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.9,
    timeoutMs: 40_000,
  });
  const text = (result.text ?? "").trim();
  if (!text) throw new Error("empty_theme_fortune");

  const usage = (
    result.raw as { usage?: { input_tokens?: number; output_tokens?: number } }
  )?.usage;
  await persistExchange({
    lineUserId: input.lineUserId,
    userId: input.user.id,
    userText: input.requestText,
    assistantText: text,
    model,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
  });
  return text;
}

async function persistAssistantOnly(
  lineUserId: string,
  userId: string,
  content: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from("line_chat_messages").insert({
    line_user_id: lineUserId,
    user_id: userId,
    role: "assistant",
    content,
  });
  if (error) {
    console.error("[line-fortune] history insert failed", {
      message: error.message,
    });
  }
}

function personaLines(user: LineAliceUser): string[] {
  const name = (user.display_name ?? "").trim();
  const scores = user.scores ?? {};
  const scoreLine = ["E", "A", "O", "C", "N"]
    .map((key) => `${key}=${typeof scores[key] === "number" ? scores[key] : "?"}`)
    .join(" ");
  return [
    `相手の呼び名: ${name ? `${name}さん` : "あなた"}`,
    `相手の診断スナップショット: Big Five (0〜10, E=外向性 A=協調性 O=開放性 C=誠実性 N=情緒の起伏): ${scoreLine}`,
  ];
}

function buildDailyInstructions(user: LineAliceUser): string {
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
    ...personaLines(user),
  ].join("\n");
}

function buildThemeInstructions(
  user: LineAliceUser,
  themeKey: FortuneTheme,
): string {
  const theme = FORTUNE_THEMES[themeKey];
  return [
    "あなたはAlice。羊毛フェルトの天使の姿をした、やさしい占い師であり、この人と日々話している対話相手でもあります。",
    `LINEトークで「${theme.label}」の深掘り占いを届けます。テーマ: ${theme.focus}。`,
    "占いはエンタメとして、読んだ人が少し前向きになれるように書いてください。",
    "",
    "書き方のルール:",
    "- 全体で4〜5文。箇条書き・見出し・Markdownは使わない。絵文字は1〜2個まで",
    "- 最近の会話に関係する話題があれば、それとなく1つだけ織り込む (「この前話してくれた〜」のように。無ければ無理に触れない)",
    "- 相手のBig Five傾向も1つ、さりげなく言い換えて織り込む (数値やアルファベットは出さない)",
    "- 最後の1文は、このテーマでの「今日のラッキーアクション」をひとつ、具体的で小さな行動で提案する",
    "- 断定・脅し・不安を煽る表現は使わない。医療・金銭・受験などの重大な判断には触れない",
    "- 会話の続きとして自然な、話しかける口調で書く",
    "",
    ...personaLines(user),
  ].join("\n");
}
