import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    startedRes,
    completedRes,
    answerStartedRes,
    answerCompletedRes,
    shareEventsRes,
    completedSessionsRes,
    viewedSessionsRes,
    revisitedSessionsRes,
    achievementRes,
    recentRes,
  ] = await Promise.all([
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "diagnosis_started"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "diagnosis_completed"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "friend_answer_started"),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("event_name", "friend_answer_completed"),
    supabase
      .from("events")
      .select("session_id")
      .in("event_name", ["friend_share_clicked", "friend_link_copied"]),
    supabase
      .from("events")
      .select("session_id")
      .eq("event_name", "diagnosis_completed"),
    supabase
      .from("events")
      .select("session_id")
      .eq("event_name", "result_viewed"),
    supabase
      .from("events")
      .select("session_id")
      .eq("event_name", "result_revisited"),
    supabase
      .from("events")
      .select("owner_token, metadata")
      .in("event_name", ["result_viewed", "result_revisited"])
      .not("owner_token", "is", null),
    supabase
      .from("events")
      .select("event_name, session_id, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const diagnosisStarted = startedRes.count ?? 0;
  const diagnosisCompleted = completedRes.count ?? 0;
  const friendAnswerStarted = answerStartedRes.count ?? 0;
  const friendAnswerCompleted = answerCompletedRes.count ?? 0;

  const uniqueShare = new Set(
    shareEventsRes.data?.map((e) => e.session_id).filter(Boolean),
  ).size;
  const uniqueCompleted = new Set(
    completedSessionsRes.data?.map((e) => e.session_id).filter(Boolean),
  ).size;
  const uniqueViewed = new Set(
    viewedSessionsRes.data?.map((e) => e.session_id).filter(Boolean),
  ).size;
  const uniqueRevisited = new Set(
    revisitedSessionsRes.data?.map((e) => e.session_id).filter(Boolean),
  ).size;

  const ownerMax = new Map<string, number>();
  for (const row of achievementRes.data ?? []) {
    const t = row.owner_token as string;
    const fc = (row.metadata as Record<string, unknown>)?.friendCount;
    if (t && typeof fc === "number") {
      ownerMax.set(t, Math.max(ownerMax.get(t) ?? 0, fc));
    }
  }
  let threeAchieved = 0;
  let fiveAchieved = 0;
  for (const fc of ownerMax.values()) {
    if (fc >= 3) threeAchieved++;
    if (fc >= 5) fiveAchieved++;
  }

  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  return NextResponse.json({
    diagnosisStarted,
    diagnosisCompleted,
    completionRate: rate(diagnosisCompleted, diagnosisStarted),
    shareCount: uniqueShare,
    shareRate: rate(uniqueShare, uniqueCompleted),
    friendAnswerStarted,
    friendAnswerCompleted,
    answerCompletionRate: rate(friendAnswerCompleted, friendAnswerStarted),
    threeAchieved,
    fiveAchieved,
    resultRevisited: uniqueRevisited,
    revisitRate: rate(uniqueRevisited, uniqueViewed),
    funnel: [
      { label: "診断開始", count: diagnosisStarted },
      { label: "診断完了", count: diagnosisCompleted },
      { label: "友達共有", count: uniqueShare },
      { label: "友達回答開始", count: friendAnswerStarted },
      { label: "友達回答完了", count: friendAnswerCompleted },
      { label: "3人達成", count: threeAchieved },
      { label: "5人達成", count: fiveAchieved },
    ],
    recentEvents: recentRes.data ?? [],
  });
}
