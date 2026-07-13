// 計測集計の単一実装。/api/admin/stats (管理画面) と /api/metrics (スプレッドシート連携) の
// 両方がこの関数を使う。集計ロジックを二重管理しないための共有点。
//
// from/to は ISO 文字列 (events.created_at / users.created_at 等)。null なら全期間。
//
// ⚠️ 2026-07-13 全面改修 (数値が過小だった不具合の修正 + 現仕様への追随):
//   1. Supabase の既定 1000 行上限で全クエリが黙って切られていた
//      (例: diagnosis_question_answered 5.1万行 → 1000行しか集計されない)。
//      → fetchAll() でページングして全行を読む。件数だけでよいものは count クエリ。
//   2. タイプ分布が users.type_id (旧8タイプ) だった → 現仕様の 32 タイプを
//      users.scores から classifyThirtyTwoType で導出し、日本語名も返す。
//   3. 3人/5人達成が result_viewed イベントの metadata (再訪者しか数えられない)
//      だった → friend_perceptions (実データ) を target_user_id で数える。
//   4. 友達回答系の分布/キャンペーンも friend_answers → friend_perceptions に統一
//      (/me のゲートが参照するのは friend_perceptions)。
//   5. 課金 KPI (plan=full ユーザー数・概算売上) を追加。

