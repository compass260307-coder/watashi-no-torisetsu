import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import {
  isReadingLocaleValid,
  isReadingReady,
  readingGenState,
} from "@/lib/unmei/reading";
import { hasUnmeiAccess } from "@/lib/entitlements";

export const runtime = "nodejs";

// GET /api/unmei/status
//   /unmei クライアントのポーリング用。本人の鑑定状態を返す。
//   state:
//     'unpurchased' … 未購入
//     'no_birth'    … 購入済み・出生データ未入力
//     'pending'     … 生成中 (natal_readings が未作成 or model='pending')
//     'ready'       … 生成完了 (reading を同梱)
export async function GET(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request as never);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.id;

  const [{ data: u }, purchased] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("preferred_locale")
      .eq("id", userId)
      .maybeSingle(),
    hasUnmeiAccess(userId),
  ]);
  if (!purchased) {
    return NextResponse.json({ ok: true, state: "unpurchased" });
  }

  const { data: profile } = await supabaseAdmin
    .from("birth_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ ok: true, state: "no_birth" });
  }

  const { data: reading } = await supabaseAdmin
    .from("natal_readings")
    .select("reading, model, generated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const requiredLocale = u?.preferred_locale === "ko" ? "ko" : "ja";
  const readingLocale =
    (reading?.reading as { locale?: unknown } | null)?.locale === "ko"
      ? "ko"
      : "ja";
  if (
    !isReadingReady(reading) ||
    readingLocale !== requiredLocale ||
    !isReadingLocaleValid(reading?.reading, requiredLocale)
  ) {
    // pending(生成中/未達) と failed(自動再生成の上限到達=手動リトライ待ち)を区別。
    const { state, attempts } = readingGenState(reading);
    return NextResponse.json({
      ok: true,
      state: state === "failed" ? "failed" : "pending",
      attempts,
    });
  }

  return NextResponse.json({ ok: true, state: "ready", reading });
}
