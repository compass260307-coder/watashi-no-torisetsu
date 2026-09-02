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

import { createHash } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase-server";

/** 決定的UUID (events.id 用)。同じ入力なら常に同じIDになり、PK衝突で冪等化できる。 */
export function deterministicLineEventId(
  eventName: string,
  key: string,
): string {
  const hex = createHash("sha256")
    .update(`line_event\0${eventName}\0${key}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 一度きりのイベント記録 (ミッション報酬などの請求ロック兼用)。
 * 挿入できたら true・既に記録済み (PK衝突) なら false。それ以外の失敗も false に倒す
 * (報酬を二重配布しない方向の安全側)。
 */
export async function recordLineEventOnce(input: {
  eventName: string;
  key: string;
  metadata: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await supabaseAdmin.from("events").insert({
    id: deterministicLineEventId(input.eventName, input.key),
    event_name: input.eventName,
    owner_token: null,
    locale: "ja",
    metadata: input.metadata,
  });
  if (!error) return true;
  if (error.code !== "23505") {
    console.error("[line-events] once insert failed", {
      eventName: input.eventName,
      message: error.message,
    });
  }
  return false;
}

/** recordLineEventOnce で記録済みかどうか (請求せず状態だけ見る)。エラー時は false。 */
export async function hasLineEventOnce(
  eventName: string,
  key: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", deterministicLineEventId(eventName, key))
    .maybeSingle();
  if (error) {
    console.error("[line-events] once lookup failed", {
      eventName,
      message: error.message,
    });
    return false;
  }
  return Boolean(data);
}

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
