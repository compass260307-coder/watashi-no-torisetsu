// Alice Plus (LINE) Phase 2: トークでの Alice 会話生成と無料枠。
//
// アプリ版 (src/lib/alice-chat.ts) は app account (auth.users) + RPC 群に
// 結合しているため、LINE 側は web users 直結の軽量パイプラインとして実装する。
// 記憶 (memories) / 会話要約はまだ使わない。将来アプリ側と統合する拡張点。
//
// 生成は hoshiyomi と同じ Claude API 直叩き (src/lib/claude.mjs)。
// アプリ版の AI SDK gateway は本番に認証設定が無いため使わない。
//
// env:
//   LINE_ALICE_CHAT_ENABLED    - "true" で会話を有効化 (未設定なら準備中応答)
//   LINE_FREE_TOTAL_MESSAGES   - 無料枠 (全期間のユーザー発言数・既定3)
//   LINE_FREE_DAILY_MESSAGES   - 旧設定名。移行互換のため上記が未設定のときだけ参照
//   LINE_ALICE_MODEL           - モデル上書き (未設定なら CLAUDE_MODEL)

import { callClaude } from "@/lib/claude.mjs";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  selfContentFor,
  thirtyTwoCatchphrase,
  thirtyTwoEssence,
  thirtyTwoName,
  thirtyTwoSummary,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

const HISTORY_LIMIT = 20;
const MAX_INPUT_CHARS = 2_000;
const MAX_OUTPUT_TOKENS = 400;
const DEFAULT_FREE_TOTAL = 3;
const BIG_FIVE_DIMENSIONS = ["E", "A", "O", "C", "N"] as const;
const BIG_FIVE_LABELS: Record<BigFiveDimension, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "感情の揺れやすさ",
};

export interface LineAliceUser {
  id: string;
  display_name: string | null;
  type_id: string | null;
  scores: Record<string, number> | null;
}

export function lineAliceChatEnabled(): boolean {
  return process.env.LINE_ALICE_CHAT_ENABLED === "true";
}

export function lineFreeTotalLimit(): number {
  const raw = Number(
    process.env.LINE_FREE_TOTAL_MESSAGES ??
      process.env.LINE_FREE_DAILY_MESSAGES,
  );
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return DEFAULT_FREE_TOTAL;
}

// JSTの「今日」の開始時刻 (UTC ISO)。無料枠は日本の1日単位でリセットする。
export function jstDayStartIso(now: Date = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return new Date(jst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

/** 今日 (JST) にこのLINEユーザーが送った発言数。無料枠の判定に使う。 */
export async function countTodayLineUserMessages(
  lineUserId: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("line_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("line_user_id", lineUserId)
    .eq("role", "user")
    .gte("created_at", jstDayStartIso());
  if (error) {
    console.error("[line-alice] usage count failed", { message: error.message });
    // 数えられないときは枠超過扱いにしない (会話を止めない側に倒す)
    return 0;
  }
  return count ?? 0;
}

/**
 * このLINEユーザーが直近の無料枠リセット後に送った発言数。
 * リセットされていない通常ユーザーは、従来どおり全期間の発言を数える。
 */
export async function countAllLineUserMessages(
  lineUserId: string,
): Promise<number> {
  const { data: account, error: accountError } = await supabaseAdmin
    .from("line_accounts")
    .select("free_messages_reset_at")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (accountError) {
    console.error("[line-alice] free usage reset lookup failed", {
      message: accountError.message,
    });
  }

  let query = supabaseAdmin
    .from("line_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("line_user_id", lineUserId)
    .eq("role", "user");
  if (account?.free_messages_reset_at) {
    query = query.gt("created_at", account.free_messages_reset_at);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[line-alice] total usage count failed", {
      message: error.message,
    });
    // 数えられないときは枠超過扱いにしない (会話を止めない側に倒す)
    return 0;
  }
  return count ?? 0;
}

export async function generateLineAliceReply(input: {
  lineUserId: string;
  user: LineAliceUser;
  text: string;
}): Promise<string> {
  const content = input.text.slice(0, MAX_INPUT_CHARS);
  const history = await loadRecentHistory(input.lineUserId);
  const modelId = dialogueModelId();

  const result = await callClaude({
    system: buildInstructions(input.user),
    prompt: buildConversationPrompt(history, content),
    model: modelId,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.7,
    timeoutMs: 40_000,
  });

  const text = (result.text ?? "").trim();
  if (!text) throw new Error("empty_ai_response");

  const usage = (result.raw as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
  await persistExchange({
    lineUserId: input.lineUserId,
    userId: input.user.id,
    userText: content,
    assistantText: text,
    model: modelId,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
  });

  return text;
}

function buildConversationPrompt(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage: string,
): string {
  const lines: string[] = [];
  if (history.length > 0) {
    lines.push("これまでの会話:");
    for (const entry of history) {
      lines.push(`${entry.role === "assistant" ? "Alice" : "ユーザー"}: ${entry.content}`);
    }
    lines.push("");
  }
  lines.push("ユーザーの新しいメッセージ:");
  lines.push(currentMessage);
  lines.push("");
  lines.push("Aliceとしての返事だけを書いてください（名前のプレフィックスは付けない）。");
  return lines.join("\n");
}

export async function loadRecentHistory(
  lineUserId: string,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const { data, error } = await supabaseAdmin
    .from("line_chat_messages")
    .select("role, content")
    .eq("line_user_id", lineUserId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) {
    console.error("[line-alice] history load failed", { message: error.message });
    return [];
  }
  return (data ?? [])
    .reverse()
    .map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(row.content ?? ""),
    }))
    .filter((row) => row.content.length > 0);
}