import { supabaseAdmin } from "@/lib/supabase-server";
import {
  classifyThirtyTwoType,
  thirtyTwoName,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

const PAGE = 1000;
const TOTAL_QUESTIONS = 50; // 診断の設問数 (10問 × 5ページ)
const FULL_ACCESS_PRICE_JPY = 299;

export async function computeStats(from: string | null, to: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyRange<T>(query: T, column = "created_at"): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = query as any;
    if (from) q = q.gte(column, from);
    if (to) q = q.lte(column, to);
    return q as T;
  }

  // Supabase は既定で 1000 行しか返さないため、range() でページングして全行を読む。
  // make() は「毎回新しいクエリ」を返すファクトリ (builder は使い回せない)。
  // 安定ページングのため make() 側で order を付けること。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchAll<T>(make: () => any): Promise<T[]> {
    const out: T[] = [];
    for (let start = 0; ; start += PAGE) {
      const { data, error } = await make().range(start, start + PAGE - 1);
      if (error) {
        console.error("[admin-stats] fetchAll error:", error);
        break;
      }
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < PAGE) break;
    }
    return out;
  }

  // イベント行の全件取得ファクトリ (ユニークセッション算出用)
  const evRows = (names: string[], cols = "session_id") => () =>
    applyRange(
      supabaseAdmin
        .from("events")
        .select(cols)
        .in("event_name", names)
        .order("created_at", { ascending: true }),
    );

  // 件数だけでよいイベントは count クエリ (行を運ばない)
  const evCount = async (name: string): Promise<number> => {
    const { count } = await applyRange(
      supabaseAdmin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", name),
    );
    return count ?? 0;
  };

  // 質問到達: 5万行超を運ばず、questionId ごとの count クエリを並列で投げる
  const questionReachCounts = async (): Promise<Record<number, number>> => {
    const counts = await Promise.all(
      Array.from({ length: TOTAL_QUESTIONS }, (_, i) =>
        applyRange(
          supabaseAdmin
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("event_name", "diagnosis_question_answered")
            .eq("metadata->>questionId", String(i + 1)),
        ).then(
          (res: { count: number | null }) => [i, res.count ?? 0] as const,
        ),
      ),
    );
    const reach: Record<number, number> = {};
    // チャートは 0 始まり index を参照する (questionId は 1 始まり)
    for (const [idx, c] of counts) if (c > 0) reach[idx] = c;
    return reach;
  };

  type SessionRow = { session_id: string | null };

  const [
    startedRows,
    completedRows,
    answerStartedRows,
    answerCompletedRows,
    shareEventRows,
    viewedSessionRows,
    revisitedSessionRows,
    friendToDiagRows,
    friendLandingRows,
    paywallViewedRows,
    paywallScrollRows,
    purchaseCtaRows,
    users,
    perceptions,
    paidUserRows,
    recentRes,
    diagQuestionReach,
    checkoutCreated,
    purchaseCompleted,
  ] = await Promise.all([
    fetchAll<SessionRow>(evRows(["diagnosis_started"])),
    fetchAll<SessionRow>(evRows(["diagnosis_completed"])),
    // 正規名 + 旧名 (既存データ併合)
    fetchAll<SessionRow>(evRows(["friend_answer_started", "friend_v2_started"])),
    fetchAll<SessionRow>(
      evRows(["friend_answer_completed", "friend_v2_completed"]),
    ),
    fetchAll<SessionRow>(
      evRows([
        "friend_invite_clicked",
        "friend_share_clicked",
        "friend_link_copied",
      ]),
    ),
    fetchAll<SessionRow>(evRows(["result_viewed"])),
    fetchAll<SessionRow>(evRows(["result_revisited"])),
    fetchAll<SessionRow>(
      evRows(["friend_to_diagnosis_clicked", "friend_v2_self_cta_clicked"]),
    ),
    fetchAll<{ session_id: string | null; invite_code: string | null }>(
      evRows(["friend_landing_viewed"], "session_id, invite_code"),
    ),
    // ----- 課金ファネル -----
    fetchAll<SessionRow>(evRows(["paywall_viewed"])),
    fetchAll<{
      session_id: string | null;
      metadata: Record<string, unknown> | null;
    }>(evRows(["paywall_scroll_clicked"], "session_id, metadata")),
    fetchAll<SessionRow>(evRows(["purchase_cta_clicked"])),
    // ----- テーブル (期間は created_at) -----
    fetchAll<{
      id: string;
      scores: Record<string, unknown> | null;
      campaign: string | null;
      generation: number | null;
      source_user_id: string | null;
    }>(() =>
      applyRange(
        supabaseAdmin
          .from("users")
          .select("id, scores, campaign, generation, source_user_id")
          .order("created_at", { ascending: true }),
      ),
    ),
    // 友達回答の実データ (/me のゲートと同じ friend_perceptions を正とする)
    fetchAll<{ target_user_id: string }>(() =>
      applyRange(
        supabaseAdmin
          .from("friend_perceptions")
          .select("target_user_id")
          .order("created_at", { ascending: true }),
      ),
    ),
    // 課金ユーザー: 期間は full_access_at で切る (users.created_at ではない)。
    // 旧データで full_access_at が null の full ユーザーは全期間表示のみ計上。
    supabaseAdmin
      .from("users")
      .select("id, full_access_at")
      .eq("plan", "full")
      .then((res) => res.data ?? []),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("event_name, session_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(50),
    ),
    questionReachCounts(),
    evCount("checkout_session_created"),
    evCount("purchase_completed"),
  ]);

  const toUnique = (rows: SessionRow[]) =>
    new Set(rows.map((e) => e.session_id).filter(Boolean)).size;

  const diagnosisStarted = toUnique(startedRows);
  const diagnosisCompleted = toUnique(completedRows);
  const friendAnswerStarted = toUnique(answerStartedRows);
  const friendAnswerCompleted = toUnique(answerCompletedRows);
  const uniqueShare = toUnique(shareEventRows);
  const uniqueViewed = toUnique(viewedSessionRows);
  const friendToDiagClicked = toUnique(friendToDiagRows);

  // result_revisited: result_viewed も持つセッションのみ数える
  const viewedSessions = new Set(
    viewedSessionRows.map((e) => e.session_id).filter(Boolean),
  );
  const uniqueRevisited = new Set(
    revisitedSessionRows
      .map((e) => e.session_id)
      .filter((s): s is string => !!s && viewedSessions.has(s)),
  ).size;

  // --- 友達人数 (friend_perceptions が正。/me の解放ゲートと同じデータ源) ---
  const perceptionCounts = new Map<string, number>();
  for (const row of perceptions) {
    const uid = row.target_user_id;
    if (uid) perceptionCounts.set(uid, (perceptionCounts.get(uid) ?? 0) + 1);
  }
  let threeAchieved = 0;
  let fiveAchieved = 0;
  let with1 = 0,
    with2 = 0;
  for (const fc of perceptionCounts.values()) {
    if (fc >= 1) with1++;
    if (fc >= 2) with2++;
    if (fc >= 3) threeAchieved++;
    if (fc >= 5) fiveAchieved++;
  }
  const totalUsers = users.length;
  const friendCountDistribution = {
    total: totalUsers,
    zero: totalUsers - perceptionCounts.size,
    one: with1 - with2,
    two: with2 - threeAchieved,
    threePlus: threeAchieved,
    fivePlus: fiveAchieved,
  };

  // --- タイプ分布 (現仕様 = 32タイプ。users.scores から決定的に導出) ---
  // 旧 users.type_id は 8 タイプで表示と不一致のため使わない。
  // scores が壊れている行 (ゲスト購入のプレースホルダー等) は "unknown" に寄せる。
  const typeCounts: Record<string, { name: string; count: number }> = {};
  for (const row of users) {
    let key = "unknown";
    let name = "不明 (scores欠損)";
    const s = row.scores as Partial<Record<BigFiveDimension, number>> | null;
    if (s && typeof s === "object" && typeof s.E === "number") {
      try {
        const t32 = classifyThirtyTwoType(s);
        key = t32;
        name = thirtyTwoName(t32);
      } catch {
        // 分類不能は unknown のまま
      }
    }
    typeCounts[key] = typeCounts[key] ?? { name, count: 0 };
    typeCounts[key].count++;
  }
  const typeDistribution = Object.entries(typeCounts)
    .map(([typeId, v]) => ({ typeId, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count);

  // --- キャンペーン (友達回答は perceptions を紐付け) ---
  const campaignMap = new Map<
    string,
    { users: number; friendAnswers: number }
  >();
  const userIdToCampaign = new Map<string, string>();
  for (const row of users) {
    const c = row.campaign;
    if (c) {
      if (!campaignMap.has(c))
        campaignMap.set(c, { users: 0, friendAnswers: 0 });
      campaignMap.get(c)!.users++;
      userIdToCampaign.set(row.id, c);
    }
  }
  for (const [uid, fc] of perceptionCounts.entries()) {
    const c = userIdToCampaign.get(uid);
    if (c && campaignMap.has(c)) campaignMap.get(c)!.friendAnswers += fc;
  }
  const campaignStats = Array.from(campaignMap.entries())
    .map(([campaign, s]) => ({
      campaign,
      completed: s.users,
      friendCompleted: s.friendAnswers,
    }))
    .sort((a, b) => b.completed - a.completed);

  // --- 世代分布 ---
  const genCounts: Record<number, number> = {};
  let unknownGen = 0;
  for (const row of users) {
    const g = row.generation;
    if (g !== null && g !== undefined) {
      genCounts[g] = (genCounts[g] ?? 0) + 1;
    } else {
      unknownGen++;
    }
  }
  const generationDistribution = Object.entries(genCounts)
    .map(([gen, count]) => ({ generation: Number(gen), count }))
    .sort((a, b) => a.generation - b.generation);

  // --- バイラル指標 ---
  const friendLandingViewed = new Set(
    friendLandingRows.map((e) => e.session_id).filter(Boolean),
  ).size;
  const sharingUsersReached = new Set(
    friendLandingRows.map((e) => e.invite_code).filter(Boolean),
  ).size;
  const avgLandingPerSharer =
    sharingUsersReached > 0 ? friendLandingViewed / sharingUsersReached : 0;

  const childUsers = users.filter((r) => r.source_user_id != null);
  const childDiagCompleted = childUsers.length;
  const parentDiagCompleted = new Set(
    childUsers.map((r) => r.source_user_id),
  ).size;
  const avgChildPerParent =
    parentDiagCompleted > 0 ? childDiagCompleted / parentDiagCompleted : 0;
  const viralCoefficient =
    diagnosisCompleted > 0 ? childDiagCompleted / diagnosisCompleted : 0;

  // --- 課金 ---
  const paidUsers = paidUserRows.filter((r) => {
    const at = r.full_access_at as string | null;
    if (!from && !to) return true; // 全期間は full_access_at 無し (旧データ) も計上
    if (!at) return false;
    if (from && at < from) return false;
    if (to && at > to) return false;
    return true;
  }).length;
  const revenueJpy = paidUsers * FULL_ACCESS_PRICE_JPY;

  const paywallViewed = toUnique(paywallViewedRows);
  const paywallScrollClicked = toUnique(paywallScrollRows);
  const purchaseCtaClicked = toUnique(purchaseCtaRows);

  // 誘導クリックの source 内訳 (どのボタンが課金カードへ誘導しているか)
  const sourceCounts = new Map<string, number>();
  for (const row of paywallScrollRows) {
    const s =
      typeof row.metadata?.source === "string"
        ? row.metadata.source
        : "unknown";
    sourceCounts.set(s, (sourceCounts.get(s) ?? 0) + 1);
  }
  const paywallSources = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

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
    // 課金ファネル: 結果ページ表示 → カード表示 → 誘導クリック → 購入CTA →
    // Stripe到達 → 決済完了。前半はユニークセッション、後半2つは件数 (サーバ発行)。
    paywallFunnel: [
      { label: "結果ページ表示", count: uniqueViewed },
      { label: "課金カード表示", count: paywallViewed },
      { label: "解除ボタン押下", count: paywallScrollClicked },
      { label: "購入CTA押下", count: purchaseCtaClicked },
      { label: "Stripe到達", count: checkoutCreated },
      { label: "決済完了", count: purchaseCompleted },
    ],
    paywallSources,
    purchaseCompleted,
    purchaseConversionRate: rate(purchaseCompleted, paywallViewed),
    paidUsers,
    revenueJpy,
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
