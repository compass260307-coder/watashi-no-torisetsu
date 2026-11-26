import { notFound } from "next/navigation";
import { InlineErrorPreview } from "./InlineErrorPreview";

// 画面内の短いエラー文の確認専用ページ。本番デプロイではページ自体を公開しない。
// 上に文言の一覧 (実際の画面と同じ文字の見た目)、下に本物のログインカードと生年月日フォームを置き、
// このページの中だけ通信をわざと失敗させて、エラーの出方を確かめられる。
export default function InlineErrorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InlineErrorPreview />;
}
