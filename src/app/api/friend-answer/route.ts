import { supabaseAdmin } from "@/lib/supabase-server";
import { notifyFriendAnswered } from "@/lib/line-notify";
import { checkOrigin } from "@/lib/origin-check";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const body = await request.json();
  const { inviteCode, answers } = body;

  if (!inviteCode || !answers) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, owner_token")
    .eq("invite_code", inviteCode)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("friend_answers")
    .insert({ user_id: user.id, answers });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (user.owner_token) {
    const { count } = await supabaseAdmin
      .from("friend_answers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count !== null && count >= 1 && count <= 3) {
      // PR-FIX-3 H8: race condition 対策。
      // 条件付き UPDATE: last_notified_friend_count < count のときだけ更新成功。
      // 同時に同じ count に到達した場合、最初の 1 件だけが更新成功し、
      // それ以降は select 結果が空 (= updated null) になって通知が二重送信されない。
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("users")
        .update({ last_notified_friend_count: count })
        .eq("owner_token", user.owner_token)
        .lt("last_notified_friend_count", count)
        .select("owner_token")
        .maybeSingle();

      if (updateError) {
        console.error("last_notified_friend_count update error:", updateError);
      } else if (updated) {
        // fire-and-forget: notification failures must not break the response
        notifyFriendAnswered(user.owner_token, count).catch((err) =>
          console.error("notifyFriendAnswered error:", err),
        );
      }
      // updated が null = 別リクエストが先に通知済み → スキップ
    }
  }

  return NextResponse.json({ success: true });
}
