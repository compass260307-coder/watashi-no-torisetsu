import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";

export const runtime = "nodejs";

// DELETE /api/unmei/reading
//   ログイン中の本人 (session.id) の鑑定 (natal_readings) だけを破棄する。
//   出生データ (birth_profiles) とチャート (natal_charts) は保持したまま、鑑定「文」だけを
//   作り直したいとき用 (例: プロンプト v2 化。出生情報は変えず本文だけ再生成)。
//   削除後に /unmei をリロードすると、既存の generate が「有効な鑑定なし」で自動再生成する。
//
//   責務の切り分け:
//     - /api/birth-profile DELETE = フルリセット (birth_profiles + natal_charts + natal_readings)
//     - /api/unmei/reading  DELETE = 鑑定文のみ (チャート・出生データは保持)
//   この2本は合成可能で、将来の「出生情報を編集して作り直す」導線は
//   〈birth-profile POST (upsert + チャート再計算)〉+〈本 DELETE〉で組める。
export async function DELETE(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // session.id スコープのみ。user_id を外部から受け取らないので取り違え不可。
  const { error, count } = await supabaseAdmin
    .from("natal_readings")
    .delete({ count: "exact" })
    .eq("user_id", session.id);

  if (error) {
    console.error("[api/unmei/reading] delete error:", error.message);
    return NextResponse.json({ error: "db error" }, { status: 503 });
  }

  await supabaseAdmin.from("events").insert({
    event_name: "natal_reading_deleted",
    owner_token: session.owner_token ?? null,
    metadata: { deleted: count ?? 0 },
  });

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
