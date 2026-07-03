// 「みんなの目」他者視点解説文の生成・保存・冪等ガード。
//   - friend_perceptions が 3 件未満なら locked (生成しない)。
//   - minna_no_me_reports に 1 owner 1 行でキャッシュ。friend_count_at_generation が
//     現在の友達数と一致 & status='completed' ならキャッシュ返却 (再生成しない)。
//   - 二重生成防止: status='generating' を条件付きで claim してから AI を叩く。
//   - 失敗時は status='failed' + failure_reason を記録し Slack 通知。
// 呼び出しは API ルート (/api/minna-no-me/[ownerToken]) から await される想定。

import { supabaseAdmin } from "./supabase-server";
import { callClaudeForText } from "./anthropic-client";
import {
  computeMinnaNoMeContext,
  type MinnaFriendInput,
} from "./minna-no-me";
import { buildMinnaNoMePrompt } from "./minna-no-me-prompt";
import { sendSlackAlert } from "./slack-alert";
import { REPORT_FRIEND_THRESHOLD } from "./report-data";
import type { BigFiveDimension } from "./types";

export type MinnaNoMeResult =
  | { status: "completed"; text: string }
  | { status: "generating" }
  | { status: "locked"; friendCount: number }
  | { status: "failed"; error: string };

type ReportRow = {
  id: string;
  status: string;
  generated_text: string | null;
  friend_count_at_generation: number | null;
  retry_count: number | null;
};

/**
 * owner (users.id) の「みんなの目」解説文を取得。未生成/古ければ生成して保存する。
 */
export async function generateMinnaNoMe(
  ownerUserId: string,
): Promise<MinnaNoMeResult> {
  // ===== 1. owner + 友達評価を取得 =====
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, scores, display_name")
    .eq("id", ownerUserId)
    .maybeSingle();
  if (userErr || !userRow) {
    return { status: "failed", error: "owner not found" };
  }

  const { data: pRows, error: pErr } = await supabaseAdmin
    .from("friend_perceptions")
    .select("perceiver_name, perceived_scores, qualitative_data, created_at")
    .eq("target_user_id", ownerUserId)
    .order("created_at", { ascending: true });
  if (pErr) {
    return { status: "failed", error: `friend_perceptions: ${pErr.message}` };
  }
  const rows = pRows ?? [];
  const friendCount = rows.length;
  if (friendCount < REPORT_FRIEND_THRESHOLD) {
    return { status: "locked", friendCount };
  }

  // owner_message は best-effort (カラム未適用でも壊さない)。名前で対応づけ。
  const messagesByName = new Map<string, string>();
  try {
    const { data: msgRows } = await supabaseAdmin
      .from("friend_perceptions")
      .select("perceiver_name, owner_message")
      .eq("target_user_id", ownerUserId);
    for (const m of msgRows ?? []) {
      const nm = ((m.perceiver_name as string | null) ?? "").trim();
      const msg = ((m.owner_message as string | null) ?? "").trim();
      if (msg) messagesByName.set(nm, msg);
    }
  } catch {
    // owner_message カラム未適用は無視
  }

  // ===== 2. キャッシュ判定 =====
  const { data: existing } = await supabaseAdmin
    .from("minna_no_me_reports")
    .select(
      "id, status, generated_text, friend_count_at_generation, retry_count",
    )
    .eq("target_user_id", ownerUserId)
    .maybeSingle();
  const existingRow = existing as ReportRow | null;

  if (
    existingRow?.status === "completed" &&
    existingRow.friend_count_at_generation === friendCount &&
    existingRow.generated_text
  ) {
    return { status: "completed", text: existingRow.generated_text };
  }

  // ===== 3. status='generating' を claim (二重生成防止) =====
  if (!existingRow) {
    // 新規行を insert。UNIQUE(target_user_id) 競合なら他リクエストが先行 → generating。
    const { error: insErr } = await supabaseAdmin
      .from("minna_no_me_reports")
      .insert({
        target_user_id: ownerUserId,
        status: "generating",
        friend_count_at_generation: friendCount,
      });
    if (insErr) {
      if (insErr.code === "23505") return { status: "generating" };
      return { status: "failed", error: `insert: ${insErr.message}` };
    }
  } else {
    // 既存行を条件付きで claim。status != 'generating' のときだけ奪える。
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("minna_no_me_reports")
      .update({
        status: "generating",
        friend_count_at_generation: friendCount,
        retry_count: (existingRow.retry_count ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("target_user_id", ownerUserId)
      .neq("status", "generating")
      .select("id")
      .maybeSingle();
    if (claimErr) {
      return { status: "failed", error: `claim: ${claimErr.message}` };
    }
    if (!claimed) {
      // 別リクエストが生成中
      return { status: "generating" };
    }
  }

  // ===== 4. 文脈算出 + プロンプト構築 =====
  try {
    const selfScores = (userRow.scores ?? {}) as Partial<
      Record<BigFiveDimension, number>
    >;
    const friends: MinnaFriendInput[] = rows.map((r) => ({
      name: ((r.perceiver_name as string | null) ?? "").trim() || "ともだち",
      perceivedScores: (r.perceived_scores ?? null) as Record<
        string,
        unknown
      > | null,
      qualitative: (r.qualitative_data ?? null) as Record<
        string,
        unknown
      > | null,
    }));

    const ctx = computeMinnaNoMeContext({ selfScores, friends });
    if (!ctx) {
      throw new Error("context computation returned null (no friend scores)");
    }

    const ownerName =
      ((userRow.display_name as string | null) ?? "").trim() || "あなた";
    // 友達の言葉: 好きなところ + 本人へのメッセージ (自由記述)。
    const qualitativeNotes = [
      ...ctx.favoritePoints,
      ...Array.from(messagesByName.values()),
    ];

    const prompt = buildMinnaNoMePrompt({
      ownerName,
      selfScores,
      ctx,
      qualitativeNotes,
    });

    // ===== 5. AI 生成 =====
    const ai = await callClaudeForText({
      system: prompt.system,
      user: prompt.user,
    });

    // ===== 6. 保存 (completed) =====
    const { error: updErr } = await supabaseAdmin
      .from("minna_no_me_reports")
      .update({
        status: "completed",
        generated_text: ai.text,
        friend_type_id: ctx.friendType32,
        top_gap_axis: ctx.topGapAxis,
        ai_model: ai.model,
        ai_input_tokens: ai.inputTokens,
        ai_output_tokens: ai.outputTokens,
        ai_cost_usd: ai.costUsd,
        failure_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("target_user_id", ownerUserId);
    if (updErr) {
      throw new Error(`update completed: ${updErr.message}`);
    }

    return { status: "completed", text: ai.text };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("minna_no_me_reports")
      .update({
        status: "failed",
        failure_reason: detail.slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("target_user_id", ownerUserId);
    await sendSlackAlert("🚨 みんなの目 解説文生成に失敗", {
      target_user_id: ownerUserId,
      detail,
    });
    return { status: "failed", error: detail };
  }
}
