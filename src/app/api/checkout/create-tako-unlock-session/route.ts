// 友達診断 (/tako) の ¥799 単体販売 (tako_unlock) は 2026-07-22 に廃止。
//
// 商品は自己診断と統合され、¥499 完全版パッケージ (full_access) に一本化した。
// 友達診断結果は full_access 購入で解放される (entitlements.hasTakoAccess が
// full_access 保有者を true にする)。過去に ¥799 を購入した人の権限は
// payment_history から引き続き読み取られ、維持される。
//
// このエンドポイントは新規の課金セッションを一切発行しない。キャッシュ済みの
// 旧クライアントが叩いても課金が起きないよう 410 Gone を返すだけの防御スタブ。
// (旧実装は git 履歴に残置。復活が必要なら履歴から戻す。)

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error: "この商品は完全版パッケージに統合されました。",
      code: "tako_unlock_discontinued",
    },
    { status: 410 },
  );
}
