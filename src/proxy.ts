import { NextResponse, type NextRequest } from "next/server";
import {
  CHECKOUT_COMMERCE_LOCALE_COOKIE,
  isCheckoutCommerceDisclosureVisit,
} from "@/lib/checkout-commerce-disclosure";

export function proxy(request: NextRequest) {
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
  matcher: "/legal/commerce",
};
