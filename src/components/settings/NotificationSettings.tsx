"use client";

// プレミアム化 v3 Day 3: 通知設定タブ (Web ファースト化により一時停止)
//
// LINE 通知前提だった通知設定 UI は Phase 2 (LINE 復活時) まで停止。
// API /api/settings/notifications は 410 を返す。
// このコンポーネントはプレースホルダ表示のみ。
// 旧バージョン (5 カテゴリ ON/OFF + 楽観的更新) は git 履歴に保持。

export function NotificationSettings() {
  return (
    <div className="flex flex-col gap-3 py-6">
      <p className="text-sm text-foreground leading-relaxed">
        通知設定は現在準備中です。
      </p>
      <p className="text-xs text-muted leading-relaxed">
        メール通知 / LINE 通知は今後のアップデートで戻ってきます。
      </p>
    </div>
  );
}
