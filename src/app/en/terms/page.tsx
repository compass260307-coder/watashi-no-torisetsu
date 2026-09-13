import type { Metadata } from "next";
import EnLegalDocument from "@/components/en/EnLegalDocument";
import { EN_FULL_ACCESS_PRICE_USD_CENTS } from "@/lib/access-products";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing the English version of Alice Test.",
  alternates: localizedAlternates("en", "/terms", "/ko/terms", "/en/terms"),
  robots: { index: true, follow: true },
};

export default function EnglishTermsPage() {
  return (
    <EnLegalDocument title="Terms of Service" lastUpdated="September 10, 2026">
      <p>
        These Terms of Service (“Terms”) govern the English version of Alice Test (“Service”), provided by Ryunosuke Futami / the Alice Test Operations Team (“Operator”). By using the Service, you agree to these Terms.
      </p>

      <h2>1. Scope</h2>
      <ol>
        <li>These Terms apply to the relationship between each user and the Operator.</li>
        <li>Notices and policies displayed within the Service form part of these Terms.</li>
        <li>Mandatory consumer-protection laws applicable to a user take precedence where they cannot lawfully be excluded.</li>
      </ol>

      <h2>2. The Service</h2>
      <ol>
        <li>The Service provides a Big Five-based personality test, character-type results, friend perspectives, compatibility content, astrology-based content, tarot content, and AI-generated conversations.</li>
        <li>The basic test can be used without creating an account. An email address may be used to restore results and paid access.</li>
        <li>The Operator may change, add, suspend, or discontinue features when reasonably necessary. Material changes will be announced within the Service where practicable.</li>
      </ol>

      <h2>3. Result links and account access</h2>
      <ol>
        <li>You are responsible for keeping your email and private result links secure. Anyone who receives a result link may be able to view that result.</li>
        <li>You must provide accurate information and must not use another person’s information without permission.</li>
        <li>Report suspected unauthorized access to <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>.</li>
      </ol>

      <h2>4. Children and minors</h2>
      <ol>
        <li>A minor must obtain consent from a parent or legal guardian before purchasing paid content.</li>
        <li>A contract made without required guardian consent may be cancelled where applicable law permits.</li>
        <li>Children under 13 may use the Service only under the supervision of a parent or legal guardian.</li>
      </ol>

      <h2>5. Prohibited conduct</h2>
      <p>You must not:</p>
      <ol>
        <li>violate laws, public order, intellectual-property rights, privacy, reputation, or other rights;</li>
        <li>impersonate another person or obtain result links or access rights fraudulently;</li>
        <li>interfere with the Service, exploit security vulnerabilities, or attempt unauthorized access;</li>
        <li>scrape, reverse engineer, automate access to, or commercially exploit the Service without permission;</li>
        <li>harass, defame, or place improper pressure on another user; or</li>
        <li>engage in conduct that materially disrupts operation of the Service.</li>
      </ol>

      <h2>6. Paid content and payment</h2>
      <ol>
        <li>The English Complete Edition costs ${(EN_FULL_ACCESS_PRICE_USD_CENTS / 100).toFixed(2)} USD including tax and is a one-time purchase. It is not a subscription and does not renew automatically.</li>
        <li>It includes the complete personality report and PDF, friend insights, compatibility, Destiny Blueprint, 30 Alice chat answers, and all three tarot readings.</li>
        <li>The exact product, final price, payment method, delivery timing, and refund terms are shown before payment. Payment is processed by Stripe.</li>
        <li>You may request a full refund within 30 days of the payment date. See the <a href="/en/legal/commerce">Sales &amp; Refund Policy</a>.</li>
        <li>Once a full refund is completed, access granted by that purchase ends. Any separate valid purchase remains effective.</li>
      </ol>

      <h2>7. Intellectual property</h2>
      <ol>
        <li>Rights in the Service’s text, images, characters, design, software, and diagnostic logic belong to the Operator or their lawful owners.</li>
        <li>You may save and share your own result screens for personal use and sharing with friends.</li>
        <li>Your submitted answers remain yours. The Operator may use de-identified statistical data to improve and study the Service.</li>
      </ol>

      <h2>8. Personality, astrology, tarot, and AI disclaimer</h2>
      <ol>
        <li>Results and generated content are provided for entertainment and self-reflection. They are not medical, psychological, legal, financial, or other professional diagnosis or advice.</li>
        <li>Generative AI can produce inaccurate, incomplete, or unsuitable information. The Operator does not guarantee the accuracy or fitness of generated content.</li>
        <li>Make important decisions on your own responsibility and consult a qualified professional when appropriate.</li>
        <li>Do not enter passwords, payment-card numbers, another person’s private information, or other unnecessary sensitive information into chat.</li>
      </ol>

      <h2>9. Suspension and access restrictions</h2>
      <p>
        The Service may be temporarily suspended for maintenance, outages, force majeure, or urgent security reasons. The Operator may restrict access when a user violates these Terms or materially disrupts the Service, with notice where reasonably practicable.
      </p>

      <h2>10. Warranties and liability</h2>
      <p>
        The Service is provided without a guarantee that it will be uninterrupted, error-free, or suitable for a particular purpose. The Operator is not responsible for loss caused by force majeure, a user’s conduct, or third-party services outside reasonable control. Nothing in these Terms excludes or limits liability that cannot lawfully be excluded, including liability arising from intentional misconduct or gross negligence.
      </p>

      <h2>11. Privacy</h2>
      <p>The Operator handles personal information under the <a href="/en/privacy">Privacy Policy</a>.</p>

      <h2>12. Changes to these Terms</h2>
      <p>
        These Terms may be changed when required by law or reasonably necessary for the Service. The effective date and material changes will be announced in advance within the Service or by another appropriate method. Changes materially disadvantageous to users will receive reasonable advance notice.
      </p>

      <h2>13. Governing law and disputes</h2>
      <ol>
        <li>These Terms are governed by the laws of Japan.</li>
        <li>Mandatory consumer protections in the user’s country or region may apply regardless of this governing-law clause.</li>
        <li>The parties will first try in good faith to resolve any dispute. Jurisdiction is determined under applicable law.</li>
      </ol>

      <h2>14. Contact</h2>
      <ul>
        <li>Operator: Ryunosuke Futami (Alice Test Operations Team)</li>
        <li>Country of operation: Japan</li>
        <li>Email: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a></li>
      </ul>
    </EnLegalDocument>
  );
}
