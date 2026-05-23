// プレミアム化 v3 Day 3: 通知設定 API (Web ファースト化により一時停止)
//
// LINE 通知前提の通知設定機能は Phase 2 (LINE 復活時) まで凍結。
// 旧コード (LIFF id_token 認可 + notification_preferences upsert) は
// git 履歴に保持されているので Phase 2 で復活可能。
//
// 現状の API は 410 Gone を返す。フロントは UI からこの設定セクションを
// 削除済み (Day 3 settings/page.tsx 修正で対応予定)。

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GONE_PAYLOAD = {
  error: "Notification preferences are paused in Web-first mode.",
  hint: "LINE 連携復活 (Phase 2) と同時にこの API も復活します。",
};

export async function GET() {
  return NextResponse.json(GONE_PAYLOAD, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE_PAYLOAD, { status: 410 });
}
