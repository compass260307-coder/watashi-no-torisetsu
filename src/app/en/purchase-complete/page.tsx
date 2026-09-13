import type { Metadata } from "next";
import Link from "next/link";
import { LoginCard } from "@/components/LoginCard";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { localizedAlternates } from "@/lib/locale-seo";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Purchase complete | Alice Test" },
  alternates: localizedAlternates(
    "en",
    "/purchase-complete",
    "/ko/purchase-complete",
    "/en/purchase-complete",
  ),
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F1F1F7] text-[#2E2E5C]">
      <EnSiteHeader />
      {children}
      <EnSiteFooter />
    </div>
  );
}

function UnverifiedPurchasePage() {
  return (
    <PageShell>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-14 text-center">
        <h1 className="text-[24px] font-black">
          We could not verify this purchase
        </h1>
        <p className="mt-3 max-w-[440px] text-sm font-semibold leading-[1.8] text-[#727287]">
          Open the return link from the Stripe checkout confirmation. If your
          payment completed, also check the email address used at checkout.
        </p>
        <Link
          href="/en"
          className="mt-7 text-sm font-bold underline underline-offset-2"
        >
          Back to home
        </Link>
      </main>
    </PageShell>
  );
}

export default async function EnglishPurchaseCompletePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const session = await verifyPaidSelfAccessCheckoutSession(params.session_id);
  if (!session) return <UnverifiedPurchasePage />;
  const claimToken = createMetaPurchaseClaimToken(session.id);

  return (
    <PageShell>
      <MetaPurchaseDataLayer
        checkoutSessionId={session.id}
        product={session.product}
        claimToken={claimToken}
      />
      <main className="flex flex-1 flex-col items-center px-5 py-14">
        <div className="mb-7 w-full max-w-[440px] text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#3FA96A] text-white"
            aria-hidden="true"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-[26px] font-black">
            Thank you for your purchase!
          </h1>
          <p className="mt-3 text-sm font-semibold leading-[1.8] text-[#727287]">
            Use the email address from checkout to sign in and restore your
            purchase on this device.
          </p>
          <p className="mt-2 text-xs font-semibold leading-[1.7] text-[#8A8AA3]">
            If you have not completed the personality test yet, we will take you
            there after sign-in.
          </p>
        </div>
        <LoginCard locale="en" />
        <p className="mt-6 max-w-[440px] text-center text-xs font-semibold leading-[1.7] text-[#8A8AA3]">
          Need help with your purchase? Email{" "}
          <a
            href="mailto:support@watashi-torisetsu.com"
            className="font-bold text-[#2E2E5C] underline underline-offset-2"
          >
            support@watashi-torisetsu.com
          </a>
          . A full refund may be requested within 30 days. See the{" "}
          <Link
            href="/en/legal/commerce"
            className="font-bold text-[#2E2E5C] underline underline-offset-2"
          >
            Sales &amp; Refund Policy
          </Link>
          .
        </p>
        <Link
          href="/en"
          className="mt-6 text-xs font-bold underline underline-offset-2"
        >
          Back to home
        </Link>
      </main>
    </PageShell>
  );
}
