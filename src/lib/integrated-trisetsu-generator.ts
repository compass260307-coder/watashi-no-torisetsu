// プレミアム化 v2 Week 2 T2-7: AI 統合トリセツ生成の共通ロジック
//
// 呼び出し元:
//   - /api/integrated-trisetsu (POST, dev/manual パス)
//   - /api/webhook/stripe → after() で非同期実行 (本番パス)
//
// 契約:
//   - 呼び出し側で先に integrated_trisetsu を status='pending' で INSERT 済み
//   - 本関数が status='generating' → 'completed' or 'failed' を遷移させる
//   - 完了時は logLineMessage に DB ログを残す
//   - 失敗時は failure_reason / retry_count を記録 + Slack アラート

import { supabaseAdmin } from "./supabase-server";
import { buildIntegratedPrompt } from "./ai-prompt-builder";
import { callClaudeForIntegration } from "./anthropic-client";
import { torisetsuTypes } from "./torisetsu-data";
import {
  buildFullCode as buildFullCodeFromIds,
  classifyModifier,
} from "./diagnosis";
import { getModifierLabel, getModifierParagraph } from "./modifier-data";
import { logLineMessage } from "./line-notify";
import { sendSlackAlert } from "./slack-alert";
import type {
  BigFiveDimension,
  CModifier,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "./types";

// ---------- ローカル型 ----------
type StoredSelfScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
  facetScores?: Record<FacetId, number>;
};

type PerceptionRow = {
  id: string;
  perceiver_name: string;
  perceived_type_id: string;
  perceived_full_code: string;
  perceived_modifier_label: string;
  perceived_modifier_paragraph: string;
  perceived_scores: Record<BigFiveDimension, number>;
  perceived_facet_scores: Record<FacetId, number>;
};

type SelfDataForPrompt = NonNullable<
  Parameters<typeof buildIntegratedPrompt>[0]["selfData"]
>;

const DEFAULT_FACET_FALLBACK: Record<FacetId, number> = {
  E_assertiveness: 5,
  E_warmth: 5,
  A_cooperation: 5,
  A_sympathy: 5,
  O_adventurousness: 5,
  O_imagination: 5,
  C_achievement: 5,
  C_orderliness: 5,
  N_volatility: 5,
  N_anxiety: 5,
};

function buildSelfData(userRow: {
  type_id: unknown;
  scores: unknown;
}): SelfDataForPrompt {
  const typeId = userRow.type_id as TorisetsuTypeId;
  const typeName = torisetsuTypes[typeId]?.name ?? typeId;
  const stored = (userRow.scores ?? {}) as StoredSelfScores;
  const fiveDim: Record<BigFiveDimension, number> = {
    E: typeof stored.E === "number" ? stored.E : 5,
    A: typeof stored.A === "number" ? stored.A : 5,
    O: typeof stored.O === "number" ? stored.O : 5,
    C: typeof stored.C === "number" ? stored.C : 5,
    N: typeof stored.N === "number" ? stored.N : 5,
  };
  let cModifier = stored.cModifier;
  let nModifier = stored.nModifier;
  let fullCode = stored.fullCode;
  let modifierLabel = stored.modifierLabel;
  if (!cModifier || !nModifier || !fullCode || !modifierLabel) {
    const m = classifyModifier(fiveDim);
    cModifier = cModifier ?? m.cModifier;
    nModifier = nModifier ?? m.nModifier;
    fullCode = fullCode ?? buildFullCodeFromIds(typeId, cModifier, nModifier);
    modifierLabel = modifierLabel ?? getModifierLabel(cModifier, nModifier);
  }
  const modifierParagraph = getModifierParagraph(
    typeId,
    cModifier,
    nModifier,
  );
  const facetScores: Record<FacetId, number> =
    stored.facetScores ?? DEFAULT_FACET_FALLBACK;
  return {
    fullCode,
    typeName,
    modifierLabel,
    scores: fiveDim,
    facetScores,
    modifierParagraph,
  };
}

/**
 * source_summary オブジェクトを構築 (Webhook の INSERT 時に必要、
 * existing route.ts はインラインで構築するため公開した)。
 */
export async function buildSourceSummary(
  userId: string,
  includeSelf: boolean,
  perceptionIds: string[],
): Promise<{
  self: { fullCode: string; name: string } | null;
  perceptions: Array<{ name: string; fullCode: string }>;
}> {
  let ownerName = "あなた";
  let selfFullCode = "";
  if (includeSelf) {
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("display_name, scores")
      .eq("id", userId)
      .maybeSingle();
    if (userRow) {
      const dn = (userRow.display_name as string | null) ?? "";
      if (dn.trim()) ownerName = dn.trim();
      const scores = (userRow.scores ?? {}) as Record<string, unknown>;
      if (typeof scores.fullCode === "string") {
        selfFullCode = scores.fullCode as string;
      }
    }
  }

  let perceptions: Array<{ name: string; fullCode: string }> = [];
  if (perceptionIds.length > 0) {
    const { data: ps } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id, perceiver_name, perceived_full_code")
      .in("id", perceptionIds);
    const byId = new Map<string, { name: string; fullCode: string }>();
    for (const p of ps ?? []) {
      byId.set(p.id as string, {
        name: p.perceiver_name as string,
        fullCode: p.perceived_full_code as string,
      });
    }
    perceptions = perceptionIds
      .map((pid) => byId.get(pid))
      .filter((x): x is { name: string; fullCode: string } => Boolean(x));
  }

  return {
    self:
      includeSelf && selfFullCode
        ? { fullCode: selfFullCode, name: ownerName }
        : null,
    perceptions,
  };
}

