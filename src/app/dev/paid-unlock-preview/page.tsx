import { notFound } from "next/navigation";
import { PaidUnlockPreview } from "./PaidUnlockPreview";

// 購入後の反映待ちの画面 (PaidUnlockRecovery) の UI 確認専用ページ。本番デプロイではページ自体を公開しない。
//   ?state=timeout で時間切れの画面から始める (指定なしは「確認しています」)。
//   ?product=self_report / premium_bundle で商品名を切り替える。
// 「もう一度確認する」を押すと「確認しています」に戻り、4秒後にまた時間切れになる。
export default async function PaidUnlockPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[]; product?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const product =
    params.product === "self_report" || params.product === "premium_bundle"
      ? params.product
      : "full_access";
  return (
    <PaidUnlockPreview
      initialState={params.state === "timeout" ? "timedOut" : "waiting"}
      product={product}
    />
  );
}
