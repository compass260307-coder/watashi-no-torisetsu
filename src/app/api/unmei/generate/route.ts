import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { isReadingReady } from "@/lib/unmei/reading";
import { resolveUnmeiPromptInputs } from "@/lib/unmei/prompt-inputs";

async function loadWorker() {
  return await import("@/lib/unmei/generateWorker.mjs");
}

export const runtime = "nodejs";
// Claude 生成で最大 120 秒程度 + 余裕
export const maxDuration = 150;

// POST /api/unmei/generate
//   購入済み(unmei)ユーザー本人の鑑定生成をキックする。
//   userId は body ではなく session から解決する (なりすまし防止)。
//   返り値の state で /unmei クライアントが分岐する。
export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request as never);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.id;

  // 購入済みチェック: 未購入ユーザーが Claude 生成をキックできないようにする。
  const { data: u } = await supabaseAdmin
    .from("users")
    .select("unmei")
    .eq("id", userId)
    .maybeSingle();
  if (!u?.unmei) {
    return NextResponse.json({ error: "not purchased", state: "unpurchased" }, { status: 403 });
  }

  // Idempotency: 有効な鑑定が既にあれば再生成しない(キャッシュ規律)。
  const { data: existing } = await supabaseAdmin
    .from("natal_readings")
    .select("model, reading")
    .eq("user_id", userId)
    .maybeSingle();
  if (isReadingReady(existing)) {
    return NextResponse.json({ ok: true, state: "ready", skipped: true });
  }

  try {
    // Big Five スコア + 32タイプ称号を解決してプロンプト入力として渡す。
    const promptInputs = await resolveUnmeiPromptInputs(supabaseAdmin, userId);

    const worker = await loadWorker();
    const result = await worker.runForUser(supabaseAdmin, userId, promptInputs);

    if (result && "skipped" in result) {
      // no_birth_profile / chart_not_ready → まだ生成できない状態
      const state = result.skipped === "no_birth_profile" ? "no_birth" : "pending";
      return NextResponse.json({ ok: true, state });
    }
    if (result && "error" in result) {
      // 生成失敗。pending のまま。クライアントはタイムアウトで再試行案内。
      console.error("[api/unmei/generate] generation error:", result.error);
      return NextResponse.json({ ok: false, state: "pending" }, { status: 200 });
    }
    return NextResponse.json({ ok: true, state: "ready" });
  } catch (e) {
    console.error("[api/unmei/generate] error:", e);
    return NextResponse.json({ ok: false, state: "pending" }, { status: 200 });
  }
}
