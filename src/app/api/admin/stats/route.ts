import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey || key !== adminKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyRange<T>(query: T): T {
    let q = query as any;
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    return q as T;
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
    friendToDiagRes,
    diagQuestionRes,
    friendQuestionRes,
    usersRes,
    friendAnswersRes,
  ] = await Promise.all([
    applyRange(
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "diagnosis_started"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "diagnosis_completed"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "friend_answer_started"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "friend_answer_completed"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("session_id")
        .in("event_name", ["friend_share_clicked", "friend_link_copied"]),
    ),
    applyRange(
      supabase
        .from("events")
        .select("session_id")
        .eq("event_name", "diagnosis_completed"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("session_id")
        .eq("event_name", "result_viewed"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("session_id")
        .eq("event_name", "result_revisited"),
    ),
    applyRange(
      supabase
        .from("events")
        .select("owner_token, metadata")
        .in("event_name", ["result_viewed", "result_revisited"])
        .not("owner_token", "is", null),
    ),
    applyRange(
      supabase
        .from("events")
        .select("event_name, session_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(50),
    ),
    // friend_to_diagnosis_clicked count
    applyRange(
      supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("event_name", "friend_to_diagnosis_clicked"),
    ),
    // diagnosis per-question answered events
    applyRange(
      supabase
        .from("events")
        .select("metadata")
        .eq("event_name", "diagnosis_question_answered"),
    ),
    // friend per-question answered events
    applyRange(
      supabase
        .from("events")
        .select("metadata")
        .eq("event_name", "friend_question_answered"),
    ),
    // users with type_id (no date filter — shows all-time distribution)
    supabase.from("users").select("id, type_id, created_at"),
    // friend_answers with user_id (no date filter)
    supabase.from("friend_answers").select("user_id"),
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

  // --- Friend-to-diagnosis conversion ---
  const friendToDiagClicked = friendToDiagRes.count ?? 0;

  // --- Type distribution ---
  const typeCounts: Record<string, number> = {};
  for (const row of usersRes.data ?? []) {
    const t = row.type_id as string;
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }
  const typeDistribution = Object.entries(typeCounts)
    .map(([typeId, count]) => ({ typeId, count }))
    .sort((a, b) => b.count - a.count);

  // --- Friend answer count distribution ---
  const userFriendCounts = new Map<string, number>();
  for (const row of friendAnswersRes.data ?? []) {
    const uid = row.user_id as string;
    userFriendCounts.set(uid, (userFriendCounts.get(uid) ?? 0) + 1);
  }
  const totalUsers = usersRes.data?.length ?? 0;
  const usersWithFriends = new Set(userFriendCounts.keys()).size;
  let with1 = 0, with2 = 0, with3plus = 0, with5plus = 0;
  for (const fc of userFriendCounts.values()) {
    if (fc >= 1) with1++;
    if (fc >= 2) with2++;
    if (fc >= 3) with3plus++;
    if (fc >= 5) with5plus++;
  }
  const friendCountDistribution = {
    total: totalUsers,
    zero: totalUsers - usersWithFriends,
    one: with1 - with2,
    two: with2 - with3plus,
    threePlus: with3plus,
    fivePlus: with5plus,
  };

  // --- Per-question reach ---
  const diagQuestionReach: Record<number, number> = {};
  for (const row of diagQuestionRes.data ?? []) {
    const qi = (row.metadata as Record<string, unknown>)?.questionIndex;
    if (typeof qi === "number") {
      diagQuestionReach[qi] = (diagQuestionReach[qi] ?? 0) + 1;
    }
  }
  const friendQuestionReach: Record<number, number> = {};
  for (const row of friendQuestionRes.data ?? []) {
    const qi = (row.metadata as Record<string, unknown>)?.questionIndex;
    if (typeof qi === "number") {
      friendQuestionReach[qi] = (friendQuestionReach[qi] ?? 0) + 1;
    }
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
    friendToDiagClicked,
    friendToDiagRate: rate(friendToDiagClicked, friendAnswerCompleted),
    typeDistribution,
    friendCountDistribution,
    diagQuestionReach,
    friendQuestionReach,
  });
}
