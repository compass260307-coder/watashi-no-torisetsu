import type { Metadata } from "next";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import {
  PurchaseCompleteView,
  PurchaseUnverifiedView,
} from "@/components/PurchaseCompleteView";
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

export default async function EnglishPurchaseCompletePage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const session = await verifyPaidSelfAccessCheckoutSession(params.session_id);
  if (!session) return <PurchaseUnverifiedView locale="en" />;
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
