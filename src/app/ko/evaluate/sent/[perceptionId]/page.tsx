import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localizedAlternates } from "@/lib/locale-seo";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";

interface PageProps {
  params: Promise<{ perceptionId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { perceptionId } = await params;
  const idPath = encodeURIComponent(perceptionId);
  return {
    title: "답변을 보냈어요",
    alternates: localizedAlternates(
      "ko",
      `/evaluate/sent/${idPath}`,
      `/ko/evaluate/sent/${idPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function KoreanEvaluationSentPage({ params }: PageProps) {
  const { perceptionId } = await params;
  const { data: perception } = await supabaseAdmin
    .from("friend_perceptions")
    .select("target_user_id, perceived_scores")
    .eq("id", perceptionId)
    .maybeSingle();

  if (!perception) notFound();

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("invite_code, display_name, scores")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  const inviteCode = ((user?.invite_code as string | null) ?? "").trim();
  const targetName = ((user?.display_name as string | null) ?? "").trim();
  const selfScores = (user?.scores ?? {}) as BigFiveScores;
  const perceivedScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const understandingScore = calcMutualUnderstanding(
    buildDimensionGaps(selfScores, perceivedScores),
  );
  const diagnoseHref = inviteCode
    ? `/ko/diagnosis?source=${encodeURIComponent(inviteCode)}`
    : "/ko/diagnosis";

  return (
    <FriendIndividualGuide
      diagnoseHref={diagnoseHref}
      diagnoseTrackSource="sent_bottom"
      inviteCode={inviteCode || undefined}
      targetName={targetName || undefined}
      understandingScore={understandingScore}
      selfScores={selfScores}
      perceivedScores={perceivedScores}
      locale="ko"
    />
  );
}
