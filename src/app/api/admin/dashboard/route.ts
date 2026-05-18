// Phase 3-β リリース 3 D-14 + D-15: Admin Dashboard 集計 API
//
// GET /api/admin/dashboard?period=30d
//   認可: x-admin-key ヘッダ (既存 admin endpoint と同一方式 = ADMIN_KEY)
//   1 endpoint で全運用データを集約。UI は後回し (生 JSON を運用閲覧)。
//
// 集計対象:
//   - users: total / line_linked / diagnoses_total / recent_signups_7d
//   - friend_perceptions: total / avg_per_user / recent_7d
//   - integrated_trisetsu: total / avg_per_user / recent_7d
//   - ai_cost: total_usd / total_jpy (1 USD = 150 JPY 固定) / recent_7d_usd
//   - line_messages: total_sent / success_rate / by_type
//   - notification_preferences: 各カテゴリ OFF 数
//   - recent_errors: line_messages_sent で send_result='failed' の直近 20 件 (D-15)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const USD_TO_JPY = 150; // 固定レート (要定期更新、ハードコード)

function isAuthorized(request: NextRequest): boolean {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;
  return !!adminKey && key === adminKey;
}

function parsePeriodDays(periodRaw: string | null): number {
  if (!periodRaw) return 30;
  const match = periodRaw.match(/^(\d+)d$/);
  if (!match) return 30;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n) || n <= 0 || n > 365) return 30;
  return n;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodDays = parsePeriodDays(
    request.nextUrl.searchParams.get("period"),
  );
  const now = new Date();
  const periodSince = new Date(now.getTime() - periodDays * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  // ===== 1. users =====
  const [
    { count: usersTotal },
    { count: usersLineLinked },
    { count: usersRecent7d },
  ] = await Promise.all([
    supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .not("line_user_id", "is", null),
    supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  // ===== 2. friend_perceptions =====
  const [
    { count: fpTotal },
    { count: fpRecent7d },
  ] = await Promise.all([
    supabaseAdmin
      .from("friend_perceptions")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("friend_perceptions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  // ===== 3. integrated_trisetsu + AI cost =====
  const [
    { count: itTotal },
    { count: itRecent7d },
    { data: itAllCosts },
    { data: itRecent7dCosts },
  ] = await Promise.all([
    supabaseAdmin
      .from("integrated_trisetsu")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("integrated_trisetsu")
      .select("id", { count: "exact", head: true })
      .gte("generated_at", sevenDaysAgo.toISOString()),
    supabaseAdmin.from("integrated_trisetsu").select("ai_cost_usd"),
    supabaseAdmin
      .from("integrated_trisetsu")
      .select("ai_cost_usd")
      .gte("generated_at", sevenDaysAgo.toISOString()),
  ]);

  const sumCost = (rows: Array<{ ai_cost_usd: number | null }> | null) =>
    Number(
      (
        (rows ?? []).reduce((acc, r) => acc + (Number(r.ai_cost_usd) || 0), 0)
      ).toFixed(6),
    );
  const aiTotalUsd = sumCost(itAllCosts);
  const aiRecent7dUsd = sumCost(itRecent7dCosts);

  // ===== 4. line_messages_sent =====
  // 期間内の全行を SELECT して by_type と success_rate を JS で集計
  const { data: lmsRows, error: lmsErr } = await supabaseAdmin
    .from("line_messages_sent")
    .select("message_type, send_result")
    .gte("sent_at", periodSince.toISOString());
  if (lmsErr) {
    console.error("[admin/dashboard] line_messages_sent error:", lmsErr);
  }
  const lmsTotal = lmsRows?.length ?? 0;
  const lmsSuccess =
    (lmsRows ?? []).filter((r) => r.send_result === "success").length;
  const lmsByType: Record<string, number> = {};
  for (const r of lmsRows ?? []) {
    const t = (r.message_type as string) ?? "unknown";
    lmsByType[t] = (lmsByType[t] ?? 0) + 1;
  }
  const lmsSuccessRate =
    lmsTotal > 0 ? Number((lmsSuccess / lmsTotal).toFixed(4)) : null;

  // ===== 5. notification_preferences (各カテゴリ OFF 数) =====
  const { data: prefsRows, error: prefsErr } = await supabaseAdmin
    .from("notification_preferences")
    .select(
      "enable_welcome, enable_diagnosis_complete, enable_friend_perception, enable_reminder, enable_broadcast",
    );
  if (prefsErr) {
    console.error("[admin/dashboard] prefs error:", prefsErr);
  }
  const offCount = (key: string) =>
    (prefsRows ?? []).filter(
      (r) => (r as Record<string, unknown>)[key] === false,
    ).length;
  const prefsOff = {
    enable_welcome_off: offCount("enable_welcome"),
    enable_diagnosis_complete_off: offCount("enable_diagnosis_complete"),
    enable_friend_perception_off: offCount("enable_friend_perception"),
    enable_reminder_off: offCount("enable_reminder"),
    enable_broadcast_off: offCount("enable_broadcast"),
    total_prefs_rows: prefsRows?.length ?? 0,
  };

  // ===== 6. recent errors (D-15、line_messages_sent.send_result='failed' 直近 20 件) =====
  const { data: errorRows, error: errorErr } = await supabaseAdmin
    .from("line_messages_sent")
    .select(
      "line_user_id, message_type, message_subtype, error_detail, sent_at",
    )
    .neq("send_result", "success")
    .order("sent_at", { ascending: false })
    .limit(20);
  if (errorErr) {
    console.error("[admin/dashboard] error rows fetch error:", errorErr);
  }
  const recentErrors = (errorRows ?? []).map((r) => ({
    lineUserIdMasked:
      typeof r.line_user_id === "string"
        ? r.line_user_id.slice(0, 8) + "..."
        : null,
    messageType: r.message_type,
    messageSubtype: r.message_subtype,
    errorDetail: r.error_detail,
    sentAt: r.sent_at,
  }));

  // ===== 集計レスポンス =====
  return NextResponse.json({
    period: `${periodDays}d`,
    generated_at: now.toISOString(),
    users: {
      total: usersTotal ?? 0,
      line_linked: usersLineLinked ?? 0,
      diagnoses_total: usersTotal ?? 0, // 1 行 = 1 診断 (再診断含む)
      recent_signups_7d: usersRecent7d ?? 0,
    },
    friend_perceptions: {
      total: fpTotal ?? 0,
      avg_per_user:
        (usersLineLinked ?? 0) > 0
          ? Number(((fpTotal ?? 0) / (usersLineLinked ?? 1)).toFixed(2))
          : 0,
      recent_7d: fpRecent7d ?? 0,
    },
    integrated_trisetsu: {
      total: itTotal ?? 0,
      avg_per_user:
        (usersLineLinked ?? 0) > 0
          ? Number(((itTotal ?? 0) / (usersLineLinked ?? 1)).toFixed(2))
          : 0,
      recent_7d: itRecent7d ?? 0,
    },
    ai_cost: {
      total_usd: aiTotalUsd,
      total_jpy: Math.round(aiTotalUsd * USD_TO_JPY),
      recent_7d_usd: aiRecent7dUsd,
      usd_to_jpy_rate: USD_TO_JPY,
      note: "USD_TO_JPY は固定値 150。レート変動時はコード更新で反映。",
    },
    line_messages: {
      period_days: periodDays,
      total_sent: lmsTotal,
      success_rate: lmsSuccessRate,
      by_type: lmsByType,
    },
    notification_preferences: prefsOff,
    recent_errors: recentErrors,
  });
}
