// ゲスト決済 (未ログインで購入) の着地ページ。
//
// 導線: /aisho など匿名ページで購入 → Stripe → ここ。
//   全解放は購入時のメールアドレスに紐付く (webhook が email 優先で plan='full')。
//   同じメールでログイン (magic link) すれば、全解放されたトリセツ/相性/友達の結果が見られる。
//   LoginCard をそのまま置き、購入直後にログイン (= magic link 発行) できるようにする。

import Link from "next/link";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";
import TopHeader from "@/components/top/TopHeader";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";

export const dynamic = "force-dynamic";

const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const NAVY = "#2E2E5C";

type PageProps = {
  searchParams: Promise<{ session_id?: string | string[] }>;
};

function UnverifiedPurchasePage() {
  return (
    <>
    <TopHeader />
    <main
      className="flex flex-1 flex-col items-center justify-center px-5 py-14 text-center"
      style={{ fontFamily: FONT_STACK, backgroundColor: "#F1F1F7" }}
    >
      <h1 className="text-[22px] font-black" style={{ color: NAVY }}>
        決済情報を確認できませんでした
      </h1>
      <p className="mt-3 max-w-[420px] text-[13px] font-bold leading-[1.8] text-[#8A8AA3]">
        Stripeの決済完了画面から戻ったURLをそのまま開いてください。
        <br />
        決済済みの場合は、購入時のメールアドレスもご確認ください。
      </p>
      <Link
        href="/"
        className="mt-6 text-[12px] underline underline-offset-2"
        style={{ color: `${NAVY}80` }}
      >
        トップに戻る
      </Link>
    </main>
    </>
  );
}

export default async function PurchaseCompletePage({ searchParams }: PageProps) {
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
        friendFeaturesIncluded={session.friendFeaturesIncluded}
        hoshiyomiChatCredits={session.hoshiyomiChatCredits}
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
