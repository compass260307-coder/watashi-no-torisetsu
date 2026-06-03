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
import { classifySixteenType, sixteenTypes } from "./sixteen-types";
import {
  buildFullCode as buildFullCodeFromIds,
  classifyModifier,
} from "./diagnosis";
import { getModifierLabel, getModifierParagraph } from "./modifier-data";
import {
  sendIntegratedCompletePaidMessage,
  sendIntegratedFailedMessage,
} from "./line-notify";
import { sendTrisetsuCompleteEmail } from "./email";
import { sendSlackAlert } from "./slack-alert";
import { isLineNotificationsEnabled } from "./feature-flags";
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
  const stored = (userRow.scores ?? {}) as StoredSelfScores;
  // Day 12-D: 自己タイプ名は 16 タイプ (scores から派生)
  const typeName = sixteenTypes[classifySixteenType(stored)].name;
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
      .select("id, type_id, scores, display_name, email, owner_token")
      .eq("id", userId)
      .maybeSingle();
    if (userErr || !userRow) {
      throw new Error(
        `User ${userId} not found: ${userErr?.message ?? "no row"}`,
      );
    }
    const ownerName =
      ((userRow.display_name as string | null) ?? "").trim() || "あなた";
    const ownerEmail = (userRow.email as string | null) ?? null;
    const ownerToken = (userRow.owner_token as string | null) ?? null;

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
        // Day 12-D: 知覚タイプ名は 16 タイプ (perceived_scores から派生)
        perceivedTypeName:
          sixteenTypes[
            classifySixteenType(
              (p.perceived_scores ?? {}) as Partial<
                Record<BigFiveDimension, number>
              >,
            )
          ].name,
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

    // ===== 8. LINE 完了通知 (Phase 2 復活時用、Day 10 で feature flag 抑止) =====
    //   payment 経由 (Webhook 由来) / 既存 API 経由 どちらの整合トリセツでも
    //   line_user_id が紐付いていれば実プッシュ。本関数は両経路から呼ばれる。
    //   Day 10: LINE_NOTIFICATIONS_ENABLED=false (Phase 1 default) では何もしない。
    if (isLineNotificationsEnabled() && lineUserId) {
      try {
        await sendIntegratedCompletePaidMessage({
          lineUserId,
          integratedId: integratedTrisetsuId,
          title: aiOut.title,
          subtitle: aiOut.subtitle,
          ownerUserId: userId,
          ownerName,
          aiModel: aiOut.model,
          aiCostUsd: aiOut.costUsd,
        });
      } catch (err) {
        // 通知失敗は生成成功を覆さない (logLineMessage に内部で記録される)
        console.error(
          `[generator] LINE complete notification failed for ${integratedTrisetsuId}:`,
          err,
        );
      }
    }

    // ===== 9. Day 7: メール完了通知 (Web ファースト主動線) =====
    //   users.email が設定済みなら Resend で送信 (sendTrisetsuCompleteEmail 内で
    //   RESEND_API_KEY 未設定なら no-op になるため、dev 環境でも安全)。
    //   失敗時は console.error に残し、生成成功は覆さない。
    if (ownerEmail && ownerToken) {
      try {
        await sendTrisetsuCompleteEmail({
          to: ownerEmail,
          ownerToken,
          ownerName: ownerName === "あなた" ? null : ownerName,
          title: aiOut.title,
        });
      } catch (err) {
        console.error(
          `[generator] email complete notification failed for ${integratedTrisetsuId}:`,
          err,
        );
      }
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

    // ===== Slack アラート (運営者向け) =====
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

    // ===== LINE 失敗通知 (Phase 2 復活時用、Day 10 で feature flag 抑止) =====
    // 購入者には実プッシュで「サポートに連絡してください」を送る。
    // Day 10: LINE_NOTIFICATIONS_ENABLED=false (Phase 1 default) では何もしない。
    if (isLineNotificationsEnabled() && lineUserId) {
      try {
        await sendIntegratedFailedMessage({
          lineUserId,
          integratedId: integratedTrisetsuId,
          ownerUserId: userId,
          failureReason: errMsg,
        });
      } catch (notifyErr) {
        console.error(
          `[generator] LINE failure notification failed for ${integratedTrisetsuId}:`,
          notifyErr,
        );
      }
    }

    return { success: false, error: errMsg };
  }
}
