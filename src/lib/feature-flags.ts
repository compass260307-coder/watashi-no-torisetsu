// プレミアム化 v3 Day 10: feature flag utilities
//
// Phase 1 (Web ファースト) は LINE 通知を OFF にする。Phase 2 で復活時は
// 環境変数 LINE_NOTIFICATIONS_ENABLED=true にすれば LINE 通知が再開する設計。
//
// 厳格 string 比較 ("true" のみ true、それ以外は false) で、
// 想定外の値 ("True" / "TRUE" / "1" 等) はすべて OFF 扱いとする (fail-safe)。

/**
 * LINE 通知 (push / reply) が有効か。
 *
 * Phase 1: false 固定 (Web ファースト主動線、メールに集約)
 * Phase 2: true に戻すと、line-notify.ts の send* / replyToLine 等が復活
 *
 * 呼び出し例:
 *   if (!isLineNotificationsEnabled()) return; // 早期 return
 *   await sendXxxMessage(...);
 */
export function isLineNotificationsEnabled(): boolean {
  return process.env.LINE_NOTIFICATIONS_ENABLED === "true";
}
