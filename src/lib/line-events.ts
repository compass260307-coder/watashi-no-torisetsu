// Alice Plus (LINE) Phase 4: LINE基盤のKPIイベント記録。
//
// events テーブルへの server 側 insert (service role・RLS非依存)。
// KPIは本流を止めない: 失敗はログだけ残して握りつぶす。
//
// イベント一覧:
//   line_follow / line_unfollow      - 友だち追加・ブロック
//   line_link_completed              - 連携コード消費 (Web診断と紐付け完了)
//   line_plus_checkout_opened        - Plus購入リンクからCheckoutへ遷移
//   line_plus_subscribed             - サブスク成立 (id=セッション由来で冪等)
//   line_plus_cancel_scheduled       - 期間末解約の予約
//   line_plus_canceled               - サブスク終了 (id=サブスクID由来で冪等)

import { supabaseAdmin } from "@/lib/supabase-server";

export async function recordLineEvent(input: {
  eventName: string;
  metadata: Record<string, unknown>;
  ownerToken?: string | null;
  /** Stripe webhook 再送などで二重記録しうるイベントは決定的UUIDで冪等化する */
  id?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("events").insert({
    ...(input.id ? { id: input.id } : {}),
    event_name: input.eventName,
    owner_token: input.ownerToken ?? null,
    locale: "ja",
    metadata: input.metadata,
  });
  // 23505 = 決定的IDの衝突 (再送で記録済み)。想定内なのでログも出さない
  if (error && error.code !== "23505") {
    console.error("[line-events] insert failed", {
      eventName: input.eventName,
      message: error.message,
    });
  }
}
