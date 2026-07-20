// プレミアム化 v3 Day 6: マジックリンク発行 API
//
// POST /api/auth/request-magic-link
//   body: { email: string }
//
// 動作:
//   1. checkOrigin で CSRF 弾く
//   2. email バリデーション (簡易、@ + ドメイン形式)
//   3. レート制限: 同一 email から直近 5 分以内に未消費 magic_link がある場合は
//      新規発行をスキップして 200 を返す (同じレスポンス形)
//   4. users WHERE email = ? を SELECT
//      - 該当なし: 何もせず 200 (enumeration 対策)
//      - 該当あり: nanoid(40) で token 生成 → magic_links INSERT
//        (expires_at = now + 1h) → Resend でメール送信 → 200
//   5. 同 email に複数 users 行が並ぶケース (再診断履歴) は最新 created_at 1 件を採用
//
// レスポンス: 常に 200 { ok: true }
//   フロントは「メールを送りました (届いてなければ無視)」と表示する想定。
//   enumeration 対策のため成功・失敗を区別せず、latency も大差ないようにする。
//
// created_ip カラム: x-forwarded-for (Vercel) or x-real-ip からリクエスト IP を記録。

import { NextRequest, NextResponse } from "next/server";
import { customAlphabet } from "nanoid";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { sendMagicLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

// .env.local で NEXT_PUBLIC_SITE_URL="" の空文字を弾くため || を使用 (?? は不可)
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// nanoid デフォルト URL-safe alphabet で 40 文字 = 240 bit エントロピー
const generateMagicLinkToken = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-",
  40,
);

const ONE_HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 分

// 簡易 email validation。本格的な RFC 5322 は不要、典型的なミスを弾く程度。
function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  // local@domain.tld 形式の最低要件
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: NextRequest) {
  const originCheck = checkOrigin(request);
  if (!originCheck.ok) {
    return NextResponse.json({ error: originCheck.error }, { status: 403 });
  }

  // 異なるメールアドレスを使った大量送信も、接続元単位で抑える。
  const ipLimit = await consumeRateLimit(request, {
    scope: "magic-link-request-ip",
    limit: 20,
    windowSeconds: 600,
  });
  if (!ipLimit.allowed) {
    // アカウントの有無や制限状態を推測させないため、通常時と同じレスポンスにする。
    return NextResponse.json({ ok: true });
  }

  // ===== body parse =====
  const parsedBody = await readJsonObject(request, 2 * 1024);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.error },
      { status: parsedBody.status },
    );
  }
  const body = parsedBody.value;
  const locale = body.locale === "ko" ? "ko" : "ja";

  if (!isValidEmail(body.email)) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 },
    );
  }
  const email = body.email.trim().toLowerCase();

  // ===== users 検索 (同 email に複数行ある場合は最新を採用) =====
  const { data: userRow } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 該当なし: enumeration 対策で何もせず 200
  if (!userRow) {
    return NextResponse.json({ ok: true });
  }
  const userId = userRow.id as string;

  // ===== レート制限: 直近 5 分以内に未消費の magic_link があればスキップ =====
  const rateLimitCutoff = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MS,
  ).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("magic_links")
    .select("id, created_at")
    .eq("user_id", userId)
    .is("used_at", null)
    .gte("created_at", rateLimitCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    // 既に発行済 (5 分以内) → 新規発行せず 200
    // フロント側は「送信済」UI を出す。本当に届いてない場合、5 分後に再試行可能。
    return NextResponse.json({ ok: true });
  }

  // ===== magic_links INSERT =====
  const token = generateMagicLinkToken();
  const expiresAt = new Date(Date.now() + ONE_HOUR_MS).toISOString();
  const ip = clientIp(request);

  const { error: insErr } = await supabaseAdmin.from("magic_links").insert({
    user_id: userId,
    token,
    email,
    expires_at: expiresAt,
    created_ip: ip,
  });

  if (insErr) {
    console.error("[auth/request-magic-link] INSERT error:", insErr);
    // ここでエラー詳細を露出すると enumeration ヒントになるため共通 200 を返す
    return NextResponse.json({ ok: true });
  }

  // ===== メール送信 (失敗時もレスポンスは 200、enumeration 対策) =====
  const magicLinkUrl = new URL("/api/auth/verify-magic-link", SITE_URL);
  magicLinkUrl.searchParams.set("token", token);
  if (locale === "ko") magicLinkUrl.searchParams.set("locale", "ko");
  try {
    await sendMagicLinkEmail({
      to: email,
      magicLinkUrl: magicLinkUrl.toString(),
      locale,
    });
  } catch (error) {
    console.error("[auth/request-magic-link] email send error:", error);
  }

  return NextResponse.json({ ok: true });
}
