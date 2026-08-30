// Alice Plus (LINE) Phase 1: LINE連携コード発行。
//
// /me の「LINE連携」から呼ばれ、6桁コードを返す。ユーザーはそのコードを
// LINEトークに送り、/api/line/webhook 側で users と line_user_id が紐付く。
// コードは平文保存せず HMAC で持つ (app_transfer_codes と同方式)。

import { randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/api-security";
import { hashLineLinkCode } from "@/lib/line";
import { checkOrigin } from "@/lib/origin-check";
import { isUndiagnosedPlaceholderUser } from "@/lib/placeholder-user";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const CODE_TTL_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const origin = checkOrigin(request);
  if (!origin.ok) {
    return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
  }

  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const { data: diagnosis, error: diagnosisError } = await supabaseAdmin
    .from("users")
    .select("scores, diagnosis_completed_at")
    .eq("id", session.id)
    .maybeSingle();
  if (diagnosisError || !diagnosis) {
    return NextResponse.json(
      { error: "diagnosis_lookup_failed" },
      { status: 503 },
    );
  }
  if (isUndiagnosedPlaceholderUser(diagnosis)) {
    return NextResponse.json({ error: "diagnosis_required" }, { status: 409 });
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "line-link-code-issue-user",
    identifier: session.id,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const nowIso = new Date().toISOString();

  // 再発行時は本人の未消費コードを無効化し、あわせて期限切れ未消費行を掃除する
  // (uq_line_link_codes_active_code の衝突空間を空けるため)。
  await supabaseAdmin
    .from("line_link_codes")
    .delete()
    .eq("user_id", session.id)
    .is("consumed_at", null);
  await supabaseAdmin
    .from("line_link_codes")
    .delete()
    .is("consumed_at", null)
    .lt("expires_at", nowIso);

  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { error } = await supabaseAdmin.from("line_link_codes").insert({
      code_hash: hashLineLinkCode(code),
      user_id: session.id,
      expires_at: expiresAt,
    });

    if (!error) {
      return NextResponse.json(
        { code, expires_at: expiresAt },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    // 23505 = 有効コードの衝突。別の乱数で再試行
    if (error.code !== "23505") {
      console.error("[line/link-code] insert failed", {
        userId: session.id,
        message: error.message,
      });
      break;
    }
  }

  return NextResponse.json({ error: "code_issue_failed" }, { status: 503 });
}
