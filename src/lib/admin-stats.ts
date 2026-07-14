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
  thirtyTwoEssence,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

const PAGE = 1000;
const TOTAL_QUESTIONS = 50; // 診断の設問数 (10問 × 5ページ)
// 概算売上の単価。2026-07-14 に ¥199 → ¥499 へ改定 (それ以前の購入分は過大に出る)。
const FULL_ACCESS_PRICE_JPY = 499;

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

  // イベント行の全件取得ファクトリ (ユニークセッション算出用)。
  // order は created_at + id の複合 (同時刻行のタイブレークでページ境界の取りこぼしを防ぐ)。
  const evRows = (names: string[], cols = "session_id") => () =>
    applyRange(
      supabaseAdmin
        .from("events")
        .select(cols)
        .in("event_name", names)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    );

  type StripeEventRow = { metadata: Record<string, unknown> | null };

  // サーバ発行イベント (checkout/purchase) は webhook 再送等での重複挿入があり得るため、
  // 件数ではなく stripe_session_id のユニーク数で数える (二重計上の恒久対策)。
  const countUniqueStripeSessions = (rows: StripeEventRow[]): number => {
    const ids = new Set<string>();
    let noId = 0;
    for (const r of rows) {
      const sid = r.metadata?.stripe_session_id;
      if (typeof sid === "string" && sid) ids.add(sid);
      else noId++; // 旧形式など id 無し行は個別に数える (落とさない)
    }
    return ids.size + noId;
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
    checkoutCreatedRows,
    purchaseCompletedRows,
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
    fetchAll<{
      session_id: string | null;
      metadata: Record<string, unknown> | null;
    }>(evRows(["purchase_cta_clicked"], "session_id, metadata")),
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
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
    ),
    // 友達回答の実データ (/me のゲートと同じ friend_perceptions を正とする)。
    // ★期間フィルタを掛けずに全件読む: 3人/5人達成は「累計でN人目が期間内に届いたか」で
    //   判定するため、期間前からの積み上げが必要 (期間内の回答だけで数えると過小になる)。
    fetchAll<{ target_user_id: string; created_at: string }>(() =>
      supabaseAdmin
        .from("friend_perceptions")
        .select("target_user_id, created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ),
    // 課金ユーザー: webhook は同一 email の全 users 行を full にするため、行数で数えると
    // 再診断ユーザーの購入が多重計上される。email (無ければ id) でユニーク化する。
    // 期間は full_access_at (購入時刻)。ページングも必須 (1000行上限)。
    fetchAll<{ id: string; email: string | null; full_access_at: string | null }>(
      () =>
        supabaseAdmin
          .from("users")
          .select("id, email, full_access_at")
          .eq("plan", "full")
          .order("id", { ascending: true }),
    ),
    applyRange(
      supabaseAdmin
        .from("events")
        .select("event_name, session_id, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(50),
    ),
    questionReachCounts(),
    fetchAll<StripeEventRow>(
      evRows(["checkout_session_created"], "metadata"),
    ),
    fetchAll<StripeEventRow>(evRows(["purchase_completed"], "metadata")),
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
  // perceptions は全期間ぶん。オーナーごとに回答時刻の昇順リストを作る。
  const perceptionDates = new Map<string, string[]>();
  for (const row of perceptions) {
    const uid = row.target_user_id;
    if (!uid) continue;
    const arr = perceptionDates.get(uid) ?? [];
    arr.push(row.created_at);
    perceptionDates.set(uid, arr);
  }
  const inRange = (iso: string) => {
    const t = Date.parse(iso);
    if (from && t < Date.parse(from)) return false;
    if (to && t > Date.parse(to)) return false;
    return true;
  };
  // 3人/5人達成 = 「N人目の回答が期間内に届いたオーナー数」(全期間なら累計到達数)。
  // 期間内の回答数だけで数えると、期間前からの積み上げ到達が消えて過小になるため。
  let threeAchieved = 0;
  let fiveAchieved = 0;
  for (const dates of perceptionDates.values()) {
    if (dates.length >= 3 && inRange(dates[2])) threeAchieved++;
    if (dates.length >= 5 && inRange(dates[4])) fiveAchieved++;
  }
  // 分布 = 期間内に作成されたユーザー × 累計の友達人数のスナップショット
  // (バケット合計が必ず total と一致する。zero が負になる旧バグの修正)。
  const totalUsers = users.length;
  const friendCountDistribution = {
    total: totalUsers,
    zero: 0,
    one: 0,
    two: 0,
    threePlus: 0,
    fivePlus: 0,
  };
  for (const row of users) {
    const fc = perceptionDates.get(row.id)?.length ?? 0;
    if (fc === 0) friendCountDistribution.zero++;
    else if (fc === 1) friendCountDistribution.one++;
    else if (fc === 2) friendCountDistribution.two++;
    else friendCountDistribution.threePlus++;
    if (fc >= 5) friendCountDistribution.fivePlus++;
  }

  // --- タイプ分布 (現仕様 = 32タイプ。users.scores から決定的に導出) ---
  // 旧 users.type_id は 8 タイプで表示と不一致のため使わない。
  // 表示名はユーザー向けの「称号」(essence。/types・/me ヒーローと同じ。寄添者/夢想家 等)。
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
        name = thirtyTwoEssence(t32);
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
  for (const [uid, dates] of perceptionDates.entries()) {
    const c = userIdToCampaign.get(uid);
    if (!c || !campaignMap.has(c)) continue;
    // キャンペーン別の友達回答は期間内の回答数で数える
    campaignMap.get(c)!.friendAnswers += dates.filter(inRange).length;
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
  // webhook (grantFullAccessByEmailOrId) は同一 email の全 users 行を full にするため、
  // 「人」= email (無ければ行id) でユニーク化する。購入時刻はその人の最古の full_access_at。
  // 期間判定は Date.parse の数値比較 ('+00:00' と 'Z' の表記差で文字列比較が壊れるため)。
  const paidPersons = new Map<string, string | null>(); // personKey -> earliest full_access_at
  for (const r of paidUserRows) {
    const key = (r.email ?? "").trim().toLowerCase() || `id:${r.id}`;
    const prev = paidPersons.get(key);
    const at = r.full_access_at;
    if (prev === undefined) {
      paidPersons.set(key, at);
    } else if (at && (!prev || Date.parse(at) < Date.parse(prev))) {
      paidPersons.set(key, at);
    }
  }
  let paidUsers = 0;
  for (const at of paidPersons.values()) {
    if (!from && !to) {
      paidUsers++; // 全期間は full_access_at 無し (旧データ) も計上
    } else if (at && inRange(at)) {
      paidUsers++;
    }
  }
  const revenueJpy = paidUsers * FULL_ACCESS_PRICE_JPY;

  const paywallViewed = toUnique(paywallViewedRows);
  const paywallScrollClicked = toUnique(paywallScrollRows);
  const purchaseCtaClicked = toUnique(purchaseCtaRows);
  const checkoutCreated = countUniqueStripeSessions(checkoutCreatedRows);
  const purchaseCompleted = countUniqueStripeSessions(purchaseCompletedRows);

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

  type AttributionRow = {
    session_id?: string | null;
    metadata: Record<string, unknown> | null;
  };

  // 導線別CVRの分母・分子は、同じユーザーの連打やWebhook再送で膨らまないよう
  // クライアントイベントは session_id、サーバイベントは stripe_session_id でユニーク化する。
  const uniqueCountsBySource = (
    rows: AttributionRow[],
    idField: "session_id" | "stripe_session_id",
  ): Map<string, number> => {
    const grouped = new Map<string, Set<string>>();
    rows.forEach((row, index) => {
      const source =
        typeof row.metadata?.source === "string"
          ? row.metadata.source
          : "unknown";
      const rawId =
        idField === "session_id"
          ? row.session_id
          : row.metadata?.stripe_session_id;
      // 旧データなどIDが無い行も落とさず、行単位で1件として扱う。
      const id =
        typeof rawId === "string" && rawId
          ? rawId
          : `legacy:${index}`;
      const ids = grouped.get(source) ?? new Set<string>();
      ids.add(id);
      grouped.set(source, ids);
    });
    return new Map(
      Array.from(grouped.entries()).map(([source, ids]) => [source, ids.size]),
    );
  };

  const scrollBySource = uniqueCountsBySource(
    paywallScrollRows,
    "session_id",
  );
  const purchaseCtaBySource = uniqueCountsBySource(
    purchaseCtaRows,
    "session_id",
  );
  const checkoutBySource = uniqueCountsBySource(
    checkoutCreatedRows,
    "stripe_session_id",
  );
  const purchaseBySource = uniqueCountsBySource(
    purchaseCompletedRows,
    "stripe_session_id",
  );
  const attributionSources = new Set([
    ...scrollBySource.keys(),
    ...purchaseCtaBySource.keys(),
    ...checkoutBySource.keys(),
    ...purchaseBySource.keys(),
  ]);
  const paywallAttribution = Array.from(attributionSources)
    .map((source) => {
      const scrollClicks = scrollBySource.get(source) ?? 0;
      const purchaseCtaClicks = purchaseCtaBySource.get(source) ?? 0;
      const stripeReached = checkoutBySource.get(source) ?? 0;
      const purchases = purchaseBySource.get(source) ?? 0;
      return {
        source,
        scrollClicks,
        purchaseCtaClicks,
        stripeReached,
        purchases,
        purchaseRate: scrollClicks > 0 ? purchases / scrollClicks : null,
      };
    })
    .sort(
      (a, b) =>
        b.purchases - a.purchases ||
        b.stripeReached - a.stripeReached ||
        b.scrollClicks - a.scrollClicks,
    );

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
    paywallAttribution,
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
