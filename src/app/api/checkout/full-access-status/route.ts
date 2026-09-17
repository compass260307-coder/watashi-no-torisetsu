// 決済後の反映確認用の軽量ステータス API。
//
// GET /api/checkout/full-access-status?owner_token=<token>
//   → { full: boolean, selfReport: boolean, friend: boolean, premiumBundle: boolean, astrologer: boolean, unmei: boolean, tarot: boolean }
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
import {
  getAccessPurchaseEntitlements,
  hasFullAccess,
  hasSelfReportAccess,
  hasTakoAccess,
  hasUnmeiAccess,
} from "@/lib/entitlements";
import { ensureHoshiyomiCreditsFromPurchase } from "@/lib/hoshiyomi/store";

export const runtime = "nodejs";

const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("owner_token")?.trim();
  if (!token) {
    return NextResponse.json(
      {
        full: false,
        selfReport: false,
        friend: false,
        premiumBundle: false,
        astrologer: false,
        unmei: false,
        tarot: false,
      },
      noStore,
    );
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("owner_token", token)
    .maybeSingle();
  if (!data) {
    return NextResponse.json(
      {
        full: false,
        selfReport: false,
        friend: false,
        premiumBundle: false,
        astrologer: false,
        unmei: false,
        tarot: false,
      },
      noStore,
    );
  }

  const userId = data.id as string;
  const fullPromise = hasFullAccess(userId);
  // premiumBundle と tarot は同じ購入履歴から判定するため、一度だけ取得する。
  const purchasesPromise = getAccessPurchaseEntitlements(userId);
  // plan の反映前でも completed の完全版購入があれば、従来どおりクレジットを復元する。
  // 未購入者だけ復元を省略し、full の購入者は他の権限チェックと並行して進める。
  const creditsPromise = fullPromise.then(async (full) => {
    if (full) return ensureHoshiyomiCreditsFromPurchase(userId);
    const purchases = await purchasesPromise;
    return purchases.full ? ensureHoshiyomiCreditsFromPurchase(userId) : null;
  });
  const [full, selfReport, friend, purchases, credits, unmei] =
    await Promise.all([
      fullPromise,
      hasSelfReportAccess(userId),
      hasTakoAccess(userId),
      purchasesPromise,
      creditsPromise,
      hasUnmeiAccess(userId),
    ]);
  // チャットの利用可否は full が前提。未購入者には残高の掃除・購入履歴からの
  // クレジット復元を行わず、決済直後の full 判定は従来どおり最新値を読む。
  const astrologer =
    full && credits?.available === true && credits.data.total > 0;
  return NextResponse.json(
    {
      full,
      selfReport,
      friend,
      premiumBundle: purchases.premiumBundle,
      astrologer,
      unmei,
      tarot: purchases.tarotFeatures,
    },
    noStore,
  );
}
