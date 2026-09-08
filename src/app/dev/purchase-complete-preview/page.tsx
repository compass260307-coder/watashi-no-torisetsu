import { notFound } from "next/navigation";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";

// /purchase-complete の成功画面をStripe決済なしで確認するローカル専用プレビュー。
// 本物のページは cs_test_... の session_id 検証が必須で、ローカルで気軽に開けないため。
//
// ?product=self_report|full_access|premium_bundle / &locale=ko / &guest=1 で切替。
// destiny / chat / tarot / friend / credits の既定値は現行の商品内容に合わせ、
// 明示指定で旧世代購入者の見え方も確認できる。
export default async function PurchaseCompletePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    product?: string | string[];
    locale?: string | string[];
    guest?: string | string[];
    destiny?: string | string[];
    chat?: string | string[];
    credits?: string | string[];
    tarot?: string | string[];
    friend?: string | string[];
  }>;
}) {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  const params = searchParams ? await searchParams : {};
  const product =
    params.product === "self_report" || params.product === "premium_bundle"
      ? params.product
      : "full_access";
  const locale = params.locale === "ko" ? "ko" : "ja";
  const flag = (value: string | string[] | undefined, fallback: boolean) =>
    value === "1" ? true : value === "0" ? false : fallback;
  const defaultCredits = product === "self_report" ? 0 : 30;
  const requestedCredits = Number(params.credits);

  return (
    <PurchaseCompleteView
      product={product}
      locale={locale}
      isGuestPurchase={params.guest === "1"}
      destinyFeaturesIncluded={flag(
        params.destiny,
        product !== "self_report",
      )}
      hoshiyomiChatIncluded={flag(params.chat, product !== "self_report")}
      hoshiyomiChatCredits={
        Number.isInteger(requestedCredits) && requestedCredits >= 0
          ? requestedCredits
          : defaultCredits
      }
      tarotFeaturesIncluded={flag(params.tarot, product !== "self_report")}
      friendFeaturesIncluded={flag(params.friend, true)}
    />
  );
}
