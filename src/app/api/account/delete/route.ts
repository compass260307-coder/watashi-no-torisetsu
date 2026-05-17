import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";

export const runtime = "nodejs";

// Phase 3-β A-4: ユーザー操作経由のデータ削除 (本人 LIFF id_token で認証)
//
// 削除方針:
//   - 本人確認: Authorization: Bearer <LIFF id_token> → verify → sub (= lineUserId)
//   - 削除対象: その lineUserId に紐付く全データ
//       - notification_preferences (line_user_id)
//       - feature_optins (line_user_id)
//       - events (owner_token IN 全診断分)
//       - line_users (line_user_id)
//       - users (line_user_id) → CASCADE で friend_answers / friend_perceptions
//         / integrated_trisetsu / 残 line_users まで連鎖削除
//   - 物理削除のみ (論理削除フラグなし)
//   - 冪等性: 既に削除済みでも 200 を返す (各 count = 0 になるだけ)
//   - audit: 開始 / 完了を console.log、レスポンスで削除件数を返す
//
// セキュリティ:
//   - body から line_user_id を**受け取らない** (なりすまし不可)。常に id_token の sub を使用
//   - id_token 検証失敗 → 401
//
// 注意: 本 API は公開エンドポイント。LIFF を持つユーザーが自身を削除するだけのため
//       誤爆リスクは低いが、D-11 で UI に 2 段階確認を入れる前提。
export async function POST(request: NextRequest) {
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  // 削除対象 users (line_user_id で紐付く全診断履歴) の owner_token 一覧
  const { data: targetUsers, error: targetErr } = await supabaseAdmin
    .from("users")
    .select("id, owner_token")
    .eq("line_user_id", lineUserId);

  if (targetErr) {
    console.error("[account/delete] target users lookup error:", targetErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const ownerTokens = (targetUsers ?? [])
    .map((u) => u.owner_token as string | null)
    .filter((t): t is string => !!t);

  const deletionCounts: Record<string, number> = {
    target_users_found: targetUsers?.length ?? 0,
  };

  console.log(
    "[account/delete] start for lineUserId:",
    lineUserId.slice(0, 8) + "...",
    "target users:",
    deletionCounts.target_users_found,
    "owner_tokens:",
    ownerTokens.length,
  );

  // ===== 段階的削除 (a→e) =====
  // 各 DELETE は冪等。途中失敗時もログに残しつつ続行し、最後の users DELETE のみ
  // 致命扱い (失敗時 500)。途中失敗 → users 成功なら CASCADE で大半が消えるため
  // 半消し残骸が events / feature_optins 等にだけ残る最悪ケースに留まる。

  // a. notification_preferences
  {
    const { error, count } = await supabaseAdmin
      .from("notification_preferences")
      .delete({ count: "exact" })
      .eq("line_user_id", lineUserId);
    if (error) {
      console.error("[account/delete] notification_preferences error:", error);
    }
    deletionCounts.notification_preferences = count ?? 0;
  }

  // b. feature_optins
  {
    const { error, count } = await supabaseAdmin
      .from("feature_optins")
      .delete({ count: "exact" })
      .eq("line_user_id", lineUserId);
    if (error) {
      console.error("[account/delete] feature_optins error:", error);
    }
    deletionCounts.feature_optins = count ?? 0;
  }

  // c. events (owner_token 経由、line_user_id カラムは events に無い)
  //    owner_token IS NULL のグローバルイベントは個人情報を含まないため対象外。
  if (ownerTokens.length > 0) {
    const { error, count } = await supabaseAdmin
      .from("events")
      .delete({ count: "exact" })
      .in("owner_token", ownerTokens);
    if (error) {
      console.error("[account/delete] events error:", error);
    }
    deletionCounts.events = count ?? 0;
  } else {
    deletionCounts.events = 0;
  }

  // d. line_users (明示削除、users 削除前に。途中失敗時の半消し最小化)
  //    users CASCADE でも消えるが、トランザクション分離が無い環境で順序保証として明示。
  {
    const { error, count } = await supabaseAdmin
      .from("line_users")
      .delete({ count: "exact" })
      .eq("line_user_id", lineUserId);
    if (error) {
      console.error("[account/delete] line_users error:", error);
    }
    deletionCounts.line_users = count ?? 0;
  }

  // e. users (致命扱い、失敗時 500)
  //    CASCADE: friend_answers / friend_perceptions (target_user_id) /
  //    integrated_trisetsu / 残 line_users が連鎖削除される。
  //    friend_perceptions.perceiver_user_id は ON DELETE SET NULL のため、
  //    削除対象ユーザーを「他人を評価した側」として持つ既存 perception は
  //    perceiver_user_id だけ NULL になって残る (= 評価された側の図鑑は維持される)。
  {
    const { error, count } = await supabaseAdmin
      .from("users")
      .delete({ count: "exact" })
      .eq("line_user_id", lineUserId);
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

  // TODO: D-11 で実装する LINE 「削除完了」プッシュ通知
  //       (notification_preferences は既に消えているため、ここでは notify せず
  //        LINE 標準の push を直接呼ぶか、削除直前にメッセージ送るかは UI 側で決定)
  // await sendDeletionCompleteMessage(lineUserId);

  console.log(
    "[account/delete] completed for",
    lineUserId.slice(0, 8) + "...",
    deletionCounts,
  );

  return NextResponse.json({ ok: true, deletionCounts });
}
