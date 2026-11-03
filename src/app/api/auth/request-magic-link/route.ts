import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { checkOrigin } from "@/lib/origin-check";
import { requestOrigin } from "@/lib/request-origin";
import { sendLoginCodeEmail } from "@/lib/email";
import { LOGIN_CODE_SECONDS, LOGIN_RESEND_SECONDS, loginCodeToken, newLoginCode, normalizeLoginEmail } from "@/lib/login-code";
import { isLoginMailPreview, issuePreviewMail } from "@/lib/login-mail-preview";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!checkOrigin(request).ok) return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const parsed = await readJsonObject(request, 2048);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid request" }, { status: parsed.status });
  const email = normalizeLoginEmail(parsed.value.email);
  if (!email) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  const locale = ["ko", "en", "id"].includes(String(parsed.value.locale)) ? parsed.value.locale as "ko" | "en" | "id" : "ja";
  const reply = (challenge: string) => NextResponse.json({ ok: true, challenge, retryAfter: LOGIN_RESEND_SECONDS }, { headers: { "Cache-Control": "no-store" } });
  if (isLoginMailPreview(request)) {
    const mail = issuePreviewMail(email);
    if (!mail) return NextResponse.json({ error: "Please wait before requesting another code", retryAfter: 60 }, { status: 429 });
    return NextResponse.json({ ok: true, challenge: mail.id, retryAfter: LOGIN_RESEND_SECONDS, preview: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const limits = await Promise.all([
    consumeRateLimit(request, { scope: "login-code-send-ip", limit: 20, windowSeconds: 600 }),
    consumeRateLimit(request, { scope: "login-code-send-email", identifier: email, limit: 1, windowSeconds: 60 }),
  ]);
  if (limits.some(l => !l.enforced)) return NextResponse.json({ error: "Sign-in temporarily unavailable" }, { status: 503 });
  if (limits.some(l => !l.allowed)) return NextResponse.json({ error: "Please wait before requesting another code", retryAfter: 60 }, { status: 429 });
  const { challenge, code } = newLoginCode();
  const { data: user, error } = await supabaseAdmin.from("users").select("id")
    .eq("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Sign-in temporarily unavailable" }, { status: 503 });
  const base = requestOrigin(request);
  if (!user) {
    await sendLoginCodeEmail({ to: email, url: new URL(locale === "ja" ? "/diagnosis" : `/${locale}/diagnosis`, base).href, locale, kind: "welcome" });
    return reply(challenge);
  }
  const secret = process.env.LOGIN_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return NextResponse.json({ error: "Sign-in temporarily unavailable" }, { status: 503 });
  const token = loginCodeToken(email, challenge, code, secret);
  // Resending invalidates only code-based links; existing Google/email links are untouched.
  const { error: invalidateError } = await supabaseAdmin.from("magic_links").update({ used_at: new Date().toISOString() })
    .eq("email", email).like("token", "otp\\_%").is("used_at", null);
  if (invalidateError) return NextResponse.json({ error: "Sign-in temporarily unavailable" }, { status: 503 });
  const { error: insertError } = await supabaseAdmin.from("magic_links").insert({
    user_id: user.id, email, token, expires_at: new Date(Date.now() + LOGIN_CODE_SECONDS * 1000).toISOString(),
  });
  if (insertError) return NextResponse.json({ error: "Sign-in temporarily unavailable" }, { status: 503 });
  const url = new URL("/api/auth/verify-magic-link", base);
  url.searchParams.set("token", token);
  if (locale !== "ja") url.searchParams.set("locale", locale);
  // The response never discloses account existence or mail delivery status.
  await sendLoginCodeEmail({ to: email, url: url.href, code, locale, kind: "login" });
  return reply(challenge);
}
