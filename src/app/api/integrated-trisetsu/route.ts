// Phase 3-β リリース 3 C-1: AI 統合トリセツ生成エンドポイント
// プレミアム化 v2 (Week 1 T1-4): Opus 4.7 + 7 章スキーマ + status 管理に対応
//
// POST /api/integrated-trisetsu
//   - Authorization: Bearer <LIFF id_token> 必須
//   - body: { perception_ids: string[], include_self?: boolean (default true) }
//   - 自分の current users 行特定 → perception 検証 → Claude 呼び出し → INSERT
//
// 認可:
//   - verifyBearer で line_user_id 導出
//   - line_users.current_owner_token から自分の最新 users 行を特定
//   - perception_ids が全て「自分の users (履歴含む) の target_user_id か」を検証
//     (他人の perception を統合素材にできないように)
//
// status 遷移 (T1-4 時点):
//   - AI 成功 → INSERT (status='completed', generated_chapters 等を保存)
//   - AI 失敗 (config 以外) → INSERT (status='failed', failure_reason 記録) + 500
//   - AI 失敗 (config) → INSERT なし + 500 ("API key not configured")
//   - 'generating' 中間状態は T2 の Polling 設計で扱う想定 (T1-4 では未使用)
//
// AI 失敗時:
//   - ANTHROPIC_API_KEY 未設定 → 500 "API key not configured" (DB 書込なし)
//   - SDK エラー (401 / rate limit / network) → INSERT(failed) + 500 + integrated_trisetsu_id
//   - JSON 抽出失敗 (リトライ込みで失敗) → INSERT(failed) + 500 + integrated_trisetsu_id
//   - DB INSERT 失敗 → 500 + aiAlreadyCalled (コスト追跡用)

import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";
import { buildIntegratedPrompt } from "@/lib/ai-prompt-builder";
import {
  AnthropicNotConfiguredError,
  callClaudeForIntegration,
  type IntegratedAiOutput,
} from "@/lib/anthropic-client";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import {
  buildFullCode as buildFullCodeFromIds,
  classifyModifier,
} from "@/lib/diagnosis";
import { getModifierLabel, getModifierParagraph } from "@/lib/modifier-data";
import { logLineMessage } from "@/lib/line-notify";
import type {
  BigFiveDimension,
  CModifier,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

export const runtime = "nodejs";
// プレミアム化 v2: Opus 4.7 + 5,000-6,000 字生成で 30-90 秒かかる想定
// (Vercel Pro / Fluid Compute 前提、Hobby プランでは動作しない)
export const maxDuration = 120;

type StoredSelfScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
  facetScores?: Record<FacetId, number>;
};

