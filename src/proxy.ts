import { NextResponse, type NextRequest } from "next/server";
import { MISSING_STATIC_ASSET_BOOTSTRAP, STATIC_ASSET_RECOVERY_HEADERS } from "@/lib/static-asset-recovery.mjs";
import {
  CHECKOUT_COMMERCE_LOCALE_COOKIE,
  isCheckoutCommerceDisclosureVisit,
} from "@/lib/checkout-commerce-disclosure";

export async function proxy(request: NextRequest) {
  // Vercel terminates missing _next/static requests before fallback rewrites.
  // Only the legacy namespace needs this probe; current immutable assets bypass it.
  if (request.nextUrl.pathname.startsWith("/_next/static/chunks/") && request.nextUrl.pathname.endsWith(".js")) {
    if (request.method !== "GET" || request.headers.get("x-wt-static-asset-probe") === "1") {
      return NextResponse.next();
    }
    const headers = new Headers({ "x-wt-static-asset-probe": "1" });
    // Same-origin only; preserve Preview protection credentials for the HEAD subrequest.
    for (const key of ["cookie", "authorization", "x-vercel-protection-bypass"]) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    try {
      const asset = await fetch(request.url, {
        method: "HEAD", headers, cache: "no-store", redirect: "manual",
        signal: AbortSignal.timeout(2000),
      });
      if (asset.status === 404) {
        return new NextResponse(MISSING_STATIC_ASSET_BOOTSTRAP, { headers: STATIC_ASSET_RECOVERY_HEADERS });
      }
    } catch { /* A timeout, network failure or protected asset is not proof of a missing chunk. */ }
    return NextResponse.next();
  }
  if (
    request.cookies.get(CHECKOUT_COMMERCE_LOCALE_COOKIE)?.value !== "ko" ||
    !isCheckoutCommerceDisclosureVisit(request.headers.get("referer"))
  ) {
    return NextResponse.next();
  }

  const destination = request.nextUrl.clone();
  destination.pathname = "/ko/legal/commerce";
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie, Referer");
  return response;
}

export const config = {
  matcher: ["/legal/commerce", "/_next/static/chunks/:assetPath(.*\\.js)"],
};
