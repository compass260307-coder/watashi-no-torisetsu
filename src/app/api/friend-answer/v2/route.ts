// Phase 3-β B-2: 30 問形式の友達評価受信エンドポイント (2026-07-18: 1人×30問で完結)。
// 旧 /api/friend-answer (13 問形式) は任意JSON保存を防ぐため410で停止済み。
//
// 受信内容:
//   - inviteCode: invite_code → users (owner) 特定
//   - scaleAnswers: Record<1..30, 1..7>
//   - choiceAnswers: Record<"favorite_point"|"animal"|"impression_scene", string> (任意、スキップ可)
//   - perceiverName: 評価者の表示名 (LIFF or 任意入力)
//   - perceiverLineUserId: Authorization: Bearer <LIFF id_token> から verify (任意)
//
// 処理:
//   1. checkOrigin / Bearer (optional) verify
//   2. invite_code → users (owner) 取得
//   3. friend_answers INSERT (新形式 { v: 2, scale, choice } で jsonb 保存)
//   4. A-5 perceiveFromFriendAnswersV2 で派生計算
//   5. A-5 writeFriendPerception で friend_perceptions INSERT
//   6. perception を返却 (B-3 完成画面で表示)
//   7. D-8 通知発火は枠のみ (Phase 4 で本実装)

import { NextRequest, NextResponse, after } from "next/server";
import {
  consumeRateLimit,
  createSubmissionFingerprint,
  isSafeOpaqueToken,
  readJsonObject,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import {
  perceiveFromFriendAnswersV2,
  type FriendQualitativeData,
} from "@/lib/friend-perception-v2";
import { writeFriendPerception } from "@/lib/friend-perception-write";
import { getSession, SESSION_COOKIE_NAME } from "@/lib/session";
import {
  FRIEND_CHOICE_QUESTIONS_V2,
  FRIEND_QUESTIONS_V2_TOTAL,
} from "@/lib/friend-questions-v2";
import { sendFriendPerceptionEmail } from "@/lib/email";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { AnswerValue, TorisetsuTypeId } from "@/lib/types";

export const runtime = "nodejs";

type CalculatedPerception = NonNullable<
  ReturnType<typeof perceiveFromFriendAnswersV2>
>;

const CHOICE_OPTIONS = new Map(
  FRIEND_CHOICE_QUESTIONS_V2.map((question) => [
    question.id,
    new Set<string>(question.options),
  ]),
);

function successResponse(
  friendAnswerId: string,
  friendPerceptionId: string,
  perception: CalculatedPerception,
  duplicate = false,
) {
  return NextResponse.json({
    ok: true,
    duplicate,
    friendAnswerId,
    friendPerceptionId,
    perception: {
      typeId: perception.typeId,
      cModifier: perception.cModifier,
      nModifier: perception.nModifier,
      fullCode: perception.fullCode,
      modifierLabel: perception.modifierLabel,
      modifierParagraph: perception.modifierParagraph,
      scores: perception.scores,
      facetScores: perception.facetScores,
      confidence: perception.confidence,
      qualitativeData: perception.qualitativeData ?? null,
    },
  });
}

function isMissingSubmissionHashColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /submission_hash.*(does not exist|could not find)|could not find.*submission_hash/i.test(
      error.message ?? "",
    )
  );
}

function isValidScale(value: unknown): value is AnswerValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7
  );
}

