import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { createSession, getSession } from "@/lib/session";
import { checkOrigin } from "@/lib/origin-check";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { classifyType } from "@/lib/diagnosis";
import { PLACEHOLDER_SCORES } from "@/lib/placeholder-user";

export const runtime = "nodejs";

// webhook のゲスト購入プレースホルダーと同じ流儀のトークン生成。
function guestToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function GET(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request);
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

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  let session = await getSession(request);

  const parsed = await readJsonObject(request, 8 * 1024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;

  // basic validation
  const birth_date =
    typeof body.birth_date === "string" ? body.birth_date : null;
  if (!birth_date) return NextResponse.json({ error: "birth_date required" }, { status: 400 });

  // 未セッション = 未診断ゲストのチャット決済 (2026-08-10)。保存先がないので、
  // 匿名ユーザー+セッションを発行してから保存する。users の NOT NULL 制約は
  // webhook のゲスト購入プレースホルダーと同じ中立値で満たす (診断すると
  // /api/diagnosis が同じ行を本物の結果で UPDATE し、購入・出生データは引き継がれる)。
  // ボットの行量産を防ぐため IP レートリミットを掛ける (正規ユーザーは1回で足りる)。
  if (!session) {
    const guestLimit = await consumeRateLimit(request, {
      scope: "birth-profile-guest",
      limit: 5,
      windowSeconds: 600,
    });
    if (!guestLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts" },
        {
          status: 429,
          headers: { "Retry-After": String(guestLimit.retryAfterSeconds ?? 60) },
        },
      );
    }
    try {
      const created = await createSession({
        type_id: classifyType(PLACEHOLDER_SCORES),
        scores: PLACEHOLDER_SCORES,
        invite_code: guestToken(8),
        owner_token: guestToken(16),
      });
      session = created.user;
    } catch (e) {
      console.error("[api/birth-profile] guest session create failed:", e);
      return NextResponse.json({ error: "server error" }, { status: 500 });
    }
  }

  const time_unknown = body.time_unknown === true;
  const place_unknown = body.place_unknown === true;
  const birth_time =
    time_unknown || typeof body.birth_time !== "string"
      ? null
      : body.birth_time;
  const prefecture =
    typeof body.prefecture === "string" ? body.prefecture : null;
  const city = typeof body.city === "string" ? body.city : null;
  const latitude = typeof body.latitude === "number" ? body.latitude : null;
  const longitude = typeof body.longitude === "number" ? body.longitude : null;
  const analyticsPage = body.analytics_page === "unmei" ? "unmei" : null;

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
        ...(analyticsPage ? { page: analyticsPage } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) return NextResponse.json({ error: originCheck.error }, { status: 403 });

  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 出生データを消したら、それに紐づく鑑定 (natal_readings) も破棄する。
    // これを残すと /unmei の再入力後に generate が「有効な鑑定あり」で再生成をスキップし
    // 旧鑑定文が残る (構造的バグ)。3テーブルとも session.id スコープで、本人分だけを消す。
    await supabaseAdmin.from("birth_profiles").delete().eq("user_id", session.id);
    await supabaseAdmin.from("natal_charts").delete().eq("user_id", session.id);
    await supabaseAdmin.from("natal_readings").delete().eq("user_id", session.id);
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
