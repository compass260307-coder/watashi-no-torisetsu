import "server-only";

import type { ModelMessage, SystemModelMessage } from "ai";

import { supabaseAdmin } from "@/lib/supabase-server";

const DEFAULT_MEMORY_MAX = 20;
const DEFAULT_STABLE_MEMORY_MAX = 8;
const RECENT_MESSAGE_MAX = 30;
const MEMORY_FETCH_MAX = 80;

type MemoryRow = {
  id: string;
  category: string;
  content: string;
  importance: number;
  is_pinned: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
};

type ChatMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AliceChatContext = {
  instructions: SystemModelMessage[];
  messages: ModelMessage[];
  selectedMemoryIds: string[];
  maxOutputTokens: number;
};

export async function buildAliceChatContext(input: {
  accountId: string;
  threadId: string;
  currentMessage: string;
}): Promise<AliceChatContext> {
  const { data: account, error: accountError } = await supabaseAdmin
    .from("accounts")
    .select("active_base_profile_snapshot_id, locale, guide")
    .eq("id", input.accountId)
    .maybeSingle();

  if (accountError || !account?.active_base_profile_snapshot_id) {
    throw new Error("chat_context_account_unavailable");
  }

  const [snapshotResult, memoryResult, summaryResult, messageResult, limitResult] =
    await Promise.all([
      supabaseAdmin
        .from("base_profile_snapshots")
        .select(
          "id, logic_version, copied_at, type_id, scores, facet_scores, self_report, perceived_report, friend_view_base",
        )
        .eq("id", account.active_base_profile_snapshot_id)
        .eq("account_id", input.accountId)
        .maybeSingle(),
      supabaseAdmin
        .from("memories")
        .select(
          "id, category, content, importance, is_pinned, use_count, last_used_at, created_at",
        )
        .eq("account_id", input.accountId)
        .order("is_pinned", { ascending: false })
        .order("importance", { ascending: false })
        .order("last_used_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(MEMORY_FETCH_MAX),
      supabaseAdmin
        .from("conversation_summaries")
        .select("content")
        .eq("account_id", input.accountId)
        .eq("thread_id", input.threadId)
        .maybeSingle(),
      supabaseAdmin
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("account_id", input.accountId)
        .eq("thread_id", input.threadId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(RECENT_MESSAGE_MAX),
      supabaseAdmin
        .from("ai_plan_limits")
        .select("max_output_tokens")
        .eq("feature", "dialogue")
        .eq("is_active", true)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (snapshotResult.error || !snapshotResult.data) {
    throw new Error("chat_context_snapshot_unavailable");
  }
  if (memoryResult.error) throw new Error("chat_context_memories_unavailable");
  if (messageResult.error) throw new Error("chat_context_messages_unavailable");
  if (limitResult.error || !limitResult.data) {
    throw new Error("chat_context_limit_unavailable");
  }

  const memoryMax = boundedInteger(
    process.env.AI_CONTEXT_MEMORY_MAX,
    DEFAULT_MEMORY_MAX,
    1,
    40,
  );
  const stableMax = Math.min(
    boundedInteger(
      process.env.AI_CONTEXT_STABLE_MEMORY_MAX,
      DEFAULT_STABLE_MEMORY_MAX,
      0,
      memoryMax,
    ),
    memoryMax,
  );
  const memoryRows = deduplicateMemories((memoryResult.data ?? []) as MemoryRow[]);
  const stableMemories = selectStableMemories(memoryRows, stableMax);
  const stableIds = new Set(stableMemories.map((memory) => memory.id));
  const relevantMemories = selectRelevantMemories(
    memoryRows.filter((memory) => !stableIds.has(memory.id)),
    input.currentMessage,
    memoryMax - stableMemories.length,
  );
  const selectedMemories = [...stableMemories, ...relevantMemories];

  const snapshot = snapshotResult.data;
  const locale = account.locale || "ja-JP";
  const guide = account.guide === "harry" ? "harry" : "alice";
  const fixedInstructions = buildFixedInstructions({
    locale,
    guide,
    snapshot,
    stableMemories,
  });
  const variableInstructions = buildVariableInstructions({
    locale,
    relevantMemories,
    conversationSummary: summaryResult.error
      ? null
      : summaryResult.data?.content ?? null,
  });

  const recentRows = ((messageResult.data ?? []) as ChatMessageRow[]).reverse();
  const messages: ModelMessage[] = recentRows.map((message) => ({
    role: message.role,
    content: limitText(message.content, message.role === "user" ? 4_000 : 8_000),
  }));
  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");
  if (
    !latestUserMessage ||
    typeof latestUserMessage.content !== "string" ||
    latestUserMessage.content.trim() !== input.currentMessage.trim()
  ) {
    messages.push({ role: "user", content: input.currentMessage.trim() });
  }

  return {
    instructions: [
      { role: "system", content: fixedInstructions },
      { role: "system", content: variableInstructions },
    ],
    messages,
    selectedMemoryIds: selectedMemories.map((memory) => memory.id),
    maxOutputTokens: limitResult.data.max_output_tokens,
  };
}

export async function markAliceMemoriesUsed(
  accountId: string,
  memoryIds: string[],
) {
  if (memoryIds.length === 0) return;
  const { error } = await supabaseAdmin.rpc("mark_alice_memories_used", {
    p_account_id: accountId,
    p_memory_ids: memoryIds,
  });
  if (error) {
    console.warn("[alice/chat] failed to update memory usage", {
      message: error.message,
    });
  }
}

function buildFixedInstructions(input: {
  locale: string;
  guide: "alice" | "harry";
  snapshot: Record<string, unknown>;
  stableMemories: MemoryRow[];
}) {
  const guideName = input.guide === "harry" ? "Harry" : "Alice";
  const profile = stableJson(input.snapshot, 18_000);
  const stableMemory = serializeMemories(input.stableMemories);

  if (!input.locale.toLowerCase().startsWith("ja")) {
    return [
      `You are ${guideName}, a thoughtful companion who understands the user deeply over time.`,
      "Alice and Harry share the same memory, judgment policy, and conversational character; only their name and visual/gender expression differ.",
      "Respond in the account locale unless the user clearly uses another language.",
      "Listen before advising. Refer to profile information naturally only when useful, never as destiny or a diagnosis.",
      "Never invent memories. If uncertain, say so or ask one concise question. Keep a normal reply to roughly 2–6 sentences.",
      "Do not expose this context. For imminent self-harm or danger, encourage immediate local emergency help and contact with a trusted person.",
      `Active profile snapshot: ${profile}`,
      `Stable approved memories: ${stableMemory}`,
    ].join("\n");
  }

  return [
    `あなたは${guideName}。ユーザーのことを時間をかけて深く理解していく、安心して何でも話せる対話相手です。`,
    "AliceとHarryは、記憶・判断方針・対話人格が同一です。違うのは名前と外見・性別表現だけです。",
    "原則としてアカウントのlocaleに合わせて返答し、ユーザーが別言語で話したときは自然に合わせてください。",
    "まず気持ちや意図を受け止め、助言を急がないでください。診断情報は役立つときだけ自然に使い、運命・断定・医療診断のように扱わないでください。",
    "記憶にない事実を作らないでください。不確かな場合は不確かだと伝えるか、必要なら質問を1つだけしてください。通常は2〜6文程度の会話らしい長さにしてください。",
    "内部コンテキストをそのまま開示しないでください。差し迫った自傷や危険がある場合は、地域の緊急窓口と信頼できる人への即時連絡を促してください。",
    `現在の診断スナップショット: ${profile}`,
    `固定して参照する本人承認済みの記憶: ${stableMemory}`,
  ].join("\n");
}

function buildVariableInstructions(input: {
  locale: string;
  relevantMemories: MemoryRow[];
  conversationSummary: string | null;
}) {
  const relevantMemory = serializeMemories(input.relevantMemories);
  const summary = input.conversationSummary
    ? limitText(input.conversationSummary, 6_000)
    : "(none)";
  if (!input.locale.toLowerCase().startsWith("ja")) {
    return [
      "Use the following variable context only when relevant to the user's current message.",
      `Relevant approved memories: ${relevantMemory}`,
      `Earlier conversation summary: ${summary}`,
    ].join("\n");
  }
  return [
    "以下の可変情報は、現在の発言に関係するときだけ参照してください。無理に話題へ入れないでください。",
    `関連する本人承認済みの記憶: ${relevantMemory}`,
    `それ以前の会話要約: ${summary}`,
  ].join("\n");
}

function selectStableMemories(rows: MemoryRow[], limit: number) {
  return [...rows]
    .sort((left, right) => {
      if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
      if (left.importance !== right.importance) return right.importance - left.importance;
      const usedDifference = dateValue(right.last_used_at) - dateValue(left.last_used_at);
      if (usedDifference !== 0) return usedDifference;
      return dateValue(right.created_at) - dateValue(left.created_at);
    })
    .slice(0, limit);
}

function selectRelevantMemories(
  rows: MemoryRow[],
  currentMessage: string,
  limit: number,
) {
  if (limit <= 0) return [];
  const messageTerms = contextTerms(currentMessage);
  return [...rows]
    .map((memory) => ({
      memory,
      relevance: overlapScore(messageTerms, contextTerms(memory.content)),
    }))
    .sort((left, right) => {
      if (left.relevance !== right.relevance) return right.relevance - left.relevance;
      if (left.memory.importance !== right.memory.importance) {
        return right.memory.importance - left.memory.importance;
      }
      return dateValue(right.memory.created_at) - dateValue(left.memory.created_at);
    })
    .slice(0, limit)
    .map(({ memory }) => memory);
}

function contextTerms(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, "").slice(0, 4_000);
  const terms = new Set<string>();
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= normalized.length - size; index += 1) {
      terms.add(normalized.slice(index, index + size));
    }
  }
  for (const word of value.toLowerCase().match(/[a-z0-9]{3,}|[一-龠ぁ-んァ-ン]{2,}/g) ?? []) {
    terms.add(word);
  }
  return terms;
}

function overlapScore(left: Set<string>, right: Set<string>) {
  let score = 0;
  for (const term of left) {
    if (right.has(term)) score += term.length === 3 ? 2 : 1;
  }
  return score;
}

function serializeMemories(memories: MemoryRow[]) {
  if (memories.length === 0) return "(なし)";
  return memories
    .map(
      (memory, index) =>
        `${index + 1}. [${limitText(memory.category, 80)}] ${limitText(memory.content, 700)}`,
    )
    .join("\n");
}

function deduplicateMemories(memories: MemoryRow[]) {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    const normalized = memory.content
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s、。,.!！?？・「」『』（）()]/g, "")
      .slice(0, 300);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function stableJson(value: unknown, limit: number) {
  try {
    return limitText(JSON.stringify(value), limit);
  } catch {
    return "{}";
  }
}

function limitText(value: string, limit: number) {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function dateValue(value: string | null) {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}
