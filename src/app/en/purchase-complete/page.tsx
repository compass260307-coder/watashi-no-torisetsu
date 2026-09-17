import type { Metadata } from "next";
import Link from "next/link";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";
import EnSiteFooter from "@/components/en/EnSiteFooter";
import EnSiteHeader from "@/components/en/EnSiteHeader";
import { localizedAlternates } from "@/lib/locale-seo";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Purchase complete | Alice Personalities" },
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
        <h1 className="text-[22px] font-black" style={{ color: "#2E2E5C" }}>
          We could not verify this purchase
        </h1>
        <p className="mt-3 max-w-[420px] text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
          Open the return link from the Stripe checkout confirmation.
          <br />
          If payment completed, also check the email address used at checkout.
        </p>
        <Link
          href="/en"
          className="mt-6 text-[12px] underline underline-offset-2"
          style={{ color: "#2E2E5C80" }}
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
    <>
      <MetaPurchaseDataLayer
        checkoutSessionId={session.id}
        product={session.product}
        claimToken={claimToken}
      />
      <PurchaseCompleteView
        isGuestPurchase={session.guest}
        destinyFeaturesIncluded={session.destinyFeaturesIncluded}
        hoshiyomiChatIncluded={session.hoshiyomiChatIncluded}
        hoshiyomiChatCredits={session.hoshiyomiChatCredits}
        tarotFeaturesIncluded={session.tarotFeaturesIncluded}
        friendFeaturesIncluded={session.friendFeaturesIncluded}
        product={
          session.product === "self_report"
            ? "self_report"
            : session.product === "premium_bundle"
              ? "premium_bundle"
              : "full_access"
        }
        locale="en"
      />
    </>
  );
}
