// 相性診断へのナビゲーション表示可否を返す軽量ゲート。
// プレミアム権限（または購入時に相性込みだった旧権利）を持つ本人だけ
// { unlocked: true } を返す。

import { NextRequest, NextResponse } from "next/server";
import { isSafeOpaqueToken } from "@/lib/api-security";
import { hasAishoAccess } from "@/lib/entitlements";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  let userId: string | null = session?.id ?? null;

  if (!userId) {
    const rawToken = request.nextUrl.searchParams.get("owner_token");
    if (isSafeOpaqueToken(rawToken)) {
      const { data } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("owner_token", rawToken)
        .maybeSingle();
      userId = (data?.id as string | null) ?? null;
    }
  }

  const unlocked = userId ? await hasAishoAccess(userId) : false;
  return NextResponse.json(
    { unlocked },
    { headers: { "Cache-Control": "no-store" } },
  );
}
