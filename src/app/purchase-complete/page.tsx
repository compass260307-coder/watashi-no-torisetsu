// ゲスト決済 (未ログインで購入) の着地ページ。
//
// 導線: /aisho など匿名ページで購入 → Stripe → ここ。
//   全解放は購入時のメールアドレスに紐付く (webhook が email 優先で plan='full')。
//   同じメールでログイン (magic link) すれば、全解放されたトリセツ/相性/友達の結果が見られる。
//   LoginCard をそのまま置き、購入直後にログイン (= magic link 発行) できるようにする。

import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import {
  PurchaseCompleteView,
  PurchaseUnverifiedView,
} from "@/components/PurchaseCompleteView";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

export default async function PurchaseCompletePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await verifyPaidSelfAccessCheckoutSession(params.session_id);
  if (!session) return <PurchaseUnverifiedView locale="ja" />;
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
      />
    </>
  );
}
