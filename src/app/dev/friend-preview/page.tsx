import { notFound } from "next/navigation";
import { FriendDiagnosisPreview } from "@/components/friend/FriendDiagnosisPage";

// /friend/[inviteCode] の質問画面を、実在コード・DB書き込み・イベント計測なしで
// ローカル確認するためのプレビュー。?locale=ko で韓国語版へ切り替えられる。
export default async function FriendPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string | string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const locale = params.locale === "ko" ? "ko" : "ja";

  return <FriendDiagnosisPreview locale={locale} />;
}
