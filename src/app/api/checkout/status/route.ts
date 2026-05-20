// プレミアム化 v2 Week 2 T2-8 (T2-5 と同時): Checkout ステータス取得エンドポイント
//
// GET /api/checkout/status?session_id=cs_xxx
//   - /checkout/success ページのポーリング先
//   - 認可なし (URL の session_id が認可代わり、外部から推測困難)
//   - 戻り値:
//     {
//       payment_status: 'unknown' | 'pending' | 'completed' | 'failed' | 'refunded',
//       generation_status: 'none' | 'pending' | 'generating' | 'completed' | 'failed',
//       integrated_trisetsu_id?: string,
//     }
//
// payment_history が Webhook 受信前 (T2-7 未着信) は 'unknown'。
// payment_history が pending 状態 = 決済成功直後、Webhook 受信済み、AI 生成キュー待ち。
// integrated_trisetsu が completed 状態 = AI 生成完了、PDF ダウンロード可能。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 15;

type StatusResponse = {
  payment_status:
    | "unknown"
    | "pending"
    | "completed"
    | "failed"
    | "refunded";
  generation_status:
    | "none"
    | "pending"
    | "generating"
    | "completed"
    | "failed";
  integrated_trisetsu_id?: string;
  failure_reason?: string;
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json(
      { error: "session_id is required" },
      { status: 400 },
    );
  }

  // ===== payment_history 引き当て =====
  const { data: payment, error: pErr } = await supabaseAdmin
    .from("payment_history")
    .select("id, status")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (pErr) {
    console.error("[checkout/status] payment_history error:", pErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!payment) {
    // Webhook 未着信または不正な session_id
    const body: StatusResponse = {
      payment_status: "unknown",
      generation_status: "none",
    };
    return NextResponse.json(body);
  }

  const paymentStatus = (payment.status as StatusResponse["payment_status"]) ?? "unknown";

  // ===== integrated_trisetsu 引き当て (payment_id 経由) =====
  const { data: trisetsu, error: tErr } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select("id, status, failure_reason")
    .eq("payment_id", payment.id)
    .maybeSingle();
  if (tErr) {
    console.error("[checkout/status] integrated_trisetsu error:", tErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const body: StatusResponse = {
    payment_status: paymentStatus,
    generation_status: trisetsu
      ? (trisetsu.status as StatusResponse["generation_status"]) ?? "pending"
      : "none",
    ...(trisetsu?.id ? { integrated_trisetsu_id: trisetsu.id as string } : {}),
    ...(trisetsu?.failure_reason
      ? { failure_reason: trisetsu.failure_reason as string }
      : {}),
  };

  return NextResponse.json(body, {
    // Polling 想定: クライアントキャッシュ不要、エッジキャッシュも不要
    headers: { "Cache-Control": "no-store" },
  });
}
