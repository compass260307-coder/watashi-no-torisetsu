import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { readJsonObject } from "@/lib/api-security";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request as any);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("birth_profiles")
    .select("*")
    .eq("user_id", session.id)
    .maybeSingle();
  if (error) {
    console.error("[api/birth-profile] get error:", error.message);
    return NextResponse.json({ error: "db error" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, profile: data });
}

export async function POST(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request as any);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await readJsonObject(request, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value as any;

  // basic validation
  const birth_date = body.birth_date ?? null;
  if (!birth_date) return NextResponse.json({ error: "birth_date required" }, { status: 400 });

  const time_unknown = !!body.time_unknown;
  const place_unknown = !!body.place_unknown;
  const birth_time = time_unknown ? null : body.birth_time ?? null;
  const prefecture = body.prefecture ?? null;
  const city = body.city ?? null;
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;

  try {
    // upsert
    const { error } = await supabaseAdmin
      .from("birth_profiles")
      .upsert(
        {
          user_id: session.id,
          birth_date,
          birth_time,
          time_unknown,
          prefecture,
          city,
          latitude,
          longitude,
          place_unknown,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) {
      console.error("[api/birth-profile] upsert error:", error.message);
      return NextResponse.json({ error: "db error" }, { status: 503 });
    }

    // 出生データ保存後、出生図を計算して natal_charts に保存し natal_chart_ready を立てる。
    // (指示書②: 保存時点では計算のみ。AI 鑑定文の生成は購入後・/unmei 側でトリガーする)
    // best-effort: 計算失敗でもプロファイル保存は成功として返す。
    try {
      const { computeChartForUser } = await import("@/lib/unmei/generateWorker.mjs");
      await computeChartForUser(supabaseAdmin, session.id);
    } catch (e) {
      console.error("[api/birth-profile] chart compute failed (continuing):", e);
    }

    // record event for analytics
    await supabaseAdmin.from("events").insert({
      event_name: "birth_form_submit",
      owner_token: session.owner_token ?? null,
      metadata: {
        has_time: !!birth_time,
        has_place: !place_unknown && !!prefecture,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request as any);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await supabaseAdmin.from("birth_profiles").delete().eq("user_id", session.id);
    await supabaseAdmin.from("natal_charts").delete().eq("user_id", session.id);
    await supabaseAdmin.from("users").update({ natal_chart_ready: false }).eq("id", session.id);

    await supabaseAdmin.from("events").insert({
      event_name: "birth_profile_deleted",
      owner_token: session.owner_token ?? null,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
