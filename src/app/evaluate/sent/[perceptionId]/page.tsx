// 友達の評価送信後の遷移ページ (獲得エンジン)。
//
// 評価者には、本人の自己評価と今回の回答を比べた「理解度」と
// 「五つの性格傾向」だけを返す。②以降の詳細は本人側に限定し、
// 回答者自身の無料診断CTAを表示する。
//
// バイラル計測は維持 (8月に検証する K の材料):
//   - 診断CTAに ?source=<owner invite_code> を付与 → source_user_id / generation ツリーが埋まる
//   - CTAクリックを friend_to_diagnosis_clicked (source=sent_bottom) で計測 (評価者→診断の転換KPI)
//
// 触らない: 本人の個別ページ (/tako/.../friend/...)・/evaluate/result・PerceptionResultBody。

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";
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
    title: "評価を送ったよ",
    alternates: localizedAlternates(
      "ja",
      `/evaluate/sent/${idPath}`,
      `/ko/evaluate/sent/${idPath}`,
    ),
    robots: { index: false, follow: false },
  };
}

export default async function EvaluationSentPage({ params }: PageProps) {
  const { perceptionId } = await params;

  // perception → 評価対象 owner の invite_code を取り、診断CTAにバイラル source を載せる。
  // 招待元コードが無ければ素の /diagnosis にフォールバック。
  const { data: perception } = await supabaseAdmin
    .from("friend_perceptions")
    .select("target_user_id, perceived_scores")
    .eq("id", perceptionId)
    .maybeSingle();
  if (!perception) {
    notFound();
  }
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
    ? `/diagnosis?source=${encodeURIComponent(inviteCode)}`
    : "/diagnosis";

  return (
    <FriendIndividualGuide
      diagnoseHref={diagnoseHref}
      diagnoseTrackSource="sent_bottom"
      inviteCode={inviteCode || undefined}
      targetName={targetName || undefined}
      understandingScore={understandingScore}
      selfScores={selfScores}
      perceivedScores={perceivedScores}
    />
  );
}
