// この端末の session 紐付けをクリアする API (共用端末からの脱出 / 自動リダイレクトの逃げ道)。
//
// 動作:
//   - 対応する users 行があれば destroySession で session_token を NULL 化 + wn_session cookie 削除
//   - users 行本体 (診断結果 / owner_token) は削除しない
//     → 本人は別端末や email magic-link / LINE で復元可能な状態を保つ
//   - 有効な session が無くても残存 cookie を削除し、冪等に success を返す
//
// CSRF: 状態変更 POST なので checkOrigin で Origin を検証する (既存 API と同方針)。

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { checkOrigin } from "@/lib/origin-check";
import { getSession, destroySession, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  const user = await getSession(request);

  if (user) {
    // DB の session_token を NULL 化 + cookie 削除。診断結果 (users 行) は残す。
    await destroySession(user.id);
  } else {
    // 有効な session が無くても、残存 cookie を削除して未診断状態にする (冪等)。
    const c = await cookies();
    c.delete(SESSION_COOKIE_NAME);
  }

  return NextResponse.json({ success: true });
}
