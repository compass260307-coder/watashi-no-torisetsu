import Link from "next/link";
import { notFound } from "next/navigation";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";

// 友達診断完了後に友達側が着地する /evaluate/sent/[perceptionId] のローカル確認用。
// 本番は Supabase の実在 perception ID が必要なため、ダミー props で同じ画面を出す。
// trackSource は渡さない = friend_to_diagnosis_clicked を発火させない (共有Supabaseの計測を汚さない)。
// ?locale=ko で韓国語版 (/ko/evaluate/sent) の表示も確認できる。

interface PageProps {
  searchParams: Promise<{
    locale?: string | string[];
    score?: string | string[];
  }>;
}

const PREVIEW_SCORES = [32, 54, 82, 99, 100] as const;
const PREVIEW_SELF_SCORES = { O: 5.7, C: 5.7, E: 5.7, A: 5.7, N: 5.7 };
const PREVIEW_PERCEIVED_SCORES = { O: 3.6, C: 7.5, E: 4.2, A: 7.2, N: 4.7 };

export default async function EvaluateSentPreviewPage({
  searchParams,
}: PageProps) {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const isKorean = params.locale === "ko";
  const requestedScore = Array.isArray(params.score)
    ? params.score[0]
    : params.score;
  const previewScore =
    PREVIEW_SCORES.find((score) => String(score) === requestedScore) ?? 82;

  return (
    <>
      <nav
        aria-label="理解度結果プレビュー"
        className="sticky top-0 z-[200] flex min-h-12 items-center justify-center gap-1.5 border-b border-[#E5E3ED] bg-white/95 px-3 py-2 shadow-sm backdrop-blur md:gap-2"
      >
        <span className="mr-1 hidden text-[12px] font-black text-[#6F6E83] sm:inline">
          結果プレビュー
        </span>
        {PREVIEW_SCORES.map((score) => {
          const href = `?score=${score}${isKorean ? "&locale=ko" : ""}`;
          const isActive = previewScore === score;

          return (
            <Link
              key={score}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[12px] font-black transition-colors md:px-4 md:text-[13px] ${
                isActive
                  ? "bg-[#2E2E5C] text-white"
                  : "bg-[#F3F1F6] text-[#5F5D72] hover:bg-[#E8E5EF]"
              }`}
            >
              {score}%
            </Link>
          );
        })}
      </nav>

      <FriendIndividualGuide
        diagnoseHref={isKorean ? "/ko/diagnosis" : "/diagnosis"}
        inviteCode="DEVPREVIEW"
        targetName={isKorean ? "지우" : "みさき"}
        understandingScore={previewScore}
        selfScores={PREVIEW_SELF_SCORES}
        perceivedScores={PREVIEW_PERCEIVED_SCORES}
        locale={isKorean ? "ko" : "ja"}
      />
    </>
  );
}
