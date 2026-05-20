// Phase 3-β B-2: 新 30 問形式の友達評価受信エンドポイント。
// 旧 /api/friend-answer (13 問形式) は破壊せず並存。
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
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { verifyBearer } from "@/lib/liff-verify";
import {
  perceiveFromFriendAnswersV2,
  type FriendQualitativeData,
} from "@/lib/friend-perception-v2";
import { writeFriendPerception } from "@/lib/friend-perception-write";
import { FRIEND_QUESTIONS_V2_TOTAL } from "@/lib/friend-questions-v2";
import { sendFriendPerceptionReceivedMessage } from "@/lib/line-notify";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import type { AnswerValue, TorisetsuTypeId } from "@/lib/types";

export const runtime = "nodejs";

function isValidScale(value: unknown): value is AnswerValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7
  );
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  // Bearer (optional): LIFF 内で開かれていれば LINE userId を導出。
  // 失敗時でも続行 (Web ブラウザ経由 / id_token なし) → perceiver_line_user_id=null
  let perceiverLineUserId: string | null = null;
  if (request.headers.get("authorization")) {
    const v = await verifyBearer(request);
    if (v) perceiverLineUserId = v.sub;
    else
      console.warn(
        "[friend-answer/v2] Bearer present but verify failed; fallback to null",
      );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : null;
  const rawScale = body.scaleAnswers;
  const rawChoice = body.choiceAnswers;
  const rawName = typeof body.perceiverName === "string" ? body.perceiverName.trim() : "";
  const perceiverName = rawName.length > 0 ? rawName : "友達";
  // T3-3: PDF 利用同意 (オプトイン制、デフォルト false)
  const pdfConsent = body.pdfConsent === true;

  if (!inviteCode) {
    return NextResponse.json({ error: "inviteCode required" }, { status: 400 });
  }

  // scaleAnswers バリデーション: 1-30 が全て有効値 (1-7) で揃っているか
  if (!rawScale || typeof rawScale !== "object") {
    return NextResponse.json(
      { error: "scaleAnswers must be an object" },
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
  if (rawChoice && typeof rawChoice === "object") {
    for (const [k, v] of Object.entries(rawChoice as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim().length > 0) {
        choiceAnswers[k] = v;
      }
    }
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

  // friend_answers INSERT (v2 形式で jsonb 保存)
  // 旧 13 問形式と区別可能なように { v: 2, scale, choice } を採用
  const { data: faRow, error: faError } = await supabaseAdmin
    .from("friend_answers")
    .insert({
      user_id: owner.id,
      answers: {
        v: 2,
        scale: scaleAnswers,
        choice: choiceAnswers,
      },
    })
    .select("id")
    .single();
  if (faError || !faRow) {
    console.error("[friend-answer/v2] friend_answers insert error:", faError);
    return NextResponse.json({ error: "DB error (friend_answers)" }, { status: 500 });
  }

  // 派生計算
  const qualitative =
    Object.keys(choiceAnswers).length > 0 ? choiceAnswers : undefined;
  const perception = perceiveFromFriendAnswersV2(scaleAnswers, qualitative);
  if (!perception) {
    return NextResponse.json(
      { error: "perception calculation failed" },
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
      userId: null, // 評価者自身が users 行を持つかどうかは Phase 3-β 後段で対応
      lineUserId: perceiverLineUserId,
      pdfConsent, // T3-3: 友達側オプトイン制
    },
  );
  if (!writeResult.ok) {
    console.error(
      "[friend-answer/v2] writeFriendPerception failed:",
      writeResult.error,
    );
    return NextResponse.json(
      { error: "DB error (friend_perceptions)" },
      { status: 500 },
    );
  }

  // Phase 3-β D-8: owner への友達評価到着通知 (fire-and-forget)
  //   - owner.users 行から line_user_id を再取得 (owner.id しか手元にないため)
  //   - notification_preferences.enable_friend_perception !== false を確認
  //   - friend_perceptions.notified_at IS NULL を確認 (今回 insert 直後なので true)
  //   - 通知成功時に notified_at = NOW() で UPDATE
  //   - レスポンスはこの非同期処理を待たない (after() で response 送信後に実行)
  const perceptionId = writeResult.id;
  const perceiverDisplayName = perceiverName;
  const perceivedFullCode = perception.fullCode;
  const perceivedTypeId = perception.typeId as TorisetsuTypeId;
  const perceivedTypeName =
    torisetsuTypes[perceivedTypeId]?.name ?? perceivedTypeId;
  const perceivedModifierLabel = perception.modifierLabel;
  const ownerUserId = owner.id as string;

  after(async () => {
    try {
      // 1. owner の line_user_id を取得
      const { data: ownerRow, error: ownerLookupErr } = await supabaseAdmin
        .from("users")
        .select("line_user_id")
        .eq("id", ownerUserId)
        .maybeSingle();
      if (ownerLookupErr) {
        console.error(
          "[friend-answer/v2] owner lookup error:",
          ownerLookupErr.message,
        );
        return;
      }
      const ownerLineUserId = (ownerRow?.line_user_id as string | null) ?? null;
      if (!ownerLineUserId) {
        // LINE 未連携 → 何もしない
        return;
      }

      // 2. notification_preferences 確認 (行なし or true なら送信、false ならスキップ)
      const { data: prefsRow } = await supabaseAdmin
        .from("notification_preferences")
        .select("enable_friend_perception")
        .eq("line_user_id", ownerLineUserId)
        .maybeSingle();
      if (prefsRow && prefsRow.enable_friend_perception === false) {
        console.log(
          "[friend-answer/v2] notification disabled, skipping for",
          ownerLineUserId.slice(0, 8),
        );
        return;
      }

      // 3. notified_at 重複防止 (insert 直後は NULL のはずだが、race 防止)
      const { data: pRow } = await supabaseAdmin
        .from("friend_perceptions")
        .select("notified_at")
        .eq("id", perceptionId)
        .maybeSingle();
      if (pRow?.notified_at) {
        return; // 既に他のリクエストが通知済
      }

      // 4. 通知発火
      const result = await sendFriendPerceptionReceivedMessage({
        lineUserId: ownerLineUserId,
        ownerUserId,
        perceiverName: perceiverDisplayName,
        perceivedFullCode,
        perceivedTypeName,
        perceivedModifierLabel,
      });

      // 5. 成功時のみ notified_at 更新
      if (result.success) {
        const { error: updateErr } = await supabaseAdmin
          .from("friend_perceptions")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", perceptionId);
        if (updateErr) {
          console.error(
            "[friend-answer/v2] notified_at update error:",
            updateErr.message,
          );
        }
      }
    } catch (err) {
      console.error("[friend-answer/v2] D-8 notification error:", err);
    }
  });

  return NextResponse.json({
    ok: true,
    friendAnswerId: faRow.id,
    friendPerceptionId: writeResult.id,
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