// 「動物に例えると」の回答は "猫（マイペース）" のような「動物名（性格）」形式。
// 手紙通知①では【動物名のみ】を出す (理由=括弧内は開封まで出さない、が大原則)。
// 全角/半角どちらの括弧でも手前で切る。未回答/空なら null。
export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const ipLimit = await consumeRateLimit(request, {
    scope: "friend-answer-ip",
    limit: 15,
    windowSeconds: 600,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(ipLimit.retryAfterSeconds ?? 60) },
      },
    );
  }

  // Web ファースト化により友達評価は完全に匿名扱い。
  // perceiver_line_user_id は常に null (Phase 2 で LINE 復活時に再導入)。
  const perceiverLineUserId: string | null = null;

  const parsedBody = await readJsonObject(request, 16 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;

  const inviteCode = isSafeOpaqueToken(body.inviteCode)
    ? body.inviteCode
    : null;
  const rawScale = body.scaleAnswers;
  const rawChoice = body.choiceAnswers;
  const rawName =
    typeof body.perceiverName === "string" ? body.perceiverName.trim() : "";
  if (rawName.length > 40 || /[\u0000-\u001F\u007F]/.test(rawName)) {
    return NextResponse.json(
      { error: "perceiverName is invalid" },
      { status: 400 },
    );
  }
  const perceiverName = rawName.length > 0 ? rawName : "友達";
  // ③ 本人へのメッセージ (任意・最大200字)。プレーンテキストとして保存し、
  //    表示時は React が自動エスケープ (XSS 対策)。空なら null。
  const ownerMessage =
    typeof body.message === "string" ? body.message.trim() : "";
  if (
    ownerMessage.length > 200 ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(ownerMessage)
  ) {
    return NextResponse.json(
      { error: "message must be 200 characters or fewer" },
      { status: 400 },
    );
  }
  // T3-3: PDF 利用同意 (オプトイン制、デフォルト false)
  const pdfConsent = body.pdfConsent === true;

  if (!inviteCode) {
    return NextResponse.json({ error: "inviteCode required" }, { status: 400 });
  }

  // scaleAnswers バリデーション: 1-30 が全て有効値 (1-7) で揃っているか
  if (!rawScale || typeof rawScale !== "object" || Array.isArray(rawScale)) {
    return NextResponse.json(
      { error: "scaleAnswers must be an object" },
      { status: 400 },
    );
  }
  const rawScaleKeys = Object.keys(rawScale);
  if (
    rawScaleKeys.length !== FRIEND_QUESTIONS_V2_TOTAL ||
    rawScaleKeys.some((key) => !/^[1-9][0-9]?$/.test(key))
  ) {
    return NextResponse.json(
      { error: "scaleAnswers contains unexpected questions" },
      { status: 400 },
    );
  }
  const scaleAnswers: Record<number, AnswerValue> = {};
  for (let qId = 1; qId <= FRIEND_QUESTIONS_V2_TOTAL; qId++) {
    const v = (rawScale as Record<string, unknown>)[String(qId)];
    if (!isValidScale(v)) {
      return NextResponse.json(
        { error: `scaleAnswers[${qId}] missing or invalid (expect 1-7)` },
        { status: 400 },
      );
    }
    scaleAnswers[qId] = v;
  }

  // choiceAnswers (optional, 各キー任意)
  const choiceAnswers: FriendQualitativeData = {};
  if (
    rawChoice !== undefined &&
    rawChoice !== null &&
    (typeof rawChoice !== "object" || Array.isArray(rawChoice))
  ) {
    return NextResponse.json(
      { error: "choiceAnswers must be an object" },
      { status: 400 },
    );
  }
  if (rawChoice && typeof rawChoice === "object") {
    for (const [k, v] of Object.entries(rawChoice as Record<string, unknown>)) {
      const allowedOptions = CHOICE_OPTIONS.get(
        k as (typeof FRIEND_CHOICE_QUESTIONS_V2)[number]["id"],
      );
      if (!allowedOptions || typeof v !== "string" || !allowedOptions.has(v)) {
        return NextResponse.json(
          { error: "choiceAnswers contains an invalid option" },
          { status: 400 },
        );
      }
      choiceAnswers[k] = v;
    }
  }

  const inviteLimit = await consumeRateLimit(request, {
    scope: "friend-answer-invite",
    identifier: inviteCode,
    limit: 120,
    windowSeconds: 3600,
  });
  if (!inviteLimit.allowed) {
    return NextResponse.json(
      { error: "This invitation is receiving too many submissions" },
      {
        status: 429,
        headers: {
          "Retry-After": String(inviteLimit.retryAfterSeconds ?? 300),
        },
      },
    );
  }

  // invite_code → users (owner) 取得
  const { data: owner, error: ownerError } = await supabaseAdmin
    .from("users")
    .select("id, owner_token")
    .eq("invite_code", inviteCode)
    .single();
  if (ownerError || !owner) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 派生値は受信せず、検証済みの回答からサーバーで計算する。
  const qualitative =
    Object.keys(choiceAnswers).length > 0 ? choiceAnswers : undefined;
  const perception = perceiveFromFriendAnswersV2(scaleAnswers, qualitative);
  if (!perception) {
    return NextResponse.json(
      { error: "perception calculation failed" },
      { status: 500 },
    );
  }

  const submissionHash = createSubmissionFingerprint(
    request,
    `friend-answer:${owner.id}`,
    JSON.stringify({
      scale: scaleAnswers,
      choice: choiceAnswers,
      perceiverName,
      message: ownerMessage,
      pdfConsent,
    }),
  );

  // friend_answers INSERT (v2 形式で jsonb 保存)
  // 旧 13 問形式と区別可能なように { v: 2, scale, choice } を採用
  const answerPayload = {
    user_id: owner.id,
    answers: {
      v: 2,
      scale: scaleAnswers,
      choice: choiceAnswers,
    },
    submission_hash: submissionHash,
  };
  let { data: faRow, error: faError } = await supabaseAdmin
    .from("friend_answers")
    .insert(answerPayload)
    .select("id")
    .single();

  // マイグレーション適用前でも回答導線を止めない。適用後はこのfallbackを通らない。
  if (faError && isMissingSubmissionHashColumn(faError)) {
    console.warn(
      "[friend-answer/v2] submission_hash is unavailable; dedupe is disabled",
    );
    const fallback = await supabaseAdmin
      .from("friend_answers")
      .insert({
        user_id: answerPayload.user_id,
        answers: answerPayload.answers,
      })
      .select("id")
      .single();
    faRow = fallback.data;
    faError = fallback.error;
  }

  // DB一意制約に当たった場合は、最初の成功結果を再利用してメールも再送しない。
  if (faError?.code === "23505") {
    const { data: existingAnswer } = await supabaseAdmin
      .from("friend_answers")
      .select("id")
      .eq("user_id", owner.id)
      .eq("submission_hash", submissionHash)
      .maybeSingle();
    if (existingAnswer?.id) {
      const { data: existingPerception } = await supabaseAdmin
        .from("friend_perceptions")
        .select("id")
        .eq("friend_answer_id", existingAnswer.id)
        .maybeSingle();
      if (existingPerception?.id) {
        return successResponse(
          existingAnswer.id as string,
          existingPerception.id as string,
          perception,
          true,
        );
      }
    }
    return NextResponse.json(
      { error: "This submission is already being processed" },
      { status: 409, headers: { "Retry-After": "2" } },
    );
  }
  if (faError || !faRow) {
    console.error("[friend-answer/v2] friend_answers insert error:", faError);
    return NextResponse.json(
      { error: "Unable to save friend answer" },
      { status: 500 },
    );
  }

  // friend_perceptions INSERT
  const writeResult = await writeFriendPerception(
    owner.id as string,
    faRow.id as string,
    perception,
    {
      name: perceiverName,
      // INSERT 時点は null 固定 (クリティカルパスを最短に保つ)。回答者が自己診断済みなら
      // レスポンス後の after() で perceiver_user_id を後追い UPDATE する (下記)。
      userId: null,
      lineUserId: perceiverLineUserId,
      pdfConsent, // T3-3: 友達側オプトイン制
    },
  );
  if (!writeResult.ok) {
    console.error(
      "[friend-answer/v2] writeFriendPerception failed:",
      writeResult.error,
    );
    // 2段目の保存失敗時に生回答だけを残さず、同じ回答を安全に再送できるようにする。
    const { error: cleanupError } = await supabaseAdmin
      .from("friend_answers")
      .delete()
      .eq("id", faRow.id);
    if (cleanupError) {
      console.error(
        "[friend-answer/v2] orphan friend_answer cleanup failed:",
        cleanupError.message,
      );
    }
    return NextResponse.json(
      { error: "DB error (friend_perceptions)" },
      { status: 500 },
    );
  }

  // ③ メッセージは best-effort で更新 (owner_message カラム未適用でも本体送信は壊さない)。
  //    migration 適用後に保存が有効化される。
  if (ownerMessage.length > 0) {
    try {
      const { error: msgErr } = await supabaseAdmin
        .from("friend_perceptions")
        .update({ owner_message: ownerMessage })
        .eq("id", writeResult.id);
      if (msgErr) {
        console.warn(
          "[friend-answer/v2] owner_message update skipped (column may be missing):",
          msgErr.message,
        );
      }
    } catch (e) {
      console.warn("[friend-answer/v2] owner_message update threw:", e);
    }
  }

  // perceiver_user_id 捕捉 (Path1 相性ループ用)。回答者自身も自己診断済み (= wn_session 保持)
  // なら、その users.id を後追いで刻む。★クリティカルパス(回答書込)からは外す:
  //   getSession + UPDATE はレスポンス送出後の after() で実行し、遅延/失敗が回答完了に
  //   一切影響しないようにする (INSERT 件数・カウントは不変)。捕捉漏れは warn で観測可能に。
  // ★セキュリティ非干渉: レート制限/本文検証/二重送信抑止は全て通過済みの成功パスでのみ実行し、
  //   perceiver id はクライアント値を受けずサーバ検証済みセッションから導出する (改ざん不可)。
  const perceptionIdForCapture = writeResult.id;
  const ownerIdForCapture = owner.id as string;
  // 未ログイン(トークン無し)は正常系。トークンはあったのに解決不可 = 捕捉漏れとして観測する。
  const hadSessionToken = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  after(async () => {
    let perceiver: Awaited<ReturnType<typeof getSession>> = null;
    try {
      perceiver = await getSession(request);
    } catch (e) {
      // 例外/タイムアウトで捕捉できなかったケースを観測 (回答自体は既に成功済み)。
      console.warn(
        "[friend-answer/v2] perceiver session read threw (capture skipped):",
        e,
      );
      return;
    }
    if (!perceiver) {
      if (hadSessionToken) {
        // ログイン状態だったのに捕捉できなかった割合を後から追えるように残す。
        console.warn(
          "[friend-answer/v2] had session token but no perceiver resolved (Path1 capture miss)",
        );
      }
      return;
    }
    // owner除外ガード: 自分で自分に答えた場合は id を刻まない (自己相性は退化・/aisho で a===b 無効)。
    if (perceiver.id === ownerIdForCapture) return;
    const { error: capErr } = await supabaseAdmin
      .from("friend_perceptions")
      .update({ perceiver_user_id: perceiver.id })
      .eq("id", perceptionIdForCapture);
    if (capErr) {
      console.warn(
        "[friend-answer/v2] perceiver_user_id capture update failed:",
        capErr.message,
      );
    }
  });

  // owner への友達評価到着通知 (fire-and-forget、メール + LINE 並列)
  //
  // Phase 1 (Web ファースト主動線): owner.email がある場合のみ Resend メール送信。
  // Phase 2 復活時 (LINE_NOTIFICATIONS_ENABLED=true) は LINE 手紙通知も並列発火。
  // 両者は独立、片方の失敗は他方に影響しない。
  // LINE は「小出し3段階」(line_letter_notifications_v1)。届いた通数で 1/2/3 を出し分け、
  // 冪等は users.last_notified_friend_count の条件付き UPDATE で担保する。
  const perceiverDisplayName = perceiverName;
  const perceivedTypeId = perception.typeId as TorisetsuTypeId;
  const perceivedTypeName =
    torisetsuTypes[perceivedTypeId]?.name ?? perceivedTypeId;
  const perceivedModifierLabel = perception.modifierLabel;
  const ownerUserId = owner.id as string;

  const notificationLimit = await consumeRateLimit(request, {
    scope: "friend-answer-email-owner",
    identifier: ownerUserId,
    limit: 12,
    windowSeconds: 3600,
  });

  if (notificationLimit.allowed) {
    after(async () => {
      try {
        // 1. owner の連絡先候補 (email + line_user_id + display_name + owner_token) を取得
        const { data: ownerRow, error: ownerLookupErr } = await supabaseAdmin
          .from("users")
          .select("email, line_user_id, display_name, owner_token")
          .eq("id", ownerUserId)
          .maybeSingle();
        if (ownerLookupErr) {
          console.error(
            "[friend-answer/v2] owner lookup error:",
            ownerLookupErr.message,
          );
          return;
        }
        if (!ownerRow) return;

        const ownerEmail = (ownerRow.email as string | null) ?? null;
        const ownerDisplayName =
          ((ownerRow.display_name as string | null) ?? "").trim() || null;
        const ownerToken = (ownerRow.owner_token as string | null) ?? null;

        // 2-A. メール通知 (Day 11、Phase 1 主動線)
        //   owner.email がある場合のみ送信。LINE と並列・独立。
        if (ownerEmail && ownerToken) {
          try {
            await sendFriendPerceptionEmail({
              to: ownerEmail,
              perceiverName: perceiverDisplayName,
              ownerName: ownerDisplayName,
              ownerToken,
              perceptionType: perceivedTypeName,
              perceptionModifierLabel: perceivedModifierLabel,
            });
          } catch (err) {
            console.error(
              "[friend-answer/v2] friend_perception email send error:",
              err,
            );
          }
        } else {
          console.log(
            "[friend-answer/v2] owner has no email; skipping mail notify",
          );
        }

        // LINE 撤去: 友達回答の LINE 手紙通知 (2-B) は廃止。メール通知 (2-A) のみ。
      } catch (err) {
        console.error("[friend-answer/v2] notification flow error:", err);
      }
    });
  } else {
    console.warn(
      "[friend-answer/v2] email notification skipped by rate limit",
    );
  }

  return successResponse(faRow.id as string, writeResult.id, perception);
}
