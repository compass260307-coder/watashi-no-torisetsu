import { NextRequest, NextResponse } from "next/server";
import { authorizeSheetsMetricsRequest, metricsPrivateHeaders } from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = authorizeSheetsMetricsRequest(request);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status, headers: metricsPrivateHeaders });
  const date = request.nextUrl.searchParams.get("date");
  const since = request.nextUrl.searchParams.get("since");
  if ((date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) ||
      (since && (!/^\d{4}-\d{2}-\d{2}T/.test(since) || !Number.isFinite(Date.parse(since))))) {
    return NextResponse.json({ error: "Invalid date or since" }, { status: 400, headers: metricsPrivateHeaders });
  }
  try {
    const fx: unknown = JSON.parse(process.env.HYPER_REPORT_FX_JPY_PER_UNIT || "{}");
    if (!fx || typeof fx !== "object" || Array.isArray(fx) || Object.values(fx).some(v => typeof v !== "number" || !Number.isFinite(v) || v <= 0)) throw new Error("Invalid FX configuration");
    const { data, error } = date
      ? await supabaseAdmin.rpc("hyper_report_day", { p_date: date, p_fx: fx })
      : await supabaseAdmin.rpc("hyper_report_plan", { p_since: since || null });
    if (error || !data) throw new Error("Aggregate unavailable");
    return NextResponse.json({ version: 1, ...data, ad_status: data.ad_status ?? { source: "未接続（段階1）", synced_at: null } }, { headers: metricsPrivateHeaders });
  } catch {
    // Never return database error details, credentials, raw facts, or tokens.
    return NextResponse.json({ error: "集計を取得できません。DB適用状態と円換算レートを確認してください" }, { status: 503, headers: metricsPrivateHeaders });
  }
}
