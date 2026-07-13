import { NextResponse } from "next/server";

// 現在の画面は /api/friend-answer/v2 のみを利用する。
// 任意JSONを保存できた旧13問APIは、データ汚染経路を残さないため明示的に停止する。
export async function POST() {
  return NextResponse.json(
    { error: "This API version is no longer supported" },
    { status: 410 },
  );
}
