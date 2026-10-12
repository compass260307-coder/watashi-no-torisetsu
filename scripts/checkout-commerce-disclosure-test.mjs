import assert from "node:assert/strict";
import { NextResponse } from "next/server.js";
import {
  CHECKOUT_COMMERCE_LOCALE_COOKIE,
  checkoutCommerceDisclosureCookie,
  isCheckoutCommerceDisclosureVisit,
  koreanCheckoutSubmitMessage,
} from "../src/lib/checkout-commerce-disclosure.ts";

const response = NextResponse.json({ url: "https://checkout.stripe.com/c/pay/example" });
response.cookies.set(checkoutCommerceDisclosureCookie("ko", true));
const cookie = response.headers.get("set-cookie");
assert.match(cookie, /wt_checkout_commerce_locale=ko/);
assert.match(cookie, /Path=\/legal\/commerce/);
assert.match(cookie, /Max-Age=86400/);
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /Secure/);
assert.match(cookie, /SameSite=lax/i);
assert.doesNotMatch(cookie, /example|session|email/);

for (const locale of ["ja", "en", "id", "th"]) {
  const reset = NextResponse.json({});
  reset.cookies.set(checkoutCommerceDisclosureCookie(locale, true));
  assert.match(reset.headers.get("set-cookie"), /Max-Age=0/);
  assert.match(reset.headers.get("set-cookie"), /Path=\/legal\/commerce/);
}

assert.equal(isCheckoutCommerceDisclosureVisit(null), true);
assert.equal(isCheckoutCommerceDisclosureVisit("https://checkout.stripe.com/"), true);
for (const referer of [
  "https://www.watashi-torisetsu.com/ko/legal/commerce",
  "https://www.watashi-torisetsu.com/terms",
  "https://checkout.stripe.com.evil.example/",
  "https://checkout.stripe.com@evil.example/",
  "http://checkout.stripe.com/",
  "invalid URL",
]) {
  assert.equal(isCheckoutCommerceDisclosureVisit(referer), false);
}

for (const copy of ["30일 환불 보장.", "1회 결제 · 추가 요금 없음.", null]) {
  const message = koreanCheckoutSubmitMessage(copy, "https://www.watashi-torisetsu.com");
  if (copy) assert.ok(message.startsWith(copy));
  assert.match(message, /\[판매 및 환불 안내\]\(https:\/\/www\.watashi-torisetsu\.com\/ko\/legal\/commerce\)/);
  assert.ok(message.length <= 1200);
}

// Optional HTTP checks exercise the real Next.js proxy, without creating Stripe sessions.
const baseUrl = process.env.CHECKOUT_LEGAL_VERIFY_BASE_URL;
if (baseUrl) {
  for (const [name, headers, expectedRedirect] of [
    ["Korean Checkout footer", { Cookie: `${CHECKOUT_COMMERCE_LOCALE_COOKIE}=ko`, Referer: "https://checkout.stripe.com/" }, true],
    ["Korean Checkout with suppressed Referer", { Cookie: `${CHECKOUT_COMMERCE_LOCALE_COOKIE}=ko` }, true],
    ["Japanese visit", {}, false],
    ["Japanese Checkout", { Cookie: `${CHECKOUT_COMMERCE_LOCALE_COOKIE}=ja`, Referer: "https://checkout.stripe.com/" }, false],
    ["Explicit in-site Japanese language switch", { Cookie: `${CHECKOUT_COMMERCE_LOCALE_COOKIE}=ko`, Referer: `${baseUrl}/ko/legal/commerce` }, false],
  ]) {
    const result = await fetch(`${baseUrl}/legal/commerce`, { headers, redirect: "manual" });
    assert.equal(result.status, expectedRedirect ? 307 : 200, name);
    if (expectedRedirect) {
      assert.equal(new URL(result.headers.get("location"), baseUrl).pathname, "/ko/legal/commerce", name);
      assert.match(result.headers.get("cache-control"), /no-store/, name);
      const destination = await fetch(new URL(result.headers.get("location"), baseUrl));
      assert.equal(destination.status, 200, name);
      assert.match(await destination.text(), /판매 및 환불 안내/, name);
    }
    console.log(`PASS ${name}`);
  }
}

console.log("Checkout commerce disclosure regression passed.");
