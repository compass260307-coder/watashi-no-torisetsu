import { notFound } from "next/navigation";
import { AnalyzingRevealPreview } from "./preview";

// 自己診断の解析待ち画面 → 結果ページ の「つながり方」を確認する専用ページ (日本語)。
// 本番デプロイではページ自体を公開しない。保存も計測もしない。
//   解析待ち画面を本番と同じ層 (AnalyzingVeilHost) に出し、待ち時間のあと、見本データの
//   結果ページ (/me/x?previewType=...) へ移動する。待機画面が2秒かけて消える様子を見られる。
//   ?wait=20 で本番と同じ20秒、指定なしは確認しやすい8秒。
export default async function AnalyzingRevealPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ wait?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const wait = Number(typeof params.wait === "string" ? params.wait : "");
  const waitSeconds = Number.isFinite(wait) && wait >= 2 && wait <= 60 ? wait : 8;

  return <AnalyzingRevealPreview waitMs={waitSeconds * 1000} />;
}
