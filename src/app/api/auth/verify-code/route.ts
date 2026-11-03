import { NextRequest, NextResponse } from "next/server";
import { checkOrigin } from "@/lib/origin-check";
import { consumeRateLimit, readJsonObject } from "@/lib/api-security";
import { normalizeLoginEmail, validLoginCodeInput, loginCodeToken } from "@/lib/login-code";
import { isLoginMailPreview, verifyPreviewCode, PREVIEW_RESULT } from "@/lib/login-mail-preview";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!checkOrigin(request).ok) return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  const parsed = await readJsonObject(request, 2048);
  if (!parsed.ok) return NextResponse.json({ error: "Invalid request" }, { status: parsed.status });
  const { challenge, code, locale } = parsed.value;
  const email = normalizeLoginEmail(parsed.value.email);
  const invalid = () => NextResponse.json({ error: "invalid_code" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (!email || !validLoginCodeInput(challenge, code)) return invalid();
  if (isLoginMailPreview(request)) {
    const mail = verifyPreviewCode(challenge as string, code as string);
    return mail && mail.email === email
      ? NextResponse.json({ redirect: PREVIEW_RESULT, preview: true }, { headers: { "Cache-Control": "no-store" } }) : invalid();
  }
  const limits = await Promise.all([
    consumeRateLimit(request, { scope: "login-code-verify-ip", limit: 60, windowSeconds: 600 }),
    consumeRateLimit(request, { scope: "login-code-verify-email", identifier: email, limit: 20, windowSeconds: 600 }),
    consumeRateLimit(request, { scope: "login-code-verify-challenge", identifier: `${email}:${challenge}`, limit: 5, windowSeconds: 600 }),
  ]);
  if (limits.some(l => !l.enforced || !l.allowed)) return invalid();
  const secret = process.env.LOGIN_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return invalid();
  const token = loginCodeToken(email, challenge as string, code as string, secret);
  const { data, error } = await supabaseAdmin.from("magic_links").select("id").eq("token", token).eq("email", email)
    .is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !data) return invalid();
  const params = new URLSearchParams({ token });
  if (locale === "en" || locale === "ko" || locale === "id") params.set("locale", locale);
  // The existing completion route atomically consumes the token and handles account-switch confirmation.
  return NextResponse.json({ redirect: `/api/auth/verify-magic-link?${params}` }, { headers: { "Cache-Control": "no-store" } });
}
