import type { Metadata } from "next";
import EnLegalDocument from "@/components/en/EnLegalDocument";
import { localizedAlternates } from "@/lib/locale-seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How the English version of Alice Test handles personal information.",
  alternates: localizedAlternates("en", "/privacy", "/ko/privacy", "/en/privacy"),
  robots: { index: true, follow: true },
};

export default function EnglishPrivacyPage() {
  return (
    <EnLegalDocument title="Privacy Policy" lastUpdated="September 10, 2026">
      <p>
        Ryunosuke Futami / the Alice Test Operations Team (“Operator”) handles personal information used in the English version of Alice Test (“Service”) as described below.
      </p>

      <h2>1. Data controller and contact</h2>
      <ul>
        <li>Controller: Ryunosuke Futami (Alice Test Operations Team)</li>
        <li>Country of operation: Japan</li>
        <li>Privacy contact: <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a></li>
      </ul>

      <h2>2. Information we process</h2>
      <h3>Information you provide</h3>
      <ul>
        <li>answers to your personality test and friend evaluations;</li>
        <li>nickname or display name;</li>
        <li>email address used for sign-in links, purchase confirmation, and result restoration;</li>
        <li>date, time, and region of birth entered for Destiny Blueprint;</li>
        <li>messages sent to Alice and saved conversation history; and</li>
        <li>information you include in support requests.</li>
      </ul>
      <h3>Purchase information</h3>
      <ul><li>purchase history, amount, currency, status, product, and Stripe transaction identifiers.</li></ul>
      <p>Stripe processes payment-card numbers and authentication information directly. The Operator does not store complete card numbers.</p>
      <h3>Information generated automatically</h3>
      <ul>
        <li>IP address, access time, pages visited, and referring page;</li>
        <li>browser, operating system, device, and screen information;</li>
        <li>cookies, local storage, and usage or error events;</li>
        <li>campaign and referral identifiers; and</li>
        <li>invite codes and relationships between diagnostic results.</li>
      </ul>

      <h2>3. Purposes</h2>
      <ol>
        <li>calculate, store, and display personality and friend-perspective results;</li>
        <li>calculate chart information and generate Destiny Blueprint content;</li>
        <li>provide Alice conversations and tarot experiences;</li>
        <li>send sign-in links and restore results and purchases;</li>
        <li>process payments, deliver paid content, prevent duplicate charges, and handle refunds;</li>
        <li>respond to support requests and send important service notices;</li>
        <li>protect security, prevent abuse, diagnose errors, and improve quality; and</li>
        <li>measure service use and prepare de-identified statistics.</li>
      </ol>

      <h2>4. Legal grounds</h2>
      <p>Depending on applicable law, processing is based on performance of a contract, steps requested before a contract, legitimate interests in operating and protecting the Service, compliance with legal obligations, or consent where required. You may withdraw consent without affecting earlier lawful processing.</p>

      <h2>5. Retention and deletion</h2>
      <ol>
        <li>Test results, friend evaluations, birth information, conversation records, and account-to-result links are generally retained until account deletion, a valid deletion request, or the end of the purpose for which they were collected.</li>
        <li>Purchase and dispute records may be retained for periods required by tax, accounting, consumer-protection, anti-fraud, and other applicable laws.</li>
        <li>Cookies and local-storage data remain until their expiry or deletion in your browser.</li>
        <li>When retention is no longer required, information is deleted or de-identified using reasonable measures. Records that must be preserved by law are kept separately or access-restricted.</li>
      </ol>

      <h2>6. Service providers</h2>
      <p>We use the following processors only as needed to provide, secure, measure, and support the Service:</p>
      <table>
        <thead><tr><th>Provider</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td>Vercel Inc.</td><td>website hosting, content delivery, and AI request routing</td></tr>
          <tr><td>Supabase Pte. Ltd.</td><td>database and authentication data</td></tr>
          <tr><td>Stripe, Inc.</td><td>payments, fraud prevention, and refunds</td></tr>
          <tr><td>Resend, Inc.</td><td>sign-in and transactional email</td></tr>
          <tr><td>Anthropic PBC</td><td>generation of Destiny Blueprint and Alice responses from relevant inputs</td></tr>
          <tr><td>Google LLC</td><td>tag management and usage analytics</td></tr>
          <tr><td>Cloudflare, Inc.</td><td>domain, security, and content delivery services</td></tr>
          <tr><td>Meta Platforms, Inc. / TikTok Pte. Ltd.</td><td>campaign conversion measurement when the relevant advertising tags are enabled</td></tr>
        </tbody>
      </table>

      <h2>7. International transfers</h2>
      <p>
        Because the Service is operated from Japan and uses providers in Japan, the United States, Singapore, and other locations, information may be processed outside your country. We use encrypted network connections and rely on contractual, consent-based, adequacy, or other safeguards required by applicable law.
      </p>

      <h2>8. Sharing</h2>
      <p>We do not sell personal information. We disclose it only to the service providers above, when required by law, to protect life, safety, property, or legal rights, or as part of a lawful business transfer with appropriate safeguards.</p>

      <h2>9. Cookies, analytics, and advertising measurement</h2>
      <p>
        Cookies and local storage keep sessions, results, preferences, referral details, and security state. Analytics and advertising-measurement tools may process device, page, campaign, and event data. Where required, non-essential tags are activated only after consent. You can manage cookies in your browser, though disabling essential storage may prevent sign-in or restoration features from working.
      </p>

      <h2>10. Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, restrict, object to, or receive a portable copy of personal information, withdraw consent, and complain to a data-protection authority. Email us from an address connected to your data and describe the request. We may verify identity before responding.
      </p>

      <h2>11. Security</h2>
      <p>We use access controls, encryption in transit, secret result tokens, limited-purpose processor access, and operational monitoring. No online service can guarantee absolute security, so keep result links private and contact us if you suspect misuse.</p>

      <h2>12. Children</h2>
      <p>The Service is not directed to children under 13. A child under 13 may use it only under parental or guardian supervision. If you believe a child submitted personal information without appropriate involvement, contact us for review and deletion.</p>

      <h2>13. Changes</h2>
      <p>We may update this Policy to reflect changes in law, providers, or the Service. The latest version and update date will be posted here. Material changes will be announced by an appropriate additional method where required.</p>

      <h2>14. Contact</h2>
      <p>Email privacy questions or requests to <a href="mailto:support@watashi-torisetsu.com">support@watashi-torisetsu.com</a>.</p>
    </EnLegalDocument>
  );
}
