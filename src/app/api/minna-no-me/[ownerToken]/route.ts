// 「みんなの目」他者視点解説文の遅延生成 API。
//   タブ解除後 (友達3人以上) にクライアント (MinnaNoMePanel) が POST で叩く。
//   生成済み & 友達数が変わっていなければキャッシュを即返す。未生成なら生成して返す。
//   生成中 (別リクエストが claim 済) は status='generating' を返し、クライアントが再試行する。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { generateMinnaNoMe } from "@/lib/minna-no-me-generator";

export const runtime = "nodejs";
// AI 生成は数十秒かかりうるため上限を引き上げる (既存の統合トリセツ生成と同方針)。
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ ownerToken: string }> },
) {
  const { ownerToken } = await params;
  if (!ownerToken) {
    return NextResponse.json({ error: "ownerToken required" }, { status: 400 });
  }

  // owner_token → users.id 解決
  const { data: owner, error: ownerErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("owner_token", ownerToken)
    .maybeSingle();
  if (ownerErr) {
    return NextResponse.json({ error: "lookup error" }, { status: 500 });
  }
  if (!owner) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await generateMinnaNoMe(owner.id as string);

  switch (result.status) {
    case "completed":
      return NextResponse.json({ status: "completed", text: result.text });
    case "generating":
      return NextResponse.json({ status: "generating" });
    case "locked":
      return NextResponse.json(
        { status: "locked", friendCount: result.friendCount },
        { status: 403 },
      );
    case "failed":
    default:
      return NextResponse.json(
        { status: "failed", error: result.error },
        { status: 500 },
      );
  }
}
