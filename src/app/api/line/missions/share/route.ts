// ミッション「SNSで共有しよう」の共有ボタン着地API。
// /line/missions と同じ署名付きパラメータ (u/e/s) で本人確認し、
// line_mission_sns_shared (キー=userId:ネットワーク) を1回だけ記録してから
// 各SNSの投稿画面へ302で送る。タップ=達成の性善説方式
// (投稿の実検証は各SNSのAPI無しでは不可能なため)。
// 報酬の受け取りは webhook (handleThemeFortune) の :x/:fb/:th キーが担う。
// 対応SNSを増やす時はページの SNS_MISSIONS と webhook の SNS_NETWORKS も対で更新すること。

import { NextRequest, NextResponse } from "next/server";

import { recordLineEventOnce } from "@/lib/line-events";
import { verifyLinePlusToken } from "@/lib/line-plus";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const SHARE_TEXT =
  "友達診断やってみてほしい!回答してもらうと「まわりから見えているワタシ」がわかるやつです🔮";

// Facebookはテキストのプリセット不可 (URLのみ・OGPカードが出る)
const NETWORKS = {
  x: (text: string, url: string) =>
    `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`,
  fb: (_text: string, url: string) =>
    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  th: (text: string, url: string) =>
    `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`,
} as const;

function isPreviewBot(userAgent: string): boolean {
  return /bot|facebookexternalhit|line-poker|crawler|spider|preview/i.test(
    userAgent,
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lineUserId = params.get("u") ?? "";
  const expiresAtMs = Number(params.get("e"));
  const signature = params.get("s") ?? "";
  const network = params.get("n") ?? "";

  if (!(network in NETWORKS)) {
    return NextResponse.json({ error: "unknown_network" }, { status: 400 });
  }
  if (!verifyLinePlusToken({ lineUserId, expiresAtMs, signature })) {
    return NextResponse.json({ error: "invalid_token" }, { status: 403 });
  }

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    return NextResponse.json({ error: "not_linked" }, { status: 403 });
  }
  const userId = account.user_id;

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("invite_code")
    .eq("id", userId)
    .maybeSingle();
  const inviteUrl = user?.invite_code
    ? `${resolveSiteUrl()}/friend/${user.invite_code}`
    : resolveSiteUrl();

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!isPreviewBot(userAgent)) {
    await recordLineEventOnce({
      eventName: "line_mission_sns_shared",
      key: `${userId}:${network}`,
      metadata: { user_id: userId, line_user_id: lineUserId, network },
    });
  }

  const buildUrl = NETWORKS[network as keyof typeof NETWORKS];
  return NextResponse.redirect(buildUrl(SHARE_TEXT, inviteUrl), 302);
}
