// 決済後の反映確認用の軽量ステータス API。
//
// GET /api/checkout/full-access-status?owner_token=<token>
//   → { full: boolean }
//
// 用途: Stripe 決済後の着地 (/me/[token]?paid=1) で webhook 反映を待つポーリング先。
//   webhook (plan='full') は非同期なので、着地直後はまだ未反映のことがある。
//   クライアントがこれを数秒ポーリングし、full になったらロック解除表示へ自動遷移する。
//
// 認可: owner_token (推測不可の秘密トークン) 保持で読める (閲覧と同じ capability)。
//   読み取り専用・plan の真偽のみ返すので情報漏洩リスクは無し。判定は hasFullAccess に集約
//   (email 横断も含む)。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasFullAccess } from "@/lib/entitlements";

export const runtime = "nodejs";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("owner_token")?.trim();
  if (!token) {
    return NextResponse.json({ full: false }, noStore);
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("owner_token", token)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ full: false }, noStore);
  }

  const full = await hasFullAccess(data.id as string);
  return NextResponse.json({ full }, noStore);
}
