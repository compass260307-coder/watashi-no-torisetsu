import { NextRequest, NextResponse } from "next/server";
import { resolveLineResultUpgradeIdentity } from "@/lib/line-result-upgrade";
import { LINE_RESULT_UPGRADE_COOKIE, LINE_RESULT_UPGRADE_TTL_SECONDS, verifyLineResultUpgradeIdentity } from "@/lib/line-result-upgrade-token";
import { consumeRateLimit } from "@/lib/api-security";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const limit = await consumeRateLimit(request, { scope: "line-result-upgrade-enter", limit: 30, windowSeconds: 600 });
  if (!limit.allowed) return new NextResponse(null, { status: 429 });
  const user = await resolveLineResultUpgradeIdentity(token);
  const identity = user ? verifyLineResultUpgradeIdentity(token) : null;
  if (!identity) return NextResponse.redirect(new URL("/line/menu", request.url));
  const response = NextResponse.redirect(new URL("/line/result-upgrade", request.url));
  response.cookies.set(LINE_RESULT_UPGRADE_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: Math.min(LINE_RESULT_UPGRADE_TTL_SECONDS, Math.floor((identity.expiresAt - Date.now()) / 1000)),
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
