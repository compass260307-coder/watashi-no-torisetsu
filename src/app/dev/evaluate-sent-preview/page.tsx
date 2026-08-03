import { notFound } from "next/navigation";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";

// 友達診断完了後に友達側が着地する /evaluate/sent/[perceptionId] のローカル確認用。
// 本番は Supabase の実在 perception ID が必要なため、ダミー props で同じ画面を出す。
// trackSource は渡さない = friend_to_diagnosis_clicked を発火させない (共有Supabaseの計測を汚さない)。
// ?locale=ko で韓国語版 (/ko/evaluate/sent) の表示も確認できる。

interface PageProps {
  searchParams: Promise<{ locale?: string | string[] }>;
}

export default async function EvaluateSentPreviewPage({
  searchParams,
}: PageProps) {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const isKorean = params.locale === "ko";

  return (
    <FriendIndividualGuide
      diagnoseHref={isKorean ? "/ko/diagnosis" : "/diagnosis"}
      inviteCode="DEVPREVIEW"
      locale={isKorean ? "ko" : "ja"}
    />
  );
}
