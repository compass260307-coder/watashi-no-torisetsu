import { notFound } from "next/navigation";
import { ErrorPreview } from "./ErrorPreview";

// エラー画面の UI 確認専用ページ。本番デプロイではページ自体を公開しない。
//   指定なし: 通常のエラー画面 (app/error.tsx の中身)
//   ?chunk=1: 読み込み直しを案内する版 (デプロイで古い部品が消えたとき)
//   ?global=1: 最上位のエラー画面 (app/global-error.tsx の中身。サイトの CSS なしで描く)
// 404 は、存在しない URL (例: /this-page-does-not-exist) を開くと確認できる。
export default async function ErrorPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ chunk?: string | string[]; global?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <ErrorPreview chunk={params.chunk === "1"} global={params.global === "1"} />;
}
