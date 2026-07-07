// 計測集計の単一実装。/api/admin/stats (管理画面) と /api/metrics (スプレッドシート連携) の
// 両方がこの関数を使う。集計ロジックを二重管理しないための共有点。
//
// from/to は ISO 文字列 (events.created_at / users.created_at / friend_answers.created_at)。
// null なら全期間。

import { supabaseAdmin } from "@/lib/supabase-server";

export async function computeStats(from: string | null, to: string | null) {
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
    viewedSessionsRes,
    revisitedSessionsRes,
    achievementRes,
    recentRes,
    friendToDiagRes,
    diagQuestionRes,
    friendLandingRes,
    usersRes,
    friendAnswersRes,
  ] = await Promise.all([
    applyRange(
      supabaseAdmin
        .from("events")
        .select("session_id")
        .eq("event_name", "diagnosis_started"),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("session_id")
        .eq("event_name", "diagnosis_completed"),
    ),
    applyRange(
      // 正規名 friend_answer_started + 旧名 friend_v2_started (既存データ併合)
      supabaseAdmin
        .from("events")
        .select("session_id")
        .in("event_name", ["friend_answer_started", "friend_v2_started"]),
    ),
    applyRange(
      // 正規名 friend_answer_completed + 旧名 friend_v2_completed
      supabaseAdmin
        .from("events")
        .select("session_id")
        .in("event_name", ["friend_answer_completed", "friend_v2_completed"]),
    ),
    applyRange(
      // 友達招待クリック = friend_invite_clicked (正規)。旧名 friend_share_clicked /
      // friend_link_copied は実発火実績なしだが将来の互換のため併合。
      // ※旧 share_clicked(kind:friend_invite) は name で分離できないため未計上 (少量)。
      supabaseAdmin
        .from("events")
        .select("session_id")
        .in("event_name", [
          "friend_invite_clicked",
          "friend_share_clicked",
          "friend_link_copied",
        ]),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("session_id")
        .eq("event_name", "result_viewed"),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("session_id")
        .eq("event_name", "result_revisited"),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("owner_token, metadata")
        .in("event_name", ["result_viewed", "result_revisited"])
        .not("owner_token", "is", null),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("event_name, session_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(50),
    ),
    applyRange(
      // 正規名 friend_to_diagnosis_clicked + 旧名 friend_v2_self_cta_clicked
      supabaseAdmin
        .from("events")
        .select("session_id")
        .in("event_name", [
          "friend_to_diagnosis_clicked",
          "friend_v2_self_cta_clicked",
        ]),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("metadata")
        .eq("event_name", "diagnosis_question_answered"),
    ),
    // friend_landing_viewed — for viral reach
    applyRange(
      supabaseAdmin
        .from("events")
        .select("session_id, invite_code")
        .eq("event_name", "friend_landing_viewed"),
    ),
    // users — period filter applied
    applyRange(
      supabaseAdmin
        .from("users")
        .select(
          "id, type_id, campaign, generation, invite_code, source_user_id, created_at",
        ),
    ),
    // friend_answers — period filter applied
    applyRange(
      supabaseAdmin.from("friend_answers").select("user_id, created_at"),
    ),
  ]);

  const toUnique = (res: { data: { session_id: string }[] | null }) =>
    new Set(res.data?.map((e) => e.session_id).filter(Boolean)).size;

  const diagnosisStarted = toUnique(startedRes);
  const diagnosisCompleted = toUnique(completedRes);
  const friendAnswerStarted = toUnique(answerStartedRes);
  const friendAnswerCompleted = toUnique(answerCompletedRes);
  const uniqueShare = toUnique(shareEventsRes);
  const uniqueViewed = toUnique(viewedSessionsRes);
  const friendToDiagClicked = toUnique(friendToDiagRes);

  // result_revisited: only count sessions that also have result_viewed
  const viewedSessions = new Set(
    viewedSessionsRes.data?.map((e) => e.session_id).filter(Boolean),
  );
  const uniqueRevisited = new Set(
    revisitedSessionsRes.data
      ?.map((e) => e.session_id)
      .filter((s): s is string => !!s && viewedSessions.has(s)),
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
  let with1 = 0,
    with2 = 0,
    with3plus = 0,
    with5plus = 0;
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

  // --- Campaign stats ---
  const campaignMap = new Map<
    string,
    { users: number; friendAnswers: number }
  >();
  const userIdToCampaign = new Map<string, string>();
  for (const row of usersRes.data ?? []) {
    const c = row.campaign as string | null;
    if (c) {
      if (!campaignMap.has(c))
        campaignMap.set(c, { users: 0, friendAnswers: 0 });
      campaignMap.get(c)!.users++;
      userIdToCampaign.set(row.id as string, c);
    }
  }
  for (const row of friendAnswersRes.data ?? []) {
    const uid = row.user_id as string;
    const c = userIdToCampaign.get(uid);
    if (c && campaignMap.has(c)) {
      campaignMap.get(c)!.friendAnswers++;
    }
  }
  const campaignStats = Array.from(campaignMap.entries())
    .map(([campaign, s]) => ({
      campaign,
      completed: s.users,
      friendCompleted: s.friendAnswers,
    }))
    .sort((a, b) => b.completed - a.completed);

  // --- Generation distribution ---
  const genCounts: Record<number, number> = {};
  let unknownGen = 0;
  for (const row of usersRes.data ?? []) {
    const g = row.generation as number | null;
    if (g !== null && g !== undefined) {
      genCounts[g] = (genCounts[g] ?? 0) + 1;
    } else {
      unknownGen++;
    }
  }
  const generationDistribution = Object.entries(genCounts)
    .map(([gen, count]) => ({ generation: Number(gen), count }))
    .sort((a, b) => a.generation - b.generation);

  // --- Per-question reach ---
  // diagnosis_question_answered は metadata.questionId (1 始まりの連番) で発火する。
  // 到達チャート (admin) は 0 始まり index を参照するため questionId-1 に換算する。
  // (旧実装は questionIndex を読んでいたが、そのキーは発火されず常に空だった。過去データも遡って救済)
  const diagQuestionReach: Record<number, number> = {};
  for (const row of diagQuestionRes.data ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const qid = meta.questionId;
    const idx =
      typeof qid === "number"
        ? qid - 1
        : typeof meta.questionIndex === "number"
          ? (meta.questionIndex as number)
          : null;
    if (idx !== null && idx >= 0) {
      diagQuestionReach[idx] = (diagQuestionReach[idx] ?? 0) + 1;
    }
  }

  // --- Viral metrics ---
  const friendLandingSessions = new Set(
    friendLandingRes.data
      ?.map((e: { session_id: string }) => e.session_id)
      .filter(Boolean),
  );
  const friendLandingViewed = friendLandingSessions.size;

  const landingInviteCodes = new Set(
    friendLandingRes.data
      ?.map((e: { invite_code: string }) => e.invite_code)
      .filter(Boolean),
  );
  const sharingUsersReached = landingInviteCodes.size;
  const avgLandingPerSharer =
    sharingUsersReached > 0 ? friendLandingViewed / sharingUsersReached : 0;

  const childUsers = (usersRes.data ?? []).filter(
    (r: { source_user_id: string | null }) => r.source_user_id != null,
  );
  const childDiagCompleted = childUsers.length;
  const parentIds = new Set(
    childUsers.map((r: { source_user_id: string }) => r.source_user_id),
  );
  const parentDiagCompleted = parentIds.size;
  const avgChildPerParent =
    parentDiagCompleted > 0 ? childDiagCompleted / parentDiagCompleted : 0;
  const viralCoefficient =
    diagnosisCompleted > 0 ? childDiagCompleted / diagnosisCompleted : 0;

  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    diagnosisStarted,
    diagnosisCompleted,
    completionRate: rate(diagnosisCompleted, diagnosisStarted),
    shareCount: uniqueShare,
    shareRate: rate(uniqueShare, diagnosisCompleted),
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
      { label: "友達ページ到達", count: friendLandingViewed },
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
    campaignStats,
    generationDistribution,
    unknownGeneration: unknownGen,
    totalUsers,
    viral: {
      friendLandingViewed,
      sharingUsersReached,
      avgLandingPerSharer,
      landingToStartRate: rate(friendAnswerStarted, friendLandingViewed),
      startToCompleteRate: rate(friendAnswerCompleted, friendAnswerStarted),
      friendToDiagClickedRate: rate(friendToDiagClicked, friendAnswerCompleted),
      childDiagCompleted,
      parentDiagCompleted,
      avgChildPerParent,
      viralCoefficient,
    },
  };
}
