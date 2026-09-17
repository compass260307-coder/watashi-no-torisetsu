import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Answers sent",
  robots: { index: false, follow: false },
};

export default async function EnglishEvaluationSentRoute({
  params,
}: {
  params: Promise<{ perceptionId: string }>;
}) {
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
  const selfScores = (user?.scores ?? {}) as BigFiveScores;
  const friendScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const understanding = calcMutualUnderstanding(
    buildDimensionGaps(selfScores, friendScores),
  );
  const inviteCode = ((user?.invite_code as string | null) ?? "").trim();
  return (
    <FriendIndividualGuide
      targetName={((user?.display_name as string | null) ?? "").trim()}
      understandingScore={understanding}
      selfScores={selfScores}
      perceivedScores={friendScores}
      inviteCode={inviteCode || undefined}
      locale="en"
      diagnoseHref={
        inviteCode
          ? `/en/diagnosis?source=${encodeURIComponent(inviteCode)}`
          : "/en/diagnosis"
      }
    />
  );
}
