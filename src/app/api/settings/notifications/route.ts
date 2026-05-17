// Phase 3-β リリース 3 D-10: 通知設定 API (LIFF id_token 認可)
//
// GET: 現在の notification_preferences を返す (行なしならデフォルト全 true)
// POST: 部分更新可能 (body の boolean キーだけ反映)、UPSERT で行作成も
//
// テーブル: notification_preferences (A-1 で準備済)
//   line_user_id text unique, enable_welcome, enable_diagnosis_complete,
//   enable_friend_perception, enable_reminder, enable_broadcast, updated_at

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyBearer } from "@/lib/liff-verify";

export const runtime = "nodejs";

type Prefs = {
  enable_welcome: boolean;
  enable_diagnosis_complete: boolean;
  enable_friend_perception: boolean;
  enable_reminder: boolean;
  enable_broadcast: boolean;
};

const PREF_KEYS: (keyof Prefs)[] = [
  "enable_welcome",
  "enable_diagnosis_complete",
  "enable_friend_perception",
  "enable_reminder",
  "enable_broadcast",
];

const DEFAULT_PREFS: Prefs = {
  enable_welcome: true,
  enable_diagnosis_complete: true,
  enable_friend_perception: true,
  enable_reminder: true,
  enable_broadcast: true,
};

export async function GET(request: NextRequest) {
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  const { data, error } = await supabaseAdmin
    .from("notification_preferences")
    .select(
      "enable_welcome, enable_diagnosis_complete, enable_friend_perception, enable_reminder, enable_broadcast",
    )
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (error) {
    console.error("[settings/notifications GET] DB error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json((data as Prefs | null) ?? DEFAULT_PREFS);
}

export async function POST(request: NextRequest) {
  const verified = await verifyBearer(request);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lineUserId = verified.sub;

  let body: Partial<Record<string, unknown>>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 既存値を取得 (UPSERT 時の merge ベース)
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from("notification_preferences")
    .select(
      "enable_welcome, enable_diagnosis_complete, enable_friend_perception, enable_reminder, enable_broadcast",
    )
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (lookupErr) {
    console.error("[settings/notifications POST] lookup error:", lookupErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  const base: Prefs = (existing as Prefs | null) ?? DEFAULT_PREFS;

  // body の許可キーのみ取り出して merge
  const merged: Prefs = { ...base };
  for (const k of PREF_KEYS) {
    const v = body[k];
    if (typeof v === "boolean") merged[k] = v;
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("notification_preferences")
    .upsert(
      {
        line_user_id: lineUserId,
        ...merged,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "line_user_id" },
    );
  if (upsertErr) {
    console.error("[settings/notifications POST] upsert error:", upsertErr);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: merged });
}
