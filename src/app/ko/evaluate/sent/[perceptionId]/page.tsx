import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FriendIndividualGuide } from "@/components/result/FriendIndividualGuide";
import { supabaseAdmin } from "@/lib/supabase-server";
import { localizedAlternates } from "@/lib/locale-seo";

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
    .select("target_user_id")
    .eq("id", perceptionId)
    .maybeSingle();

  if (!perception) notFound();

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("invite_code")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  const inviteCode = ((user?.invite_code as string | null) ?? "").trim();
  const diagnoseHref = inviteCode
    ? `/ko/diagnosis?source=${encodeURIComponent(inviteCode)}`
    : "/ko/diagnosis";

  return (
    <FriendIndividualGuide
      diagnoseHref={diagnoseHref}
      diagnoseTrackSource="sent_bottom"
      inviteCode={inviteCode || undefined}
      locale="ko"
    />
  );
}
