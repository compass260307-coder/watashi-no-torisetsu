import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { isReadingReady, MAX_GEN_ATTEMPTS } from "@/lib/unmei/reading";
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

  // 手動リトライ(自動再生成の上限を超えて再試行)は body { force:true } で明示する。
  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    /* body 無しは force=false */
  }

  try {
    // Big Five スコア + 32タイプ称号を解決してプロンプト入力として渡す。
    const promptInputs = await resolveUnmeiPromptInputs(supabaseAdmin, userId);

    const worker = await loadWorker();
    const result = await worker.runForUser(supabaseAdmin, userId, {
      ...promptInputs,
      force,
    });

    if (result && "skipped" in result) {
      if (result.skipped === "no_birth_profile") {
        return NextResponse.json({ ok: true, state: "no_birth" });
      }
      if (result.skipped === "failed") {
        // 自動再生成の上限到達 → 手動リトライ待ち
        return NextResponse.json({ ok: true, state: "failed", attempts: result.attempts ?? MAX_GEN_ATTEMPTS });
      }
      // chart_not_ready / in_progress → 待機(pending)
      return NextResponse.json({ ok: true, state: "pending" });
    }
    if (result && "error" in result) {
      // 生成失敗。上限到達なら failed、未達なら pending(自動再試行の余地)。
      console.error("[api/unmei/generate] generation error:", result.error);
      const attempts = result.attempts ?? 0;
      const state = attempts >= MAX_GEN_ATTEMPTS ? "failed" : "pending";
      return NextResponse.json({ ok: false, state, attempts }, { status: 200 });
    }
    return NextResponse.json({ ok: true, state: "ready" });
  } catch (e) {
    console.error("[api/unmei/generate] error:", e);
    return NextResponse.json({ ok: false, state: "pending" }, { status: 200 });
  }
}
