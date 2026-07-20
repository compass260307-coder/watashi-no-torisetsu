// プレミアム化 v3 Day 4: 自己診断保存 + session 発行
//
// Cookie wn_session の有無で 2 経路:
//   - 既存 session (Cookie が有効): users 行を UPDATE (option A: 同 user_id 維持)
//     friend_perceptions / integrated_trisetsu との関連を保つため、新規 INSERT は
//     しない。invite_code と owner_token は新規生成 (新しいシェア URL として使う)
//   - 新規ユーザー (Cookie なし or DB 不一致): createSession で INSERT + Cookie set
//
// Cookie 偽造 (DB に存在しない session_token) 時は getSession が null を返すため
// 自動的に新規ユーザー扱いとなり、新しい session で Cookie を上書きする。

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimit,
  isSafeOpaqueToken,
  normalizeOptionalText,
  readJsonObject,
} from "@/lib/api-security";
import { diagnose } from "@/lib/diagnosis";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { createSession, getSession } from "@/lib/session";
import { isMissingCoreKpiColumn } from "@/lib/core-kpis";
import type { AnswerValue } from "@/lib/types";

export const runtime = "nodejs";

const DIAGNOSIS_QUESTION_COUNT = 50;

function parseAnswers(value: unknown): Record<number, AnswerValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (
    keys.length !== DIAGNOSIS_QUESTION_COUNT ||
    keys.some((key) => !/^[1-9][0-9]?$/.test(key))
  ) {
    return null;
  }

  const answers: Record<number, AnswerValue> = {};
  for (let questionId = 1; questionId <= DIAGNOSIS_QUESTION_COUNT; questionId++) {
    const answer = raw[String(questionId)];
    if (
      typeof answer !== "number" ||
      !Number.isInteger(answer) ||
      answer < 1 ||
      answer > 7
    ) {
      return null;
    }
    answers[questionId] = answer as AnswerValue;
  }
  return answers;
}

