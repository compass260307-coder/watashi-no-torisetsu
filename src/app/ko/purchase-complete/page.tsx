import type { Metadata } from "next";
import Link from "next/link";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";
import { localizedAlternates } from "@/lib/locale-seo";

export const dynamic = "force-dynamic";

const NAVY = "#2E2E5C";

export const metadata: Metadata = {
  title: { absolute: "결제가 완료되었습니다 | 나의 사용설명서" },
  alternates: localizedAlternates(
    "ko",
    "/purchase-complete",
    "/ko/purchase-complete",
  ),
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function UnverifiedPurchasePage() {
  return (
    <>
    <KoTopHeader />
    <main className="flex flex-1 flex-col items-center justify-center bg-[#F1F1F7] px-5 py-14 text-center">
      <h1 className="text-[22px] font-black" style={{ color: NAVY }}>
        결제 정보를 확인할 수 없었어요
      </h1>
      <p className="mt-3 max-w-[420px] text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
        Stripe 결제 완료 화면에서 돌아온 URL을 그대로 열어 주세요.
        <br />
        이미 결제했다면 구매에 사용한 이메일도 확인해 주세요.
      </p>
      <Link
        href="/ko"
        className="mt-6 text-[12px] underline underline-offset-2"
        style={{ color: `${NAVY}80` }}
      >
        홈으로 돌아가기
      </Link>
    </main>
    </>
  );
}

export default async function KoreanPurchaseCompletePage({
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
        friendFeaturesIncluded={session.friendFeaturesIncluded}
        product={
          session.product === "self_report"
            ? "self_report"
            : session.product === "premium_bundle"
              ? "premium_bundle"
              : "full_access"
        }
        locale="ko"
      />
    </>
  );
}