type PerceptionRow = {
  id: string;
  target_user_id: string;
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

function buildSelfData(
  userRow: {
    type_id: unknown;
    scores: unknown;
  },
): SelfDataForPrompt {
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
  const modifierParagraph = getModifierParagraph(typeId, cModifier, nModifier);
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

export async function POST(request: NextRequest) {
  // ===== 認可 =====
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  // ===== body parse =====
  let body: { perception_ids?: unknown; include_self?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const includeSelf = body.include_self !== false; // default true
  const perceptionIds: string[] = Array.isArray(body.perception_ids)
    ? body.perception_ids.filter((v): v is string => typeof v === "string")
    : [];

  if (!includeSelf && perceptionIds.length === 0) {
    return NextResponse.json(
      { error: "include_self=false の場合、perception_ids を 1 件以上指定してください" },
      { status: 400 },
    );
  }

  // ===== 自分の current users 行特定 =====
  const { data: lineUserRow, error: lineUserErr } = await supabaseAdmin
    .from("line_users")
    .select("current_owner_token, owner_token")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (lineUserErr) {
    console.error("[integrated-trisetsu] line_users lookup error:", lineUserErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const currentOwnerToken =
    lineUserRow?.current_owner_token ?? lineUserRow?.owner_token ?? null;
  if (!currentOwnerToken) {
    return NextResponse.json(
      { error: "LINE 連携が完了していません" },
      { status: 400 },
    );
  }

  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, type_id, scores, display_name")
    .eq("owner_token", currentOwnerToken)
    .maybeSingle();
  if (userErr || !userRow) {
    console.error("[integrated-trisetsu] users lookup error:", userErr);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userId = userRow.id as string;
  const ownerName =
    ((userRow.display_name as string | null) ?? "").trim() || "あなた";

  // ===== 自分の全 users.id 取得 (再診断履歴含む、perception 検証用) =====
  // 🔴 致命バグ修正 (2026-05-18 続き): /api/zukan-mine と同じく
  //   users.line_user_id 直接 + line_users.owner_token 経由の OR フォールバック。
  //   users.line_user_id = NULL のまま放置された古いユーザーでも、line_users 経由で
  //   自分の users 行を全部拾える (再診断履歴含む)。これにより /zukan-mine で
  //   表示されていた perception が「他人の」と誤判定されて 403 になる事故を防ぐ。
  const ownerTokensFromLineUsers: string[] = [];
  {
    const { data: lineUsersAll } = await supabaseAdmin
      .from("line_users")
      .select("owner_token, current_owner_token")
      .eq("line_user_id", lineUserId);
    for (const r of lineUsersAll ?? []) {
      const ot = (r.owner_token as string | null) ?? null;
      const cot = (r.current_owner_token as string | null) ?? null;
      if (ot) ownerTokensFromLineUsers.push(ot);
      if (cot && cot !== ot) ownerTokensFromLineUsers.push(cot);
    }
  }
  const uniqOwnerTokens = Array.from(new Set(ownerTokensFromLineUsers));

  let allMyUsersQuery = supabaseAdmin.from("users").select("id");
  if (uniqOwnerTokens.length > 0) {
    const ownerList = uniqOwnerTokens.map((t) => `"${t}"`).join(",");
    allMyUsersQuery = allMyUsersQuery.or(
      `line_user_id.eq.${lineUserId},owner_token.in.(${ownerList})`,
    );
  } else {
    allMyUsersQuery = allMyUsersQuery.eq("line_user_id", lineUserId);
  }
  const { data: allMyUsers } = await allMyUsersQuery;
  const allMyUserIds = (allMyUsers ?? []).map((u) => u.id as string);
  // 安全のため current も明示的に含める
  if (!allMyUserIds.includes(userId)) allMyUserIds.push(userId);

  // ===== perception_ids 取得 + 検証 =====
  let perceptionRows: PerceptionRow[] = [];
  if (perceptionIds.length > 0) {
    const { data: ps, error: pErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select(
        "id, target_user_id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_modifier_paragraph, perceived_scores, perceived_facet_scores",
      )
      .in("id", perceptionIds);
    if (pErr) {
      console.error("[integrated-trisetsu] perceptions lookup error:", pErr);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    perceptionRows = (ps ?? []) as PerceptionRow[];

    if (perceptionRows.length !== perceptionIds.length) {
      return NextResponse.json(
        { error: "一部の perception_id が見つかりません" },
        { status: 404 },
      );
    }

    const invalid = perceptionRows.find(
      (p) => !allMyUserIds.includes(p.target_user_id),
    );
    if (invalid) {
      return NextResponse.json(
        { error: "他人の perception_id は統合素材にできません" },
        { status: 403 },
      );
    }
  }

  // ===== selfData 構築 =====
  const selfData: SelfDataForPrompt | undefined = includeSelf
    ? buildSelfData(userRow)
    : undefined;

  // ===== プロンプト構築 =====
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

  // ===== AI 呼び出し =====
  // config エラーは DB に何も残さず即時 500。
  // それ以外の失敗 (parse / network / 401 / 429 等) は failed 行を残してから 500。
  let aiOut: IntegratedAiOutput | null = null;
  let aiFailureReason: string | null = null;
  try {
    aiOut = await callClaudeForIntegration({
      system: prompt.system,
      user: prompt.user,
    });
  } catch (err) {
    if (err instanceof AnthropicNotConfiguredError) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 },
      );
    }
    aiFailureReason = err instanceof Error ? err.message : String(err);
    console.error("[integrated-trisetsu] AI call error:", err);
  }

  // ===== integrated_trisetsu INSERT =====
  // 成功・失敗どちらも 1 行残す (失敗時は T2 の Slack アラート + 手動返金フローで使う)。
  const sourceSummary = {
    self:
      includeSelf && selfData
        ? { fullCode: selfData.fullCode, name: ownerName }
        : null,
    perceptions: perceptionRows.map((p) => ({
      name: p.perceiver_name,
      fullCode: p.perceived_full_code,
    })),
  };

  const baseInsert = {
    user_id: userId,
    line_user_id: lineUserId,
    include_self: includeSelf,
    perception_ids: perceptionIds,
    source_summary: sourceSummary,
  };
  const insertPayload = aiOut
    ? {
        ...baseInsert,
        status: "completed",
        generated_title: aiOut.title,
        generated_subtitle: aiOut.subtitle,
        generated_chapters: aiOut.chapters,
        ai_model: aiOut.model,
        ai_input_tokens: aiOut.inputTokens,
        ai_output_tokens: aiOut.outputTokens,
        ai_cost_usd: aiOut.costUsd,
      }
    : {
        ...baseInsert,
        status: "failed",
        failure_reason: aiFailureReason,
      };

  const { data: insertRow, error: insertErr } = await supabaseAdmin
    .from("integrated_trisetsu")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertErr || !insertRow) {
    console.error(
      "[integrated-trisetsu] insert error:",
      insertErr,
      aiOut
        ? { aiAlreadyCalled: true, aiCostUsd: aiOut.costUsd, model: aiOut.model }
        : { aiFailureReason },
    );
    return NextResponse.json(
      {
        error: "DB insert failed",
        aiAlreadyCalled: Boolean(aiOut),
        ...(aiOut ? { aiCostUsd: aiOut.costUsd } : {}),
      },
      { status: 500 },
    );
  }

  const integratedId = insertRow.id as string;

  // ===== AI 失敗時はここで 500 を返す (DB には failed 行が残っている) =====
  if (!aiOut) {
    return NextResponse.json(
      {
        error: "AI 生成に失敗しました",
        detail: aiFailureReason,
        integrated_trisetsu_id: integratedId,
        status: "failed",
      },
      { status: 500 },
    );
  }

  // ===== line_messages_sent 記録 (response 送信後、成功時のみ) =====
  const aiOutForLog = aiOut;
  after(async () => {
    await logLineMessage({
      lineUserId,
      userId,
      messageType: "integrated_complete",
      flexContent: {
        integratedId,
        title: aiOutForLog.title,
        model: aiOutForLog.model,
        costUsd: aiOutForLog.costUsd,
      },
      sendResult: "success",
    });
  });

  return NextResponse.json({
    ok: true,
    integrated_trisetsu_id: integratedId,
    redirect_to: `/integrated/${integratedId}`,
  });
}
