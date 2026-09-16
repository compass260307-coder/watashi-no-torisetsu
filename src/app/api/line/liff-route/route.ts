// LIFF遷移解決API。/liff (LIFF入口ページ) から呼ばれ、
// LINEアクセストークンを検証して「タップした本人」専用のURLを返す。
//
// dest:
//   me   - 自分の結果ページ (/me/<owner_token>)
//   plus - Alice Plus 紹介LP (署名付き /line/plus)
//   menu - 全機能一覧 (/line/menu、未連携でも閲覧可能)
//   love-footprints - 恋の足あと (/line/love-footprints)
//
// 検証はLINE公式の2段階: ①/oauth2/v2.1/verify でトークンが自分のLoginチャネル発行か
// 確認 → ②/v2/profile で userId を取得。env: LINE_LOGIN_CHANNEL_ID

import { NextRequest, NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/api-security";
import { recordLineEvent } from "@/lib/line-events";
import {
  buildLineLoveFootprintsPageUrl,
  buildLineMissionsPageUrl,
  buildLinePlusPageUrl,
} from "@/lib/line-plus";
import { resolveSiteUrl } from "@/lib/site-url";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const loginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!loginChannelId) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: { accessToken?: string; dest?: string };
  try {
    body = (await request.json()) as { accessToken?: string; dest?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const accessToken = body.accessToken ?? "";
  const dest =
    body.dest === "plus" ||
    body.dest === "missions" ||
    body.dest === "menu" ||
    body.dest === "love-footprints"
      ? body.dest
      : "me";
  if (!accessToken) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  // ① トークンが自分のLoginチャネル発行で有効期限内か
  const verifyRes = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
  );
  const verify = (await verifyRes.json().catch(() => ({}))) as {
    client_id?: string;
    expires_in?: number;
  };
  if (
    !verifyRes.ok ||
    verify.client_id !== loginChannelId ||
    (verify.expires_in ?? 0) <= 0
  ) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  // ② 本人の userId
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = (await profileRes.json().catch(() => ({}))) as {
    userId?: string;
  };
  const lineUserId = profile.userId;
  if (!profileRes.ok || !lineUserId) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit(request, {
    scope: "line-liff-route",
    identifier: lineUserId,
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  if (dest === "menu") {
    await recordLineEvent({
      eventName: "line_liff_route",
      metadata: { dest, line_user_id: lineUserId },
    });
    return NextResponse.json({ url: `${resolveSiteUrl()}/line/menu` });
  }

  const { data: account } = await supabaseAdmin
    .from("line_accounts")
    .select("user_id")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  if (!account?.user_id) {
    return NextResponse.json({ error: "not_linked" }, { status: 404 });
  }

  let url: string;
  if (dest === "plus") {
    url = buildLinePlusPageUrl(lineUserId);
  } else if (dest === "missions") {
    url = buildLineMissionsPageUrl(lineUserId);
  } else if (dest === "love-footprints") {
    url = buildLineLoveFootprintsPageUrl(lineUserId);
  } else {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("owner_token")
      .eq("id", account.user_id)
      .maybeSingle();
    if (!user?.owner_token) {
      return NextResponse.json({ error: "not_linked" }, { status: 404 });
    }
    url = `${resolveSiteUrl()}/me/${user.owner_token}`;
  }

  await recordLineEvent({
    eventName: "line_liff_route",
    metadata: { dest, line_user_id: lineUserId, user_id: account.user_id },
  });

  return NextResponse.json({ url });
}
