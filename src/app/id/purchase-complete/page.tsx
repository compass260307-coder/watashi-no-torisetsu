import Link from "next/link";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";
import TopHeader from "@/components/top/TopHeader";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function UnverifiedPurchasePage() {
  return (
    <>
      <TopHeader locale="id" />
      <main className="flex min-h-[70vh] flex-col items-center justify-center bg-[#F1F1F7] px-5 py-14 text-center">
        <h1 className="text-[22px] font-black text-[#2E2E5C]">Informasi pembayaran tidak dapat diverifikasi</h1>
        <p className="mt-3 max-w-[420px] text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
          Buka tautan yang diberikan setelah pembayaran Stripe selesai. Jika pembayaran sudah berhasil, periksa juga email yang digunakan saat membeli.
        </p>
        <Link href="/id" className="mt-6 text-[12px] text-[#2E2E5C]/60 underline underline-offset-2">Kembali ke beranda</Link>
      </main>
    </>
  );
}

export default async function IndonesianPurchaseCompletePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await verifyPaidSelfAccessCheckoutSession(params.session_id);
  if (!session) return <UnverifiedPurchasePage />;
  return (
    <>
      <MetaPurchaseDataLayer
        checkoutSessionId={session.id}
        product={session.product}
        claimToken={createMetaPurchaseClaimToken(session.id)}
      />
      <PurchaseCompleteView
        locale="id"
        isGuestPurchase={session.guest}
        destinyFeaturesIncluded={session.destinyFeaturesIncluded}
        hoshiyomiChatIncluded={session.hoshiyomiChatIncluded}
        hoshiyomiChatCredits={session.hoshiyomiChatCredits}
        tarotFeaturesIncluded={session.tarotFeaturesIncluded}
        friendFeaturesIncluded={session.friendFeaturesIncluded}
        product={session.product === "self_report" ? "self_report" : session.product === "premium_bundle" ? "premium_bundle" : "full_access"}
      />
    </>
  );
}
