import type { Metadata } from "next";
import EnLegalDocument from "@/components/en/EnLegalDocument";
import { EN_FULL_ACCESS_PRICE_USD_CENTS } from "@/lib/access-products";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Sales & Refund Policy",
  description: "Seller, payment, delivery, and refund information for the English Complete Edition.",
  alternates: localizedAlternates("en", "/legal/commerce", "/ko/legal/commerce", "/en/legal/commerce", "/id/legal/commerce"),
  robots: { index: true, follow: true },
};

export default function EnglishCommercePage() {
  return (
    <EnLegalDocument title="Sales & Refund Policy" lastUpdated="September 10, 2026">
      <p>This page provides seller and transaction information for paid content in the English version of Alice Personalities.</p>

      <h2>Seller and responsible operator</h2>
      <p>Ryunosuke Futami (Alice Personalities Operations Team)</p>

      <h2>Country of operation</h2>
      <p>Japan</p>

      <h2>Business address and telephone number</h2>
      <p>These will be disclosed without delay upon request. Contact us by email before purchase if you wish to receive them.</p>

      <h2>Contact</h2>
      <ul>
        <li>Email: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a></li>
        <li>We normally reply within three business days.</li>
      </ul>

      <h2>Product and price</h2>
      <ul>
        <li>Alice Personalities — Complete Edition: ${(EN_FULL_ACCESS_PRICE_USD_CENTS / 100).toFixed(2)} USD, tax included</li>
        <li>One-time payment; no subscription, automatic renewal, or required additional payment</li>
      </ul>
      <p>The final amount is displayed again in Stripe Checkout before payment.</p>

      <h2>What is included</h2>
      <ul>
        <li>Complete personality report and downloadable personal PDF</li>
        <li>Friend perspectives and compatibility insights</li>
        <li>Destiny Blueprint</li>
        <li>30 answers from the personal AI astrologer Alice</li>
        <li>All three Alice tarot readings</li>
      </ul>
      <p>Paid web results and PDFs can be revisited through the same result link or restored after signing in with the checkout email address.</p>

      <h2>Additional costs</h2>
      <p>You are responsible for internet access and data charges needed to use the Service.</p>

      <h2>Payment methods</h2>
      <p>Payment methods actually displayed by Stripe Checkout at the time of purchase may be used. Availability depends on your device, browser, country, and Stripe.</p>

      <h2>Payment and delivery timing</h2>
      <ol>
        <li>Payment is confirmed when checkout is completed.</li>
        <li>For immediate payment methods, access is normally unlocked as soon as payment is confirmed. For delayed methods, access is unlocked after Stripe confirms successful payment.</li>
        <li>A purchase confirmation and recovery instructions are sent to the email address used at checkout.</li>
        <li>Destiny Blueprint generation begins after you enter the requested birth information and may take approximately one minute.</li>
      </ol>

      <h2>Cancellation and 30-day refund guarantee</h2>
      <ol>
        <li>You may request a full refund within 30 days of the payment date.</li>
        <li>Email <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a> with the email address used for payment, payment date, product name, and a clear refund request. A reason is optional.</li>
        <li>The guarantee applies once to each payment transaction.</li>
        <li>We normally initiate a valid refund through Stripe within three business days after verification. The date funds appear depends on the payment provider.</li>
        <li>When a full refund is completed, the paid access granted by that purchase ends.</li>
        <li>We may request identity or transaction verification where fraud, unauthorized payment, or clear abuse is suspected.</li>
        <li>If the product is not delivered correctly, contact us for restoration, re-delivery, a refund, or another appropriate remedy.</li>
        <li>This guarantee does not limit any mandatory right or remedy available under applicable law.</li>
      </ol>

      <h2>Purchases by minors</h2>
      <p>A minor must obtain consent from a parent or legal guardian before purchase. A purchase made without required consent may be cancelled where applicable law permits.</p>

      <h2>Recommended environment</h2>
      <p>Use a current version of a major mobile or desktop browser such as Safari or Chrome.</p>

      <h2>Complaints and dispute resolution</h2>
      <p>Please contact us first at the email address above. Your right to use consumer dispute-resolution procedures available under applicable law is not restricted.</p>
    </EnLegalDocument>
  );
}
