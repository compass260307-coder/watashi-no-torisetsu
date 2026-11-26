import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PurchaseLoadingScreen } from "@/components/result/PurchaseLoadingScreen";
import { preferFaceImage } from "@/lib/character-image";
import { heroColorsForGroup, resultActionColorsForGroup } from "@/lib/hero-colors";
import {
  isCheckoutSessionId,
  verifyPaidFullAccessCheckoutSession,
} from "@/lib/paid-checkout-session";
import { purchaseReadyDestination } from "@/lib/purchase-ready";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoImagePath,
} from "@/lib/thirty-two-types";

// 完全版 (日本語 Web) を /me 以外のページから買った人に、準備画面を見せてから元のページへ送る中継。
// 仕組みと戻り先の決め方は src/lib/purchase-ready.ts。
export const metadata: Metadata = {
  title: "完全版を準備しています",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PurchaseReadyPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    session_id?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const sessionId = sp.session_id;
  if (!isCheckoutSessionId(sessionId)) redirect("/");
  const destination = purchaseReadyDestination(sp.next, sessionId);
  if (!destination) redirect("/");

  // 支払い済みの日本語の完全版と確かめられたときだけ準備画面を出す。
  // 確かめられないときは、何も足さずに元の戻り先へ送る (今までどおりの流れ)。
  const session = await verifyPaidFullAccessCheckoutSession(sessionId);
  if (!session || session.locale !== "ja" || !session.userId) redirect(destination);

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("scores")
    .eq("id", session.userId)
    .maybeSingle();
  if (!user?.scores) redirect(destination);

  const typeId = classifyThirtyTwoType(user.scores);
  const group = thirtyTwoGroup(typeId);
  const action = resultActionColorsForGroup(group);

  return (
    <PurchaseLoadingScreen
      ownerToken=""
      waitingForAccess={false}
      redirectTo={destination}
      self={{
        face: preferFaceImage(thirtyTwoImagePath(typeId)),
        typeName: thirtyTwoEssence(typeId),
        heroColor: heroColorsForGroup(group).heroBg,
        buttonColor: action.accent,
        buttonShadow: action.shadow,
      }}
    />
  );
}