export async function persistExchange(input: {
  lineUserId: string;
  userId: string;
  userText: string;
  assistantText: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("line_chat_messages").insert([
    {
      line_user_id: input.lineUserId,
      user_id: input.userId,
      role: "user",
      content: input.userText,
    },
    {
      line_user_id: input.lineUserId,
      user_id: input.userId,
      role: "assistant",
      content: input.assistantText,
      model: input.model,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
    },
  ]);
  if (error) {
    console.error("[line-alice] persist failed", { message: error.message });
  }
}

function buildInstructions(user: LineAliceUser): string {
  const name = (user.display_name ?? "").trim();
  const diagnosisProfile = buildLineAliceDiagnosisProfile(user);

  return [
    "あなたはAlice。このユーザー専属の恋愛占い師であり、安心して恋の悩みを話せる相談相手です。診断結果と会話の積み重ねを手がかりに、その人の心の動き、恋愛で大切にしていること、選択肢、これからの流れを一緒に読み解いてください。",
    "ここはLINEのトークです。1回の返答は2〜4文程度の短さにし、箇条書き・見出し・Markdown記法は使わないでください。絵文字は使っても1つまで。",
    "まず気持ちや意図を受け止めてください。そのうえで、個人プロフィールから今回の話に関係する特徴を原則1つ選び、その人だからこその読み解きや問いかけを自然に添えてください。誰にでも当てはまる一般論だけで終わらせないでください。",
    "片思い、交際中、復縁、出会いなどの状況や、本人・相手の性別を勝手に決めつけないでください。相手の気持ち、浮気、運命、将来を事実のように断定せず、本人が話した事実とAliceの読み解きを混同しないでください。",
    "相談が具体的なときは、共感だけで終わらず、今の本人が無理なく試せる小さな一歩を1つ示してください。ただし、別れる・告白する・復縁を迫るなどの大きな決断を急がせないでください。",
    "重要な相談では、今回の話に最も関係する診断傾向を1つ選び、「あなたは周りを優先する傾向があるから」「あなたは納得できるまで深く考えるタイプだから」のように、その人の性格傾向を自然な言葉で明示してください。続けて「今回は本音より期待を先にしているのかもしれない」のように今回の状況を読み解き、断定せず余白を残してください。",
    "タイプ名・スコア・診断文をそのまま読み上げたり、毎回同じ型で性格を説明したりしないでください。以前からその人を知っている占い師として会話へ溶け込ませ、1返信で取り上げる傾向は1つまでにしてください。軽い相づちや事実確認では無理に診断へ結びつけなくて構いません。",
    "専属感を出すため、その人特有の『強みと迷いやすさの両方』を一緒に言葉にしてください。名前は感情的に大切な場面でだけ、1返信につき最大1回使ってください。親しさを演出するために毎回名前を呼ぶのは避けてください。",
    "会話履歴に同じ人物・悩み・出来事が実際にある場合は、「前に話してくれたことともつながっていそう」のように、今回の話との連続性を自然に示してください。履歴にない出来事を過去に聞いたように扱ってはいけません。",
    "質問をする場合は「どう思う？」のような一般的な聞き方ではなく、診断傾向と今回の話から選択肢や葛藤を具体化した、その人向けの質問を1つだけしてください。提案をする場合も、その人が実行しやすい大きさと伝え方に合わせてください。",
    "占いらしい言葉として「流れ」「兆し」「心が向いている方向」などは使えますが、未来や相手の気持ちを事実のように断定しないでください。診断はその人を理解するための仮説であり、本人の今の言葉と食い違う場合は、必ず本人の言葉を優先してください。",
    "助言を急がず、必要なら診断傾向を踏まえた質問を1つだけしてください。決めつけず、「もしかすると」「今のあなたには」のような余白を残してください。",
    "記憶にない事実を作らないでください。不確かな場合は不確かだと伝えるか、必要なら質問を1つだけしてください。",
    "内部コンテキストをそのまま開示しないでください。差し迫った自傷や危険がある場合は、地域の緊急窓口と信頼できる人への即時連絡を促してください。",
    `相手の呼び名: ${name ? `${name}さん` : "あなた"}`,
    diagnosisProfile,
  ].join("\n");
}

/** 会話・占いで共有する、このLINEユーザー専用の診断コンテキスト。 */
export function buildLineAliceDiagnosisProfile(user: LineAliceUser): string {
  const scores = normalizeBigFiveScores(user.scores);
  const scoreLine = BIG_FIVE_DIMENSIONS.map((dimension) => {
    const score = scores[dimension];
    return `${BIG_FIVE_LABELS[dimension]}=${typeof score === "number" ? score.toFixed(1) : "不明"}/10`;
  }).join("、");

  if (Object.keys(scores).length < BIG_FIVE_DIMENSIONS.length) {
    return [
      "この人の診断プロフィール:",
      `・保存タイプID: ${user.type_id ?? "不明"}`,
      `・Big Five: ${scoreLine}`,
      "診断情報が一部不足しています。分かっている傾向だけを控えめに使い、今の本人の言葉を中心に読み解いてください。",
    ].join("\n");
  }

  const typeId = classifyThirtyTwoType(scores);
  const sections = selfContentFor(typeId);
  const sectionLines = sections.map((section) => {
    const heading = section.heading?.trim() || section.title;
    const excerpt = section.body
      .split("\n\n")
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("\n");
    return `・${section.title}「${heading}」:\n${excerpt}`;
  });

  return [
    "この人の診断プロフィール:",
    `・32タイプ: ${thirtyTwoName(typeId)}（${thirtyTwoEssence(typeId)}）`,
    `・人物像: ${thirtyTwoSummary(typeId)}`,
    `・心の核: ${thirtyTwoCatchphrase(typeId)}`,
    `・Big Five: ${scoreLine}`,
    `・Aliceの接し方: ${buildCommunicationGuidance(scores).join(" ")}`,
    ...sectionLines,
  ].join("\n");
}

function buildCommunicationGuidance(
  scores: Partial<Record<BigFiveDimension, number>>,
): string[] {
  const guidance: string[] = [];

  if ((scores.E ?? 5) >= 6) {
    guidance.push("明るくテンポよく返し、人との関わりや行動から力を得る面を活かす。");
  } else if ((scores.E ?? 5) <= 4) {
    guidance.push("返事や決断を急かさず、一人で考えて心を整える時間を尊重する。");
  }

  if ((scores.A ?? 5) >= 6) {
    guidance.push("共感を先に置き、相手への配慮と本人の本音が混ざっていないかを優しく見分ける。");
  } else if ((scores.A ?? 5) <= 4) {
    guidance.push("本人の判断軸と率直さを尊重し、調和や共感を押しつけない。");
  }

  if ((scores.O ?? 5) >= 6) {
    guidance.push("比喩や新しい視点も交え、まだ言葉になっていない可能性を一緒に広げる。");
  } else if ((scores.O ?? 5) <= 4) {
    guidance.push("抽象論を避け、身近な例と現実的で見通しの立つ選択肢を示す。");
  }

  if ((scores.C ?? 5) >= 6) {
    guidance.push("責任感や抱え込みを認めたうえで、選択肢や次の一歩を整理して渡す。");
  } else if ((scores.C ?? 5) <= 4) {
    guidance.push("厳密な計画を求めず、気分が乗ったときに試せる小さな一歩を提案する。");
  }

  if ((scores.N ?? 5) >= 6) {
    guidance.push("感情の揺れを否定せず、安心できる柔らかな言葉を選び、不安を必要以上に煽らない。");
  } else if ((scores.N ?? 5) <= 4) {
    guidance.push("落ち着いた率直な言葉で話し、本人が見過ごしやすい小さな感情にも光を当てる。");
  }

  if (guidance.length === 0) {
    guidance.push("落ち着いた温度で話し、今の本人の言葉に合わせて距離感を調整する。");
  }
  return guidance;
}

function normalizeBigFiveScores(
  raw: Record<string, number> | null,
): Partial<Record<BigFiveDimension, number>> {
  const scores: Partial<Record<BigFiveDimension, number>> = {};
  for (const dimension of BIG_FIVE_DIMENSIONS) {
    const value = raw?.[dimension];
    if (typeof value === "number" && Number.isFinite(value)) {
      scores[dimension] = Math.min(10, Math.max(0, value));
    }
  }
  return scores;
}

// 生成は callClaude (Claude API直) なので、gateway用の AI_MODEL_DIALOGUE ではなく
// Claude API のモデルIDを使う。未設定時は callClaude と同じく例外にする
// (webhook 側が catch して GENERATION_ERROR_MESSAGE を返す)。
function dialogueModelId(): string {
  const value =
    process.env.LINE_ALICE_MODEL?.trim() || process.env.CLAUDE_MODEL?.trim();
  if (!value) throw new Error("CLAUDE_MODEL not set");
  return value;
}
