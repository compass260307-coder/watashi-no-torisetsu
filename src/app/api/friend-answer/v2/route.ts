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
import {
  perceiveFromFriendAnswersV2,
  type FriendQualitativeData,
} from "@/lib/friend-perception-v2";
import { writeFriendPerception } from "@/lib/friend-perception-write";
import { FRIEND_QUESTIONS_V2_TOTAL } from "@/lib/friend-questions-v2";
import { sendLetterNotification } from "@/lib/line-notify";
import { sendFriendPerceptionEmail } from "@/lib/email";
import { isLineNotificationsEnabled } from "@/lib/feature-flags";
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

// 「動物に例えると」の回答は "猫（マイペース）" のような「動物名（性格）」形式。
// 手紙通知①では【動物名のみ】を出す (理由=括弧内は開封まで出さない、が大原則)。
// 全角/半角どちらの括弧でも手前で切る。未回答/空なら null。
function extractAnimalName(raw: string | undefined): string | null {
  if (!raw) return null;
  const name = raw.trim().split(/[（(]/)[0].trim();
  return name.length > 0 ? name : null;
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  // Web ファースト化により友達評価は完全に匿名扱い。
  // perceiver_line_user_id は常に null (Phase 2 で LINE 復活時に再導入)。
  const perceiverLineUserId: string | null = null;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode : null;
  const rawScale = body.scaleAnswers;
  const rawChoice = body.choiceAnswers;
  const rawName = typeof body.perceiverName === "string" ? body.perceiverName.trim() : "";
  const perceiverName = rawName.length > 0 ? rawName : "友達";
  // ③ 本人へのメッセージ (任意・最大200字)。プレーンテキストとして保存し、
  //    表示時は React が自動エスケープ (XSS 対策)。空なら null。
  const ownerMessage =
    typeof body.message === "string"
      ? body.message.trim().slice(0, 200)
      : "";
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
      const ownerLineUserId =
        (ownerRow.line_user_id as string | null) ?? null;
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

      // 2-B. LINE 手紙通知｜小出し3段階 (line_letter_notifications_v1)
      //   届いた通数 (1/2/3) で出し分け、3通目 = 開封解禁。4通目以降は軽い通知のみ。
      //   LINE_NOTIFICATIONS_ENABLED=false / line_user_id 未紐付ならスキップ。
      if (!isLineNotificationsEnabled() || !ownerLineUserId) {
        return;
      }

      // notification_preferences 確認 (Phase 2 復活時の per-feature opt-out)
      const { data: prefsRow } = await supabaseAdmin
        .from("notification_preferences")
        .select("enable_friend_perception")
        .eq("line_user_id", ownerLineUserId)
        .maybeSingle();
      if (prefsRow && prefsRow.enable_friend_perception === false) {
        console.log(
          "[friend-answer/v2] LINE notification disabled by user pref, skipping for",
          ownerLineUserId.slice(0, 8),
        );
        return;
      }

      if (!ownerToken) return;

      // 届いた友達回答の総数 (owner ごと)
      const { count: friendCount, error: countErr } = await supabaseAdmin
        .from("friend_answers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", ownerUserId);
      if (countErr || friendCount === null) {
        console.error(
          "[friend-answer/v2] friend_answers count error:",
          countErr?.message,
        );
        return;
      }
      if (friendCount < 1) return;

      // 冪等ガード: last_notified_friend_count < friendCount のときだけ UPDATE 成功。
      //   同一 count に同時到達しても最初の 1 件だけが通知され、二重 push を防ぐ。
      //   (旧 /api/friend-answer の H8 race condition 対策パターンを踏襲)
      const { data: gateRow, error: gateErr } = await supabaseAdmin
        .from("users")
        .update({ last_notified_friend_count: friendCount })
        .eq("owner_token", ownerToken)
        .lt("last_notified_friend_count", friendCount)
        .select("owner_token")
        .maybeSingle();
      if (gateErr) {
        console.error(
          "[friend-answer/v2] last_notified_friend_count update error:",
          gateErr.message,
        );
        return;
      }
      if (!gateRow) {
        // 別リクエストが先に同 count を通知済み → スキップ
        return;
      }

      // 表示用: 友達名 (created_at 昇順) と 1通目の動物 (動物名のみ)
      const { data: perceptionRows } = await supabaseAdmin
        .from("friend_perceptions")
        .select("perceiver_name")
        .eq("target_user_id", ownerUserId)
        .order("created_at", { ascending: true });
      const friendNames = (perceptionRows ?? []).map((r) =>
        ((r.perceiver_name as string | null) ?? "").trim(),
      );

      await sendLetterNotification({
        lineUserId: ownerLineUserId,
        ownerUserId,
        ownerToken,
        inviteCode,
        friendCount,
        friendNames,
        animal: extractAnimalName(choiceAnswers.animal),
      });
    } catch (err) {
      console.error("[friend-answer/v2] notification flow error:", err);
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
