import { NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { isReadingReady, readingGenState } from "@/lib/unmei/reading";
import { resolveUnmeiPromptInputs } from "@/lib/unmei/prompt-inputs";

async function loadWorker() {
  return await import("@/lib/unmei/generateWorker.mjs");
}

export const runtime = "nodejs";
// 非同期化 (方式A): 重い生成 (チャート計算 + Claude) は after() で応答後に実行する。
// after() のコールバックはこのルートの maxDuration 内で走る (Next docs: after#Duration) ため、
// 将来のバーナム検品×2 (Claude 呼び出し追加・総処理〜180秒想定) を含めても収まるよう
// 上限を 300 秒 (Vercel Pro 上限) に引き上げる。
export const maxDuration = 300;

// POST /api/unmei/generate
//   購入済み(unmei)ユーザー本人の鑑定生成をキックする。
//   userId は body ではなく session から解決する (なりすまし防止)。
//
// 非同期化: 認可・idempotency・終端 failed の判定だけ同期で行い、生成本体 (runForUser) は
//   after() でバックグラウンド実行する。即座に state:'pending' を返し、クライアントは
//   /api/unmei/status のポーリングで完了を待つ (状態の正は status = 既存の仕組みを流用)。
//   ※ ロックは runForUser 側が持つ設計を変えない (事前ロックを打つと runForUser の in_progress
//      ガードに掛かり生成されなくなるため、ここでは事前ロックしない)。
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

  // 手動リトライ(自動再生成の上限を超えて再試行)は body { force:true } で明示する。
  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    /* body 無しは force=false */
  }

  // 既存の生成状態を読む (idempotency + 終端 failed の同期短絡に使う)。
  const { data: existing } = await supabaseAdmin
    .from("natal_readings")
    .select("model, reading, generated_at")
    .eq("user_id", userId)
    .maybeSingle();

  // idempotency: 有効な鑑定が既にあれば再生成しない(キャッシュ規律)。
  if (isReadingReady(existing)) {
    return NextResponse.json({ ok: true, state: "ready", skipped: true });
  }

  // 終端 failed (自動再生成の上限到達 = 手動リトライ待ち) は同期で短絡し、無駄な
  // バックグラウンド起動を避ける。force=true のときは短絡せず再生成に進む。
  const gen = readingGenState(existing);
  if (gen.state === "failed" && !force) {
    return NextResponse.json({ ok: true, state: "failed", attempts: gen.attempts });
  }

  // プロンプト入力 (Big Five スコア + 32タイプ称号) を同期解決してバックグラウンドに渡す。
  const promptInputs = await resolveUnmeiPromptInputs(supabaseAdmin, userId);

  // ===== 生成本体は応答後に実行 (after は maxDuration 内で走る) =====
  //   runForUser が自前でロック(model='generating')取得 → Claude → reading 書き込み、
  //   失敗時は failed 記録 (attempts++) まで行う。ここでは結果を待たない。
  after(async () => {
    try {
      const worker = await loadWorker();
      await worker.runForUser(supabaseAdmin, userId, { ...promptInputs, force });
    } catch (e) {
      // runForUser は内部 try/catch で failed を記録するが、想定外の throw もログに残す。
      // 記録漏れのままフリーズ/クラッシュした場合は staleロック(180s)経過 + クライアントの
      // 自動再キックで回復する (状態は status が正)。
      console.error("[api/unmei/generate] background runForUser error:", e);
    }
  });

  // 即レス: 生成はバックグラウンドで進行中。クライアントは /api/unmei/status をポーリング。
  return NextResponse.json({ ok: true, state: "pending" });
}
