import { notFound } from "next/navigation";
import { PurchaseCompleteView } from "@/components/PurchaseCompleteView";

// /purchase-complete の成功画面をStripe決済なしで確認するローカル専用プレビュー。
// 本物のページは cs_test_... の session_id 検証が必須で、ローカルで気軽に開けないため。
//
// ?product=self_report|full_access|premium_bundle / &locale=ko / &guest=1 で切替。
// destiny / chat / friend の既定値は現行の販売内容 (完全版=チャットあり・設計図なし) に
// 合わせ、&destiny=1 &chat=0 のように明示指定で上書きできる (旧世代購入者の見え方確認用)。
export default async function PurchaseCompletePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    product?: string | string[];
    locale?: string | string[];
    guest?: string | string[];
    destiny?: string | string[];
    chat?: string | string[];
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
  const flag = (value: string | string[] | undefined, fallback: boolean) =>
    value === "1" ? true : value === "0" ? false : fallback;

  return (
    <PurchaseCompleteView
      product={product}
      locale={params.locale === "ko" ? "ko" : "ja"}
      isGuestPurchase={params.guest === "1"}
      destinyFeaturesIncluded={flag(
        params.destiny,
        product === "premium_bundle",
      )}
      hoshiyomiChatIncluded={flag(params.chat, product !== "self_report")}
      friendFeaturesIncluded={flag(params.friend, product !== "self_report")}
    />
  );
}
