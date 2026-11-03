import { NextRequest, NextResponse } from "next/server";
import { checkOrigin } from "@/lib/origin-check";
import { GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_SECONDS, googleAuthorizationUrl, googleCredentials, googleRequestOrigin, newGoogleFlow } from "@/lib/google-login";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ available: Boolean(googleCredentials()) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const origin = checkOrigin(request);
  if (!origin.ok) return NextResponse.json({ error: origin.error }, { status: 403 });
  const base = googleRequestOrigin(request);
  if (request.headers.get("origin") !== base) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }
  const credentials = googleCredentials();
  if (!credentials) {
    return NextResponse.redirect(new URL("/login?google_error=unavailable", base), 303);
  }
  const flow = newGoogleFlow();
  const callback = new URL("/api/auth/google/callback", base).href;
  const response = NextResponse.redirect(googleAuthorizationUrl(credentials.clientId, callback, flow), 303);
  response.cookies.set(GOOGLE_FLOW_COOKIE, JSON.stringify(flow), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: GOOGLE_FLOW_SECONDS,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
