// Stripe's commerce-disclosure footer URL is shared by every Checkout locale.
// Remember only the language, never the buyer or Checkout Session, on our site.
export const CHECKOUT_COMMERCE_LOCALE_COOKIE = "wt_checkout_commerce_locale";

export function checkoutCommerceDisclosureCookie(locale: string, secure: boolean) {
  return {
    name: CHECKOUT_COMMERCE_LOCALE_COOKIE,
    value: locale === "ko" ? "ko" : "",
    path: "/legal/commerce",
    maxAge: locale === "ko" ? 86400 : 0,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
  };
}

export function isCheckoutCommerceDisclosureVisit(referer: string | null): boolean {
  // Stripe may suppress Referer. In-site language switching must still work.
  if (!referer) return true;
  try {
    const url = new URL(referer);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

export function koreanCheckoutSubmitMessage(message: string | null, siteUrl: string) {
  const disclosureUrl = new URL("/ko/legal/commerce", siteUrl).toString();
  return `${message ? `${message} ` : ""}[판매 및 환불 안내](${disclosureUrl})를 확인해 주세요.`;
}
