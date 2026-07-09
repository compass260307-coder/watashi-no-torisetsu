// 友達の評価送信後の遷移ページ (獲得エンジン)。
//
// 役割変更 (2026-07-09): 相互理解の中身表示 (①相互理解度/②ギャップ/③強み/④関係) を撤去し、
// 案内ページ (FriendIndividualGuide) に差し替え。
// 理由: 本人の個別ページ (/tako/.../friend/...) を将来 ¥課金でロックする際、評価者ページで
// 同じ相互理解の中身が無料で見えると課金の抜け道になるため (memory: paywall-leak-checklist)。
// 評価者には「診断してくれてありがとう / あなたも診断してみない?」の案内を出し、新規診断へ送客する。
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

export const metadata: Metadata = {
  title: "評価を送ったよ",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
}

export default async function EvaluationSentPage({ params }: PageProps) {
  const { perceptionId } = await params;

  // perception → 評価対象 owner の invite_code を取り、診断CTAにバイラル source を載せる。
  // 招待元コードが無ければ素の /diagnosis にフォールバック。
  const { data: perception } = await supabaseAdmin
    .from("friend_perceptions")
    .select("target_user_id")
    .eq("id", perceptionId)
    .maybeSingle();
  if (!perception) {
    notFound();
  }
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("invite_code")
    .eq("id", perception.target_user_id)
    .maybeSingle();
  const inviteCode = ((user?.invite_code as string | null) ?? "").trim();
  const diagnoseHref = inviteCode
    ? `/diagnosis?source=${encodeURIComponent(inviteCode)}`
    : "/diagnosis";

  return (
    <FriendIndividualGuide
      diagnoseHref={diagnoseHref}
      diagnoseTrackSource="sent_bottom"
    />
  );
}