/**
 * integrated_trisetsu 行 (status='pending' 想定) を読んで AI 生成を実行し、
 * 結果を UPDATE する。
 *
 * フロー:
 *   1. SELECT integrated_trisetsu 行
 *   2. UPDATE status='generating'
 *   3. users + friend_perceptions 取得
 *   4. buildIntegratedPrompt
 *   5. callClaudeForIntegration
 *   6. UPDATE: 成功 → status='completed' + generated_* + ai_*
 *   7. UPDATE: 失敗 → status='failed' + failure_reason + retry_count++
 *   8. logLineMessage (DB ログ)、失敗時は sendSlackAlert
 *
 * idempotent: 既に status='completed' の行に対しては no-op を返す。
 */
export async function runAIGenerationAndUpdate(
  integratedTrisetsuId: string,
): Promise<{ success: boolean; error?: string }> {
  // ===== 1. 行取得 =====
  const { data: row, error: rowErr } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, user_id, line_user_id, include_self, perception_ids, status, retry_count",
    )
    .eq("id", integratedTrisetsuId)
    .maybeSingle();
  if (rowErr || !row) {
    const errMsg = `row not found: ${rowErr?.message ?? "null"}`;
    await sendSlackAlert("🚨 generator: integrated_trisetsu 行が見つからない", {
      integrated_trisetsu_id: integratedTrisetsuId,
      detail: errMsg,
    });
    return { success: false, error: errMsg };
  }
  if (row.status === "completed") {
    // 既に完了 → idempotent no-op
    return { success: true };
  }

  const userId = row.user_id as string;
  const lineUserId = (row.line_user_id as string | null) ?? null;
  const includeSelf = row.include_self === true;
  const perceptionIds: string[] = (row.perception_ids as string[]) ?? [];
  const currentRetryCount = (row.retry_count as number | null) ?? 0;

  // ===== 2. status='generating' =====
  await supabaseAdmin
    .from("integrated_trisetsu")
    .update({ status: "generating" })
    .eq("id", integratedTrisetsuId);

  try {
    // ===== 3. ユーザー取得 =====
    const { data: userRow, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, type_id, scores, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (userErr || !userRow) {
      throw new Error(
        `User ${userId} not found: ${userErr?.message ?? "no row"}`,
      );
    }
    const ownerName =
      ((userRow.display_name as string | null) ?? "").trim() || "あなた";

    // ===== 4. perceptions 取得 =====
    let perceptionRows: PerceptionRow[] = [];
    if (perceptionIds.length > 0) {
      const { data: ps, error: pErr } = await supabaseAdmin
        .from("friend_perceptions")
        .select(
          "id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_modifier_paragraph, perceived_scores, perceived_facet_scores",
        )
        .in("id", perceptionIds);
      if (pErr) {
        throw new Error(`friend_perceptions error: ${pErr.message}`);
      }
      perceptionRows = (ps ?? []) as PerceptionRow[];
    }

    // ===== 5. プロンプト構築 =====
    const selfData: SelfDataForPrompt | undefined = includeSelf
      ? buildSelfData(userRow)
      : undefined;
    const prompt = buildIntegratedPrompt({
      ownerName,
      includeSelf,
      selfData,
      perceptions: perceptionRows.map((p) => ({
        perceiverName: p.perceiver_name,
        perceivedFullCode: p.perceived_full_code,
        perceivedTypeName:
          torisetsuTypes[p.perceived_type_id as TorisetsuTypeId]?.name ??
          p.perceived_type_id,
        perceivedModifierLabel: p.perceived_modifier_label,
        perceivedScores: p.perceived_scores,
        perceivedFacetScores: p.perceived_facet_scores,
        perceivedModifierParagraph: p.perceived_modifier_paragraph,
      })),
    });

    // ===== 6. AI 呼び出し =====
    const aiOut = await callClaudeForIntegration({
      system: prompt.system,
      user: prompt.user,
    });

    // ===== 7. UPDATE 成功 =====
    const { error: updErr } = await supabaseAdmin
      .from("integrated_trisetsu")
      .update({
        status: "completed",
        generated_title: aiOut.title,
        generated_subtitle: aiOut.subtitle,
        generated_chapters: aiOut.chapters,
        ai_model: aiOut.model,
        ai_input_tokens: aiOut.inputTokens,
        ai_output_tokens: aiOut.outputTokens,
        ai_cost_usd: aiOut.costUsd,
      })
      .eq("id", integratedTrisetsuId);
    if (updErr) {
      throw new Error(`UPDATE on completed failed: ${updErr.message}`);
    }

    // ===== 8. LINE 通知 (DB ログのみ。実プッシュは T3-4 で) =====
    if (lineUserId) {
      await logLineMessage({
        lineUserId,
        userId,
        messageType: "integrated_complete",
        flexContent: {
          integratedId: integratedTrisetsuId,
          title: aiOut.title,
          model: aiOut.model,
          costUsd: aiOut.costUsd,
        },
        sendResult: "success",
      });
    }

    return { success: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[generator] ${integratedTrisetsuId} failed:`,
      err,
    );

    // ===== UPDATE 失敗状態 =====
    await supabaseAdmin
      .from("integrated_trisetsu")
      .update({
        status: "failed",
        failure_reason: errMsg.slice(0, 1000),
        retry_count: currentRetryCount + 1,
      })
      .eq("id", integratedTrisetsuId);

    // ===== Slack アラート =====
    await sendSlackAlert(
      "🚨 AI 統合トリセツ生成失敗 (要手動対応)",
      {
        integrated_trisetsu_id: integratedTrisetsuId,
        user_id: userId,
        line_user_id: lineUserId,
        retry_count: currentRetryCount + 1,
        error: errMsg,
      },
    );

    return { success: false, error: errMsg };
  }
}
