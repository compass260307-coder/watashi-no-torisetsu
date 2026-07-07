// プレミアム化 v3 Day 6: マジックリンク検証 API
//
// GET /api/auth/verify-magic-link?token=xxx
//
// 動作:
//   1. token を magic_links から検索: used_at IS NULL AND expires_at > now()
//   2. 該当なし → /auth/error?reason=invalid_or_expired にリダイレクト
//   3. 該当あり:
//      - magic_links.used_at = now() に UPDATE (単発消費)
//      - users.email_verified_at が NULL なら now() を SET
//      - rotateSession(user_id) で session_token を再発行 + Cookie set
//      - /zukan-mine に 302 リダイレクト
//        (/me/[token] は Day 9 で実装、それまで /zukan-mine が永続アクセス点)
//
// 注: GET だが副作用 (used_at UPDATE) あり。token 自体が機密 = 知らない第三者が
// 任意の URL を踏ませても token を持っていないと意味がない、という前提に依存。
// CSRF 対策は token のエントロピー (240 bit) + 1 時間期限 + 単発消費で代替。

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { rotateSession, getSession } from "@/lib/session";

export const runtime = "nodejs";

// .env.local で NEXT_PUBLIC_SITE_URL="" 等の空文字も弾くため || を使用 (?? は不可)
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function errorRedirect(request: NextRequest, reason: string): NextResponse {
  // request.nextUrl は常に絶対 URL なので、これを base に取れば SITE_URL の
  // 値に依存せず安全。Vercel / localhost / preview 全環境で動く。
  const url = new URL("/auth/error", request.nextUrl);
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return errorRedirect(request, "missing_token");
  }

  // ===== magic_links 検索 (active 行のみ) =====
  const nowIso = new Date().toISOString();
  const { data: row, error: selErr } = await supabaseAdmin
    .from("magic_links")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (selErr) {
    console.error("[auth/verify-magic-link] SELECT error:", selErr);
    return errorRedirect(request, "server_error");
  }
  if (!row) {
    return errorRedirect(request, "invalid_or_expired");
  }

  const linkId = row.id as string;
  const userId = row.user_id as string;

  // ===== 衝突検知 (v1 インタースティシャル) =====
  // 現 Cookie セッション A が存在し、リンク先アカウント B (userId) と別 user_id のとき、
  // サイレントな切替を避ける。ここでは token をまだ消費せず /login/confirm へ誘導し、
  // 確認画面で「続ける」(?confirm=1) が押されたときだけ実際に消費 + rotate する。
  // A が無い / A.id === B は従来どおり素通し。
  const confirmed = request.nextUrl.searchParams.get("confirm") === "1";
  const current = await getSession(request);
  if (current && current.id !== userId && !confirmed) {
    const url = new URL("/login/confirm", request.nextUrl);
    url.searchParams.set("token", token);
    return NextResponse.redirect(url);
  }

  // ===== magic_links.used_at = now() (単発消費) =====
  // race 防止: WHERE used_at IS NULL も追加し、二重消費を atomic に弾く
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("magic_links")
    .update({ used_at: nowIso })
    .eq("id", linkId)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (updErr) {
    console.error("[auth/verify-magic-link] UPDATE error:", updErr);
    return errorRedirect(request, "server_error");
  }
  if (!updated) {
    // 他リクエストが先に消費 (race)
    return errorRedirect(request, "invalid_or_expired");
  }

  // ===== users.email_verified_at を初回のみ SET =====
  // (既に値が入っている場合は触らない、初回確認日時として保持)
  const { error: userUpdErr } = await supabaseAdmin
    .from("users")
    .update({ email_verified_at: nowIso })
    .eq("id", userId)
    .is("email_verified_at", null);
  if (userUpdErr) {
    // 致命ではない (verified 時刻は監査用)、続行
    console.warn(
      "[auth/verify-magic-link] email_verified_at update warning:",
      userUpdErr.message,
    );
  }

  // ===== session 再発行 + Cookie set =====
  try {
    await rotateSession(userId);
  } catch (err) {
    console.error("[auth/verify-magic-link] rotateSession error:", err);
    return errorRedirect(request, "server_error");
  }

  // ===== 着地: /me/[owner_token] (自分のトリセツ) =====
  // 復元の目的は「自分の結果に戻る」なので、B の owner_token を引いて /me/[owner_token] へ。
  // owner_token が無い (レガシー行) 場合のみ /zukan-mine にフォールバック。
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("owner_token")
    .eq("id", userId)
    .maybeSingle();
  const ownerToken = (userRow?.owner_token as string | null) ?? null;
  const dest = ownerToken ? `/me/${ownerToken}` : "/zukan-mine";
  return NextResponse.redirect(new URL(dest, request.nextUrl));
}
