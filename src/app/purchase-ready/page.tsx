import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  isCheckoutSessionId,
  verifyPaidFullAccessCheckoutSession,
} from "@/lib/paid-checkout-session";
import { purchaseReadyDestination } from "@/lib/purchase-ready";
import { supabaseAdmin } from "@/lib/supabase-server";

// 完全版 (日本語 Web) を /me 以外のページから買った人の中継 (2026-11-26 の数時間だけ使った戻り先)。
// いまは、どのページから買っても Stripe から自己診断結果ページ (/me) に直接戻る (create-full-access-session)。
// このページは、切り替え前に作られた決済ページから戻ってくる人のために残す:
//   支払い済みの日本語の完全版と確かめられたら /me へ送り、準備画面と解放の発表を /me で見せる。
//   確かめられないときは、何も足さずに元の戻り先へ送る。
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

  const session = await verifyPaidFullAccessCheckoutSession(sessionId);
  if (!session || session.locale !== "ja" || !session.userId) redirect(destination);

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("owner_token")
    .eq("id", session.userId)
    .maybeSingle();
  const ownerToken = typeof user?.owner_token === "string" ? user.owner_token.trim() : "";
  if (!ownerToken) redirect(destination);

  redirect(`/me/${encodeURIComponent(ownerToken)}?paid=1&session_id=${encodeURIComponent(sessionId)}`);
}