// PR-FIX-3 H6: Math.random() ではなく CSPRNG (crypto.randomBytes) を使用
function generateInviteCode(): string {
  return crypto.randomBytes(8).toString("base64url");
}
function generateOwnerToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "diagnosis-submit-ip",
    limit: 6,
    windowSeconds: 600,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many diagnosis submissions. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
        },
      },
    );
  }

  const parsedBody = await readJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const locale = body.locale ?? "ja";
  if (locale !== "ja" && locale !== "ko") {
    return NextResponse.json(
      { error: "locale must be ja or ko" },
      { status: 400 },
    );
  }

  // ブラウザが送る typeId / scores は信用しない。50問の原回答から必ずサーバーで再計算する。
  const answers = parseAnswers(body.answers);
  if (!answers) {
    return NextResponse.json(
      { error: "All 50 answers must be integers from 1 to 7" },
      { status: 400 },
    );
  }
  const result = diagnose(answers);
  const {
    typeId,
    scores,
    facetScores,
    fullCode,
    cModifier,
    nModifier,
    modifierLabel,
  } = result;

  const campaign = normalizeOptionalText(body.campaign, 100);
  const acquisitionSource = normalizeOptionalText(body.acquisitionSource, 100);
  const acquisitionCampaign = normalizeOptionalText(
    body.acquisitionCampaign,
    100,
  );
  const rawSourceInviteCode = body.sourceInviteCode;
  const sourceInviteCode =
    rawSourceInviteCode === undefined || rawSourceInviteCode === null
      ? null
      : isSafeOpaqueToken(rawSourceInviteCode)
        ? rawSourceInviteCode
        : null;
  if (rawSourceInviteCode != null && !sourceInviteCode) {
    return NextResponse.json(
      { error: "Invalid source invite code" },
      { status: 400 },
    );
  }

  // Phase 1.5-α Day 12-Polish-B: 基本情報ステップで取得したニックネームを users.display_name に保存。
  // クライアント側で trim 済の想定だが、念のため API でも空白除去 + 20 文字制限。
  // 空文字 / 未指定は null (UI 上「アナタ」フォールバック)。
  const normalizedDisplayName = normalizeOptionalText(body.displayName, 20);

  // Phase 2F: scores jsonb に v2 拡張フィールドをマージ
  const persistedScores = {
    ...scores,
    ...(facetScores ? { facetScores } : {}),
    ...(fullCode ? { fullCode } : {}),
    ...(cModifier ? { cModifier } : {}),
    ...(nModifier ? { nModifier } : {}),
    ...(modifierLabel ? { modifierLabel } : {}),
  };

  const inviteCode = generateInviteCode();
  const ownerToken = generateOwnerToken();
  const diagnosisCompletedAt = new Date().toISOString();

  // sourceInviteCode が指定された場合のみ source_user_id / generation を解決。
  // 再診断時は基本的に sourceInviteCode は付かないため UPDATE 経路では使わない。
  let sourceUserId: string | null = null;
  let generation: number | null = null;
  if (sourceInviteCode) {
    const { data: sourceUser } = await supabaseAdmin
      .from("users")
      .select("id, generation")
      .eq("invite_code", sourceInviteCode)
      .single();
    if (sourceUser) {
      sourceUserId = sourceUser.id;
      generation = (sourceUser.generation ?? 0) + 1;
    }
  } else if (campaign) {
    generation = 0;
  }

  // ===== 既存 session の有無で分岐 =====
  const existing = await getSession(request);

  // ----- 既存ユーザー: UPDATE (同 user_id 維持) -----
  if (existing) {
    // Day 12-Polish-B: displayName が指定されていれば再診断時も上書き
    // (基本情報ステップでニックネーム変更を許容)。未指定 (null) なら触らない。
    const updatePayload: {
      type_id: string;
      scores: typeof persistedScores;
      invite_code: string;
      owner_token: string;
      preferred_locale: "ja" | "ko";
      diagnosis_completed_at?: string;
      display_name?: string;
    } = {
      type_id: typeId,
      scores: persistedScores,
      invite_code: inviteCode,
      owner_token: ownerToken,
      preferred_locale: locale,
      // 初回の自己診断完了をコホート起点として固定する。再診断では上書きしない。
      diagnosis_completed_at:
        existing.diagnosis_completed_at ?? diagnosisCompletedAt,
    };
    if (normalizedDisplayName !== null) {
      updatePayload.display_name = normalizedDisplayName;
    }
    const updateResult = await supabaseAdmin
      .from("users")
      .update(updatePayload)
      // campaign / source_user_id / generation / line_user_id / email /
      // email_verified_at / session_token は変更しない (再診断時の user identity を保つ)。
      .eq("id", existing.id)
      .select("id, invite_code, owner_token")
      .single();

    let savedUser = updateResult.data;
    let updateError = updateResult.error;
    if (
      isMissingCoreKpiColumn(updateError, "diagnosis_completed_at")
    ) {
      const legacyUpdatePayload = { ...updatePayload };
      delete legacyUpdatePayload.diagnosis_completed_at;
      const legacyResult = await supabaseAdmin
        .from("users")
        .update(legacyUpdatePayload)
        .eq("id", existing.id)
        .select("id, invite_code, owner_token")
        .single();
      savedUser = legacyResult.data;
      updateError = legacyResult.error;
    }

    if (updateError || !savedUser) {
      console.error(
        "[api/diagnosis] re-diagnosis UPDATE error:",
        updateError,
      );
      return NextResponse.json(
        { error: "Unable to save diagnosis" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      userId: savedUser.id,
      inviteCode: savedUser.invite_code,
      ownerToken: savedUser.owner_token,
      typeId,
      scores,
      facetScores: facetScores ?? null,
      fullCode: fullCode ?? null,
      cModifier: cModifier ?? null,
      nModifier: nModifier ?? null,
      modifierLabel: modifierLabel ?? null,
      lineLinked: !!existing.line_user_id,
      sessionMode: "updated",
      locale,
    });
  }

  // ----- 新規ユーザー: createSession で INSERT + Cookie set -----
  // Day 12-Polish-B: displayName をそのまま渡す (CreateSessionPayload.display_name は
  // optional null 許容なので空でも安全)
  try {
    const { user } = await createSession({
      type_id: typeId,
      scores: persistedScores,
      invite_code: inviteCode,
      owner_token: ownerToken,
      campaign: campaign || null,
      source_user_id: sourceUserId,
      generation,
      display_name: normalizedDisplayName,
      // Day 12-C3: 媒体/キャンペーン流入元。新規作成時のみ・無ければ NULL。
      // source_user_id / generation (招待ツリー) とは別系統で独立。
      acquisition_source: acquisitionSource,
      acquisition_campaign: acquisitionCampaign,
      acquisition_locale: locale,
      preferred_locale: locale,
      diagnosis_completed_at: diagnosisCompletedAt,
    });

    return NextResponse.json({
      userId: user.id,
      inviteCode,
      ownerToken,
      typeId,
      scores,
      facetScores: facetScores ?? null,
      fullCode: fullCode ?? null,
      cModifier: cModifier ?? null,
      nModifier: nModifier ?? null,
      modifierLabel: modifierLabel ?? null,
      lineLinked: false,
      sessionMode: "created",
      locale,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/diagnosis] createSession error:", msg);
    return NextResponse.json(
      { error: "Unable to save diagnosis" },
      { status: 500 },
    );
  }
}
