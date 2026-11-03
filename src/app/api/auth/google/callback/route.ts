import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/session";
import { classifyType } from "@/lib/diagnosis";
import { PLACEHOLDER_SCORES } from "@/lib/placeholder-user";
import { resolveGoogleLoginAccount } from "@/lib/google-login-account";
import { randomBytes } from "node:crypto";
import { GOOGLE_FLOW_COOKIE, googleCredentials, googleRequestOrigin, readGoogleFlow, verifyGoogleIdentity } from "@/lib/google-login";
import { checkOrigin } from "@/lib/origin-check";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const base = googleRequestOrigin(request);
  if (!checkOrigin(new Request(base, { method: "POST", headers: { origin: base } })).ok) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, base), 303);
    response.cookies.set(GOOGLE_FLOW_COOKIE, "", {
      path: "/api/auth/google", maxAge: 0, httpOnly: true,
      secure: process.env.NODE_ENV === "production", sameSite: "lax",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const fail = (reason: string) => finish(`/login?google_error=${reason}`);
  const credentials = googleCredentials();
  const flow = readGoogleFlow(request.cookies.get(GOOGLE_FLOW_COOKIE)?.value, request.nextUrl.searchParams.get("state"));
  if (!credentials || !flow) return fail("failed");
  if (request.nextUrl.searchParams.has("error")) return fail("cancelled");
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return fail("failed");

  try {
    const result = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: credentials.clientId, client_secret: credentials.clientSecret,
        code, code_verifier: flow.verifier, grant_type: "authorization_code",
        redirect_uri: new URL("/api/auth/google/callback", base).href,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) return fail("failed");
    const tokens = await result.json();
    if (typeof tokens.id_token !== "string") return fail("failed");
    const email = await verifyGoogleIdentity(tokens.id_token, credentials.clientId, flow.nonce);
    if (!email) return fail("email_link");

    const user = await resolveGoogleLoginAccount(email, await getSession(request), {
      async findByEmail(verifiedEmail) {
        const { data, error } = await supabaseAdmin.from("users").select("id")
          .eq("email", verifiedEmail).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (error) throw new Error("Account lookup failed");
        return data;
      },
      async claimAnonymous(id, verifiedEmail) {
        // Atomic guard: never replace an email set by another login request.
        const { data, error } = await supabaseAdmin.from("users")
          .update({ email: verifiedEmail, email_verified_at: new Date().toISOString() })
          .eq("id", id).is("email", null).select("id").maybeSingle();
        if (error) throw new Error("Account linking failed");
        return data;
      },
      async create(verifiedEmail) {
        // A neutral row is required by the existing NOT NULL diagnosis schema.
        // The completion flow recognizes it and opens diagnosis, never a fake result.
        const { data, error } = await supabaseAdmin.from("users").insert({
          email: verifiedEmail,
          email_verified_at: new Date().toISOString(),
          plan: "free",
          type_id: classifyType(PLACEHOLDER_SCORES),
          scores: PLACEHOLDER_SCORES,
          owner_token: nanoid(16),
          invite_code: nanoid(8),
          preferred_locale: "ja",
        }).select("id").single();
        if (error || !data) throw new Error("Account creation failed");
        return data;
      },
    });

    // Reuse the existing one-time completion flow, including account-switch
    // confirmation, session rotation and purchaser/diagnosis redirects. No email is sent.
    const token = randomBytes(30).toString("base64url");
    const { error: insertError } = await supabaseAdmin.from("magic_links").insert({
      user_id: user.id, email, token,
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
    });
    if (insertError) return fail("failed");
    return finish(`/api/auth/verify-magic-link?token=${token}`);
  } catch {
    // Never log authorization codes, ID tokens, email addresses or secrets.
    return fail("failed");
  }
}
