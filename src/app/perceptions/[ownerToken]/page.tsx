import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { perceiveFromFriendAnswers } from "@/lib/friend-perception";
import PerceptionsView from "@/components/PerceptionsView";
import Footer from "@/components/Footer";
import type {
  AnswerValue,
  CModifier,
  FacetId,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

function getInviteHref(): string {
  const liffShareId = process.env.NEXT_PUBLIC_LIFF_ID_SHARE;
  return liffShareId ? `https://liff.line.me/${liffShareId}` : "/";
}

interface PageProps {
  params: Promise<{ ownerToken: string }>;
}

export default async function PerceptionsPage({ params }: PageProps) {
  const { ownerToken } = await params;

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, display_name, owner_token")
    .eq("owner_token", ownerToken)
    .maybeSingle();

  if (userError || !user) {
    notFound();
  }

  const { data: answers } = await supabaseAdmin
    .from("friend_answers")
    .select("id, answers, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  type PerceptionItem = {
    id: string;
    typeId: TorisetsuTypeId;
    answeredAt: string;
    fullCode: string;
    cModifier: CModifier;
    nModifier: NModifier;
    modifierLabel: string;
    facetScores: Record<FacetId, number>;
  };
  const perceptions: PerceptionItem[] = (answers ?? [])
    .map((row): PerceptionItem | null => {
      const answersObj = row.answers as Record<number, AnswerValue | string>;
      const perception = perceiveFromFriendAnswers(answersObj);
      if (!perception) return null;
      return {
        id: String(row.id),
        typeId: perception.typeId,
        answeredAt: row.created_at as string,
        fullCode: perception.fullCode,
        cModifier: perception.cModifier,
        nModifier: perception.nModifier,
        modifierLabel: perception.modifierLabel,
        facetScores: perception.facetScores,
      };
    })
    .filter((p): p is PerceptionItem => p !== null);

  const distMap = new Map<TorisetsuTypeId, number>();
  for (const p of perceptions) {
    distMap.set(p.typeId, (distMap.get(p.typeId) ?? 0) + 1);
  }
  const distribution = Array.from(distMap.entries()).sort(
    (a, b) => b[1] - a[1],
  );
  const mostCommonTypeId = distribution[0]?.[0] ?? null;

  const inviteHref = getInviteHref();

  return (
    <>
      <PerceptionsView
        ownerName={user.display_name as string | null}
        totalCount={perceptions.length}
        mostCommonTypeId={mostCommonTypeId}
        distribution={distribution}
        perceptions={perceptions}
        inviteHref={inviteHref}
      />
      <Footer />
    </>
  );
}
