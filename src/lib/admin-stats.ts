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
import {
  computeCoreKpis,
  isCoreKpiPaymentSchemaPending,
  isMissingCoreKpiColumn,
  type CoreKpiPaymentFact,
} from "@/lib/core-kpis";

const PAGE = 1000;
const TOTAL_QUESTIONS = 50; // 診断の設問数 (10問 × 5ページ)
// 概算売上の単価。2026-07-14 に ¥199 → ¥499 へ改定 (それ以前の購入分は過大に出る)。
const FULL_ACCESS_PRICE_JPY = 499;
// /tako 到達を owner_token + invite_code 付きでページ本体から計測し始める時刻。
// これ以前を分母に混ぜると「到達していたがイベントが無い人」が離脱扱いになるため除外する。
const FRIEND_FUNNEL_MEASUREMENT_STARTED_AT = "2026-07-18T04:15:00.000Z";

export async function computeStats(from: string | null, to: string | null) {
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
  async function fetchAll<T>(
    // Supabase query builders carry table-specific generics; pagination only needs range().
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    make: () => any,
    onError?: (error: { code?: string; message?: string }) => boolean | void,
  ): Promise<T[]> {
    const out: T[] = [];
    for (let start = 0; ; start += PAGE) {
      const { data, error } = await make().range(start, start + PAGE - 1);
      if (error) {
        const handled = onError?.(error) === true;
        if (!handled) console.error("[admin-stats] fetchAll error:", error);
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

  // コホートファネルは、期間内に自己診断を完了した本人がその後どこまで進んだかを見る。
  // 下流イベントには to を掛けず、選択期間終了後の到達も含む（eventual conversion）。
  const journeyRows = (names: string[], cols: string) => () => {
    let query = supabaseAdmin
      .from("events")
      .select(cols)
      .in("event_name", names)
      .gte("created_at", FRIEND_FUNNEL_MEASUREMENT_STARTED_AT)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (from && Date.parse(from) > Date.parse(FRIEND_FUNNEL_MEASUREMENT_STARTED_AT)) {
      query = query.gte("created_at", from);
    }
    return query;
  };

  type StripeEventRow = { metadata: Record<string, unknown> | null };
  type PaymentHistoryRow = {
    user_id: string;
    stripe_session_id: string;
    amount_jpy: number;
    amount_refunded_minor: number | null;
    currency: string;
    status: string;
    paid_at: string | null;
    created_at: string;
    payment_kind: string | null;
  };
  type KpiPaymentEventRow = {
    event_name: string;
    owner_token: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

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

  const coreSchemaIssues: string[] = [];
  const recordCoreSchemaIssue = (error: {
    code?: string;
    message?: string;
  }) => {
    const issue = [error.code, error.message].filter(Boolean).join(": ");
    if (issue && !coreSchemaIssues.includes(issue)) coreSchemaIssues.push(issue);
    return (
      isMissingCoreKpiColumn(error, "diagnosis_completed_at") ||
      isCoreKpiPaymentSchemaPending(error)
    );
  };

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
    friendJourneyRows,
    identityRows,
    coreUserRows,
    paymentHistoryRows,
    kpiPaymentEventRows,
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
    fetchAll<{
      event_name: string;
      session_id: string | null;
      invite_code: string | null;
      owner_token: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>(
      journeyRows(
        [
          "result_viewed",
          "diagnosis_completed",
          "tako_viewed",
          "tako_nav_badge_shown",
          "tako_nav_badge_clicked",
          "friend_invite_clicked",
          "friend_share_clicked",
          "friend_link_copied",
          "friend_landing_viewed",
          "friend_answer_completed",
          "friend_v2_completed",
          "friend_to_diagnosis_clicked",
          "friend_v2_self_cta_clicked",
        ],
        "event_name, session_id, invite_code, owner_token, metadata, created_at",
      ),
    ),
    fetchAll<{
      id: string;
      owner_token: string | null;
      invite_code: string | null;
      source_user_id: string | null;
      created_at: string;
    }>(() =>
      supabaseAdmin
        .from("users")
        .select("id, owner_token, invite_code, source_user_id, created_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ),
    fetchAll<{
      id: string;
      diagnosis_completed_at: string | null;
      full_access_at: string | null;
      source_user_id: string | null;
    }>(
      () =>
        supabaseAdmin
          .from("users")
          .select(
            "id, diagnosis_completed_at, full_access_at, source_user_id",
          )
          .order("id", { ascending: true }),
      recordCoreSchemaIssue,
    ),
    fetchAll<PaymentHistoryRow>(
      () =>
        supabaseAdmin
          .from("payment_history")
          .select(
            "user_id, stripe_session_id, amount_jpy, amount_refunded_minor, currency, status, paid_at, created_at, payment_kind",
          )
          .eq("payment_kind", "full_access")
          .in("status", ["completed", "refunded"])
          .order("created_at", { ascending: true })
          .order("stripe_session_id", { ascending: true }),
      recordCoreSchemaIssue,
    ),
    fetchAll<KpiPaymentEventRow>(() =>
      supabaseAdmin
        .from("events")
        .select("event_name, owner_token, metadata, created_at")
        .in("event_name", ["checkout_session_created", "purchase_completed"])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ),
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

  // --- 友達診断コホートファネル ---
  // 分母は計測開始後、選択期間内に result_viewed が確認できた owner_token。
  // 同じ本人について、期間終了後に起きた下流イベントも現在時点まで追跡する。
  type JourneyRow = (typeof friendJourneyRows)[number];
  const journeyInCohortRange = (iso: string) => {
    const time = Date.parse(iso);
    if (time < Date.parse(FRIEND_FUNNEL_MEASUREMENT_STARTED_AT)) return false;
    if (from && time < Date.parse(from)) return false;
    if (to && time > Date.parse(to)) return false;
    return true;
  };

  const diagnosisCohortSessions = new Map<string, number>();
  for (const row of friendJourneyRows) {
    if (
      row.event_name !== "diagnosis_completed" ||
      !row.session_id ||
      !journeyInCohortRange(row.created_at)
    ) {
      continue;
    }
    const time = Date.parse(row.created_at);
    const previous = diagnosisCohortSessions.get(row.session_id);
    if (previous === undefined || time > previous) {
      diagnosisCohortSessions.set(row.session_id, time);
    }
  }

  const cohortResultBySession = new Map<
    string,
    { ownerToken: string; resultViewedAt: number }
  >();
  for (const row of friendJourneyRows) {
    if (
      row.event_name !== "result_viewed" ||
      !row.owner_token ||
      !row.session_id ||
      !journeyInCohortRange(row.created_at)
    ) {
      continue;
    }
    const time = Date.parse(row.created_at);
    const completedAt = diagnosisCohortSessions.get(row.session_id);
    if (completedAt === undefined || completedAt > time) continue;
    const previous = cohortResultBySession.get(row.session_id);
    if (!previous || time < previous.resultViewedAt) {
      cohortResultBySession.set(row.session_id, {
        ownerToken: row.owner_token,
        resultViewedAt: time,
      });
    }
  }
  const cohortStartedAt = new Map<string, number>();
  for (const { ownerToken, resultViewedAt } of cohortResultBySession.values()) {
    const previous = cohortStartedAt.get(ownerToken);
    if (previous === undefined || resultViewedAt < previous) {
      cohortStartedAt.set(ownerToken, resultViewedAt);
    }
  }
  const cohortOwners = new Set(cohortStartedAt.keys());

  const inviteToOwner = new Map<string, string>();
  const ownerToUserId = new Map<string, string>();
  for (const row of identityRows) {
    if (!row.owner_token) continue;
    ownerToUserId.set(row.owner_token, row.id);
    if (row.invite_code) inviteToOwner.set(row.invite_code, row.owner_token);
  }

  const sessionToOwner = new Map<string, string>();
  for (const row of friendJourneyRows) {
    if (!row.session_id) continue;
    const directOwner =
      row.owner_token && cohortOwners.has(row.owner_token)
        ? row.owner_token
        : row.invite_code
          ? inviteToOwner.get(row.invite_code)
          : null;
    if (directOwner && cohortOwners.has(directOwner)) {
      sessionToOwner.set(row.session_id, directOwner);
    }
  }

  const ownerForJourney = (row: JourneyRow): string | null => {
    if (row.owner_token && cohortOwners.has(row.owner_token)) {
      return row.owner_token;
    }
    if (row.invite_code) {
      const owner = inviteToOwner.get(row.invite_code);
      if (owner && cohortOwners.has(owner)) return owner;
    }
    if (row.session_id) {
      const owner = sessionToOwner.get(row.session_id);
      if (owner && cohortOwners.has(owner)) return owner;
    }
    return null;
  };

  const happenedAfterCohortStart = (row: JourneyRow, owner: string) =>
    Date.parse(row.created_at) >= (cohortStartedAt.get(owner) ?? Infinity);

  const takoReachedOwners = new Set<string>();
  const inviteActionOwners = new Set<string>();
  const friendReachedOwners = new Set<string>();
  const friendAnsweredOwners = new Set<string>();
  const badgeShownOwners = new Set<string>();
  const badgeClickedOwners = new Set<string>();
  const friendLandingSessions = new Set<string>();
  const friendAnswerSessions = new Set<string>();
  const friendToDiagnosisSessions = new Set<string>();

  for (const row of friendJourneyRows) {
    const owner = ownerForJourney(row);
    if (!owner) continue;

    // BottomNav と ResultViewTracker の effect 順により、バッジ表示が result_viewed より
    // 数ミリ秒先になる場合がある。コホート本人であれば表示・クリックはそのまま採用する。
    if (row.event_name === "tako_nav_badge_shown") badgeShownOwners.add(owner);
    if (row.event_name === "tako_nav_badge_clicked") badgeClickedOwners.add(owner);
    if (!happenedAfterCohortStart(row, owner)) continue;

    if (row.event_name === "tako_viewed") takoReachedOwners.add(owner);
    if (
      row.event_name === "friend_invite_clicked" ||
      row.event_name === "friend_share_clicked" ||
      row.event_name === "friend_link_copied"
    ) {
      inviteActionOwners.add(owner);
    }
    if (row.event_name === "friend_landing_viewed") {
      friendReachedOwners.add(owner);
      inviteActionOwners.add(owner); // QRなどクリックを伴わない招待も、到達実績で補完する。
      if (row.session_id) friendLandingSessions.add(row.session_id);
    }
    if (
      row.event_name === "friend_answer_completed" ||
      row.event_name === "friend_v2_completed"
    ) {
      friendAnsweredOwners.add(owner);
      friendReachedOwners.add(owner);
      inviteActionOwners.add(owner);
      if (row.session_id) friendAnswerSessions.add(row.session_id);
    }
    if (
      row.event_name === "friend_to_diagnosis_clicked" ||
      row.event_name === "friend_v2_self_cta_clicked"
    ) {
      if (row.session_id) friendToDiagnosisSessions.add(row.session_id);
    }
  }

  // 子診断はイベントではなく users.source_user_id を正とし、コホートの親に紐づく人数を数える。
  const cohortOwnerByUserId = new Map<string, string>();
  for (const owner of cohortOwners) {
    const userId = ownerToUserId.get(owner);
    if (userId) cohortOwnerByUserId.set(userId, owner);
  }
  let cohortChildDiagnosisCompleted = 0;
  for (const row of identityRows) {
    if (!row.source_user_id) continue;
    const owner = cohortOwnerByUserId.get(row.source_user_id);
    if (!owner) continue;
    if (Date.parse(row.created_at) >= (cohortStartedAt.get(owner) ?? Infinity)) {
      cohortChildDiagnosisCompleted++;
    }
  }

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

  // --- 経営KPI（サーバー側の業務データを正本にしたユーザーコホート） ---
  // payment_history 適用前の購入は purchase_completed と、その Stripe Session を
  // 発行した checkout_session_created を突合して補完する。Session ID で必ず冪等化。
  const ownerTokenToUserId = new Map<string, string>();
  for (const row of identityRows) {
    if (row.owner_token) ownerTokenToUserId.set(row.owner_token, row.id);
  }

  const checkoutIdentityBySession = new Map<
    string,
    { userId: string | null; ownerToken: string | null }
  >();
  for (const row of kpiPaymentEventRows) {
    if (row.event_name !== "checkout_session_created") continue;
    const stripeSessionId = row.metadata?.stripe_session_id;
    if (typeof stripeSessionId !== "string" || !stripeSessionId) continue;
    const metadataUserId = row.metadata?.user_id;
    checkoutIdentityBySession.set(stripeSessionId, {
      userId:
        typeof metadataUserId === "string" && metadataUserId
          ? metadataUserId
          : null,
      ownerToken: row.owner_token,
    });
  }

  const verifiedPaymentFacts: CoreKpiPaymentFact[] = [];
  const knownStripeSessions = new Set<string>();
  for (const row of paymentHistoryRows) {
    const paidAt = row.paid_at ?? row.created_at;
    knownStripeSessions.add(row.stripe_session_id);
    verifiedPaymentFacts.push({
      stripeSessionId: row.stripe_session_id,
      userId: row.user_id,
      paidAt,
      currency: row.currency,
      amountMinor: row.amount_jpy,
      refundedAmountMinor: row.amount_refunded_minor ?? 0,
    });
  }

  let unmatchedPaymentCount = 0;
  for (const row of kpiPaymentEventRows) {
    if (row.event_name !== "purchase_completed") continue;
    const stripeSessionId = row.metadata?.stripe_session_id;
    if (typeof stripeSessionId !== "string" || !stripeSessionId) {
      unmatchedPaymentCount++;
      continue;
    }
    if (knownStripeSessions.has(stripeSessionId)) continue;
    knownStripeSessions.add(stripeSessionId);

    const checkoutIdentity = checkoutIdentityBySession.get(stripeSessionId);
    const metadataUserId = row.metadata?.user_id;
    const metadataOwnerToken = row.metadata?.owner_token;
    const ownerToken =
      typeof metadataOwnerToken === "string" && metadataOwnerToken
        ? metadataOwnerToken
        : row.owner_token ?? checkoutIdentity?.ownerToken ?? null;
    const userId =
      typeof metadataUserId === "string" && metadataUserId
        ? metadataUserId
        : checkoutIdentity?.userId ??
          (ownerToken ? ownerTokenToUserId.get(ownerToken) : null);
    const amount = row.metadata?.amount_total;
    const rawCurrency = row.metadata?.currency;
    const locale = row.metadata?.locale;
    const currency =
      typeof rawCurrency === "string" && rawCurrency
        ? rawCurrency
        : locale === "ko"
          ? "krw"
          : "jpy";
    if (!userId || typeof amount !== "number" || !Number.isFinite(amount)) {
      unmatchedPaymentCount++;
      continue;
    }
    verifiedPaymentFacts.push({
      stripeSessionId,
      userId,
      paidAt: row.created_at,
      currency,
      amountMinor: amount,
      refundedAmountMinor: 0,
    });
  }

  // 選択期間中に確定したフルアクセス決済の実売上。
  // ARPU は「選択期間に診断した人が、その後いくら購入したか」というコホート指標だが、
  // ダッシュボード最上段の課金額は「選択期間中に実際に入金された額」を表示する。
  const periodRevenueBuckets = new Map<
    string,
    {
      grossRevenueMinor: number;
      refundedMinor: number;
      netRevenueMinor: number;
      purchases: number;
      payerIds: Set<string>;
    }
  >();
  for (const payment of verifiedPaymentFacts) {
    if (!inRange(payment.paidAt)) continue;
    const currency = payment.currency.toLowerCase();
    const bucket = periodRevenueBuckets.get(currency) ?? {
      grossRevenueMinor: 0,
      refundedMinor: 0,
      netRevenueMinor: 0,
      purchases: 0,
      payerIds: new Set<string>(),
    };
    const refundedMinor = Math.min(
      Math.max(payment.refundedAmountMinor, 0),
      payment.amountMinor,
    );
    bucket.grossRevenueMinor += payment.amountMinor;
    bucket.refundedMinor += refundedMinor;
    bucket.netRevenueMinor += payment.amountMinor - refundedMinor;
    bucket.purchases++;
    bucket.payerIds.add(payment.userId);
    periodRevenueBuckets.set(currency, bucket);
  }

  const periodRevenue = {
    basis: "選択期間中に支払いが確定したフルアクセス決済の純売上",
    currencies: Array.from(periodRevenueBuckets.entries())
      .map(([currency, bucket]) => ({
        currency,
        grossRevenueMinor: bucket.grossRevenueMinor,
        refundedMinor: bucket.refundedMinor,
        netRevenueMinor: bucket.netRevenueMinor,
        purchases: bucket.purchases,
        payers: bucket.payerIds.size,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };

  const computedCoreKpis = computeCoreKpis({
    users: coreUserRows.map((row) => ({
      id: row.id,
      diagnosisCompletedAt: row.diagnosis_completed_at,
      fullAccessAt: row.full_access_at,
      sourceUserId: row.source_user_id,
    })),
    friends: perceptions.map((row) => ({
      targetUserId: row.target_user_id,
      createdAt: row.created_at,
    })),
    payments: verifiedPaymentFacts,
    from,
    to,
    unmatchedPaymentCount,
  });
  const coreKpis = {
    ...computedCoreKpis,
    periodRevenue,
    dataQuality: {
      ...computedCoreKpis.dataQuality,
      ready: coreSchemaIssues.length === 0,
      issues: coreSchemaIssues,
    },
  };

  const ownerFunnelCounts = [
    diagnosisCohortSessions.size,
    cohortOwners.size,
    takoReachedOwners.size,
    inviteActionOwners.size,
    friendReachedOwners.size,
    friendAnsweredOwners.size,
  ];
  const ownerFunnelLabels = [
    "友達導線の計測対象",
    "結果ページ到達",
    "友達診断ページ到達",
    "招待実行（友達到達で補完）",
    "友達がページ到達",
    "友達が1人以上回答完了",
  ];
  const ownerFunnel = ownerFunnelCounts.map((count, index) => ({
    key: [
      "diagnosis",
      "result",
      "tako",
      "invite",
      "friend_landing",
      "friend_answer",
    ][index],
    label: ownerFunnelLabels[index],
    count,
    rateFromPrevious:
      index === 0 ? null : rate(count, ownerFunnelCounts[index - 1]),
    rateFromDiagnosis: rate(count, ownerFunnelCounts[0]),
  }));

  const friendFunnelCounts = [
    friendLandingSessions.size,
    friendAnswerSessions.size,
    friendToDiagnosisSessions.size,
    cohortChildDiagnosisCompleted,
  ];
  const friendFunnelLabels = [
    "友達が招待ページ到達",
    "友達が回答完了",
    "友達が「自分も診断」をクリック",
    "友達が自己診断完了",
  ];
  const friendFunnel = friendFunnelCounts.map((count, index) => ({
    key: ["landing", "answer", "self_cta", "self_complete"][index],
    label: friendFunnelLabels[index],
    count,
    rateFromPrevious:
      index === 0 ? null : rate(count, friendFunnelCounts[index - 1]),
    rateFromLanding: rate(count, friendFunnelCounts[0]),
  }));

  return {
    coreKpis,
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
      { label: "診断開始イベント", count: diagnosisStarted },
      { label: "診断完了イベント", count: diagnosisCompleted },
      { label: "友達共有", count: uniqueShare },
      { label: "友達ページ到達", count: friendLandingViewed },
      { label: "友達回答開始", count: friendAnswerStarted },
      { label: "友達回答完了", count: friendAnswerCompleted },
      { label: "3人達成", count: threeAchieved },
      { label: "5人達成", count: fiveAchieved },
    ],
    friendDiagnosisFunnel: {
      measurementStartedAt: FRIEND_FUNNEL_MEASUREMENT_STARTED_AT,
      cohortDefinition:
        "友達導線の計測開始後、選択期間内に自己診断完了イベントを送信したセッションだけを、その後の行動まで追跡する参考ファネル",
      ownerFunnel,
      friendFunnel,
      attention: {
        badgeShown: badgeShownOwners.size,
        badgeClicked: badgeClickedOwners.size,
        badgeClickRate: rate(badgeClickedOwners.size, badgeShownOwners.size),
        takoReached: takoReachedOwners.size,
        takoReachRate: rate(
          takoReachedOwners.size,
          diagnosisCohortSessions.size,
        ),
      },
    },
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
