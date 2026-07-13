// プレミアム化 v3 Day 3: アカウント削除 (Web ファースト版)
//
// 削除方針:
//   - 認可: Cookie wn_session (旧: Authorization: Bearer <LIFF id_token>)
//   - session.user.id 1 件のみを削除対象とする (Web ファーストは 1 user = 1 row)
//   - CASCADE: friend_answers / friend_perceptions (target) / integrated_trisetsu
//     / line_users が users 削除で連鎖削除される
//   - users.line_user_id が設定済なら notification_preferences / feature_optins
//     を line_user_id で個別削除 (FK 無しのため明示)
//   - events は owner_token で個別削除 (FK 無し)
//   - 物理削除のみ。冪等。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.id;
  const lineUserId = session.line_user_id; // Phase 2 連携済みなら notify する

  // 削除対象 users 1 件の owner_token を取得 (events 削除に使う)
  const { data: userRow, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id, owner_token, line_user_id")
    .eq("id", userId)
    .maybeSingle();

  if (userErr) {
    console.error("[account/delete] users lookup error:", userErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!userRow) {
    return NextResponse.json({ ok: true, message: "Already deleted" });
  }

  const ownerToken = (userRow.owner_token as string | null) ?? null;
  const linkedLineUserId =
    (userRow.line_user_id as string | null) ?? lineUserId;

  const deletionCounts: Record<string, number> = {};

  console.log(
    "[account/delete] start for userId:",
    userId.slice(0, 8) + "...",
    "owner_token:",
    ownerToken ? ownerToken.slice(0, 6) + "..." : "null",
    "line_user_id:",
    linkedLineUserId ? linkedLineUserId.slice(0, 8) + "..." : "null",
  );

  // ===== 段階的削除 =====

  // a. notification_preferences (line_user_id 紐付け、Phase 2 残置テーブル)
  if (linkedLineUserId) {
    const { error, count } = await supabaseAdmin
      .from("notification_preferences")
      .delete({ count: "exact" })
      .eq("line_user_id", linkedLineUserId);
    if (error) {
      console.error("[account/delete] notification_preferences error:", error);
    }
    deletionCounts.notification_preferences = count ?? 0;
  } else {
    deletionCounts.notification_preferences = 0;
  }

  // b. feature_optins
  if (linkedLineUserId) {
    const { error, count } = await supabaseAdmin
      .from("feature_optins")
      .delete({ count: "exact" })
      .eq("line_user_id", linkedLineUserId);
    if (error) {
      console.error("[account/delete] feature_optins error:", error);
    }
    deletionCounts.feature_optins = count ?? 0;
  } else {
    deletionCounts.feature_optins = 0;
  }

  // c. events (owner_token 経由、events に line_user_id カラムは無い)
  if (ownerToken) {
    const { error, count } = await supabaseAdmin
      .from("events")
      .delete({ count: "exact" })
      .eq("owner_token", ownerToken);
    if (error) {
      console.error("[account/delete] events error:", error);
    }
    deletionCounts.events = count ?? 0;
  } else {
    deletionCounts.events = 0;
  }

  // d. users (致命扱い、失敗時 500)
  //    CASCADE で friend_answers / friend_perceptions (target) /
  //    integrated_trisetsu / line_users / magic_links が連鎖削除される。
  //    friend_perceptions.perceiver_user_id は ON DELETE SET NULL のため、
  //    削除対象ユーザーが評価した側として持つ既存 perception は perceiver_user_id
  //    だけ NULL になって残る。
  {
    const { error, count } = await supabaseAdmin
      .from("users")
      .delete({ count: "exact" })
      .eq("id", userId);
    if (error) {
      console.error("[account/delete] users (FATAL) error:", error);
      return NextResponse.json(
        {
          error: "users delete failed",
          deletionCounts,
          message:
            "部分的に削除されました。同じ操作を再実行すると残りも削除されます。",
        },
        { status: 500 },
      );
    }
    deletionCounts.users = count ?? 0;
  }

  // LINE 撤去: 削除完了の LINE 通知は廃止。

  console.log(
    "[account/delete] completed for",
    userId.slice(0, 8) + "...",
    deletionCounts,
  );

  return NextResponse.json({ ok: true, deletionCounts });
}
