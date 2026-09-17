import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Penilaian teman", robots: { index: false, follow: false } };

export default async function IndonesianEvaluationResultRoute({ params }: { params: Promise<{ perceptionId: string }> }) {
  const { perceptionId } = await params;
  const { data: perception } = await supabaseAdmin.from("friend_perceptions").select("target_user_id").eq("id", perceptionId).maybeSingle();
  if (!perception) notFound();
  const session = await getSession();
  if (!session || session.id !== perception.target_user_id) redirect(`/id/evaluate/sent/${encodeURIComponent(perceptionId)}`);
  const { data: owner } = await supabaseAdmin.from("users").select("owner_token").eq("id", perception.target_user_id).maybeSingle();
  const token = ((owner?.owner_token as string | null) ?? "").trim();
  if (!token) notFound();
  redirect(`/id/tako/${encodeURIComponent(token)}/friend/${encodeURIComponent(perceptionId)}`);
}
