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
import { TAKO_PAYWALL_SOURCES } from "@/lib/paywall-source";
import {
  ACCESS_PRODUCTS,
  FULL_ACCESS_PRICE_JPY,
  THREE_COURSE_PAYWALL_VERSION,
  type AccessProduct,
} from "@/lib/access-products";
import { paywallCardMode } from "@/lib/feature-flags";

const PAGE = 1000;
const RETRY_PAGE = 250;
const TOTAL_QUESTIONS = 50; // 診断の設問数 (10問 × 5ページ)
const QUESTION_COUNT_CONCURRENCY = 2;
const DB_QUERY_CONCURRENCY = 2;
// /tako 到達を owner_token + invite_code 付きでページ本体から計測し始める時刻。
// これ以前を分母に混ぜると「到達していたがイベントが無い人」が離脱扱いになるため除外する。
const FRIEND_FUNNEL_MEASUREMENT_STARTED_AT = "2026-07-18T04:15:00.000Z";

// Fluid Compute では同一インスタンスで複数リクエストが並行実行されるため、集計ごとの
// Promise.all だけでなくモジュール全体でDB同時実行数を抑える。大量のページング/countが
// 一斉に走って Supabase の statement_timeout に達するのを防ぐ。
let activeDbQueries = 0;
const dbQueryWaiters: Array<() => void> = [];

async function withDbQuerySlot<T>(query: () => PromiseLike<T>): Promise<T> {
  if (activeDbQueries >= DB_QUERY_CONCURRENCY) {
    await new Promise<void>((resolve) => dbQueryWaiters.push(resolve));
  }
  activeDbQueries++;
  try {
    return await query();
  } finally {
    activeDbQueries--;
    dbQueryWaiters.shift()?.();
  }
}

export async function computeStats(from: string | null, to: string | null) {
  function applyRange<T>(query: T, column = "created_at"): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = query as any;
    if (from) q = q.gte(column, from);
    if (to) q = q.lte(column, to);
    return q as T;
  }

  type PageQueryFactory = (() => {
    // Supabase query builders carry table-specific generics.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }) & { pagination?: "created_at-id" };

  // Supabase は既定で 1000 行しか返さないため、ページングして全行を読む。
  // make() は「毎回新しいクエリ」を返すファクトリ (builder は使い回せない)。
  // events は OFFSET が後半ほど遅くなるため created_at + id のキーセット方式を使う。
  async function fetchAll<T>(
    make: PageQueryFactory,
    onError?: (error: { code?: string; message?: string }) => boolean | void,
  ): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    let pageSize = PAGE;
    let cursor: { createdAt: string; id: string } | null = null;
    for (;;) {
      const runPage = (size: number) => {
        let query = make();
        if (make.pagination === "created_at-id" && cursor) {
          query = query.or(
            `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`,
          );
        }
        return withDbQuerySlot<{
          data: T[] | null;
          error: { code?: string; message?: string } | null;
        }>(() =>
          make.pagination === "created_at-id"
            ? query.limit(size)
            : query.range(offset, offset + size - 1),
        );
      };

      let result = await runPage(pageSize);
      if (result.error?.code === "57014" && pageSize > RETRY_PAGE) {
        // Supabase の statement_timeout は同じ全件集計でも、1ページの返却量を
        // 小さくすると回避できる場合がある。失敗したページだけ縮小して再試行し、
        // 件数・期間など集計の意味は変えない。
        pageSize = RETRY_PAGE;
        console.warn(
          `[admin-stats] page timed out; retrying with ${RETRY_PAGE} rows`,
        );
        result = await runPage(pageSize);
      }
      const { data, error } = result as {
        data: T[] | null;
        error: { code?: string; message?: string } | null;
      };
      if (error) {
        const handled = onError?.(error) === true;
        if (handled) break;
        throw new Error(
          `[admin-stats] fetchAll: ${error.code ?? "unknown"} ${error.message ?? "query failed"}`,
        );
      }
      if (!data || data.length === 0) break;
      out.push(...(data as T[]));
      if (data.length < pageSize) break;
      if (make.pagination === "created_at-id") {
        const last = data[data.length - 1] as T & {
          created_at?: string;
          id?: string;
        };
        if (!last.created_at || !last.id) {
          throw new Error(
            "[admin-stats] keyset page is missing created_at or id",
          );
        }
        cursor = { createdAt: last.created_at, id: last.id };
      } else {
        offset += pageSize;
      }
    }
    return out;
  }

  // イベント行の全件取得ファクトリ (ユニークセッション算出用)。
  // order は created_at + id の複合 (同時刻行のタイブレークでページ境界の取りこぼしを防ぐ)。
  const evRows = (names: string[], cols = "session_id") => {
    const selectCols = Array.from(
      new Set([
        ...cols.split(",").map((column) => column.trim()),
        "created_at",
        "id",
      ]),
    ).join(", ");
    const make = (() =>
      applyRange(
        supabaseAdmin
          .from("events")
          .select(selectCols)
          .in("event_name", names)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      )) as PageQueryFactory;
    make.pagination = "created_at-id";
    return make;
  };

  // コホートファネルは、期間内に自己診断を完了した本人がその後どこまで進んだかを見る。
  // 下流イベントには to を掛けず、選択期間終了後の到達も含む（eventual conversion）。
  const journeyRows = (names: string[], cols: string) => {
    const selectCols = Array.from(
      new Set([
        ...cols.split(",").map((column) => column.trim()),
        "created_at",
        "id",
      ]),
    ).join(", ");
    const make = (() => {
      let query = supabaseAdmin
        .from("events")
        .select(selectCols)
        .in("event_name", names)
        .gte("created_at", FRIEND_FUNNEL_MEASUREMENT_STARTED_AT)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (
        from &&
        Date.parse(from) > Date.parse(FRIEND_FUNNEL_MEASUREMENT_STARTED_AT)
      ) {
        query = query.gte("created_at", from);
      }
      return query;
    }) as PageQueryFactory;
    make.pagination = "created_at-id";
    return make;
  };

  type StripeEventRow = {
    owner_token: string | null;
    metadata: Record<string, unknown> | null;
  };
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
  type UnmeiPurchaseEventRow = StripeEventRow & {
    event_name: "unmei_purchase_complete" | "unmei_upgrade_complete";
    owner_token: string | null;
    created_at: string;
  };

  // サーバ発行イベント (checkout/purchase) は webhook 再送等での重複挿入があり得るため、
  // 件数ではなく stripe_session_id のユニーク数で数える (二重計上の恒久対策)。
  const isTestStripeSession = (sid: string) => sid.startsWith("cs_test_");
  const isLiveStripeRow = (row: StripeEventRow): boolean => {
    const sid = row.metadata?.stripe_session_id;
    return typeof sid === "string" && !!sid && !isTestStripeSession(sid);
  };
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
    const counts: Array<readonly [number, number]> = [];
    // 50 本を一度に投げると、アクセス集中時に同じ events テーブルの count が
    // Supabase の statement_timeout を使い切る。少数ずつ実行してDB負荷を平準化する。
    for (let start = 0; start < TOTAL_QUESTIONS; start += QUESTION_COUNT_CONCURRENCY) {
      const batch = await Promise.all(
        Array.from(
          {
            length: Math.min(
              QUESTION_COUNT_CONCURRENCY,
              TOTAL_QUESTIONS - start,
            ),
          },
          async (_, offset): Promise<readonly [number, number] | null> => {
            const index = start + offset;
            const { count, error } = await withDbQuerySlot(() =>
              applyRange(
                supabaseAdmin
                  .from("events")
                  .select("id", { count: "exact", head: true })
                  .eq("event_name", "diagnosis_question_answered")
                  .eq("metadata->>questionId", String(index + 1)),
              ),
            );
            if (error) {
              // 設問到達は補助チャート。count の statement timeout で管理画面全体を
              // 500 にしない (2026-08-10 の全損障害。旧実装は失敗を握りつぶしていた)。
              // 失敗した設問は「データ無し」としてチャートから欠けるだけに留める。
              console.error(
                `[admin-stats] question reach ${index + 1} failed (skipping): ${error.code ?? "unknown"} ${error.message}`,
              );
              return null;
            }
            return [index, count ?? 0] as const;
          },
        ),
      );
      const succeeded = batch.filter(
        (b): b is readonly [number, number] => b !== null,
      );
      counts.push(...succeeded);
      // タイムアウトが出始めたら残りの設問も同じ待ち時間を踏む可能性が高いので
      // 打ち切る (idx_events_question_reach 未作成時に全体で数分待たせない)。
      if (succeeded.length < batch.length) break;
    }
    const reach: Record<number, number> = {};
    // チャートは 0 始まり index を参照する (questionId は 1 始まり)
    for (const [idx, c] of counts) if (c > 0) reach[idx] = c;
    return reach;
  };

  type SessionRow = { session_id: string | null };
  type EventMetaSessionRow = SessionRow & {
    metadata: Record<string, unknown> | null;
  };
  type PaywallEventRow = EventMetaSessionRow & {
    owner_token: string | null;
  };

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
    paywallPlanViewedRows,
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
    unmeiLpRows,
    unmeiPurchaseStartRows,
    unmeiReadingRows,
    unmeiPurchaseEventRows,
    birthFormViewRows,
    birthFormSubmitRows,
    birthFormSkipRows,
    unmeiBadgeShownRows,
    unmeiBadgeClickedRows,
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
    // metadata.page/variant で自己診断ページ発と /tako 発を分けるため metadata も取る。
    fetchAll<PaywallEventRow>(
      evRows(["paywall_viewed"], "session_id, owner_token, metadata"),
    ),
    fetchAll<PaywallEventRow>(
      evRows(["paywall_plan_viewed"], "session_id, owner_token, metadata"),
    ),
    fetchAll<PaywallEventRow>(
      evRows(["paywall_scroll_clicked"], "session_id, owner_token, metadata"),
    ),
    fetchAll<PaywallEventRow>(
      evRows(["purchase_cta_clicked"], "session_id, owner_token, metadata"),
    ),
    // ----- テーブル (期間は created_at) -----
    fetchAll<{
      id: string;
      scores: Record<string, unknown> | null;
      campaign: string | null;
      generation: number | null;
      source_user_id: string | null;
      acquisition_source: string | null;
      acquisition_campaign: string | null;
    }>(() =>
      applyRange(
        supabaseAdmin
          .from("users")
          .select(
            "id, scores, campaign, generation, source_user_id, acquisition_source, acquisition_campaign",
          )
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
    withDbQuerySlot(() =>
      applyRange(
        supabaseAdmin
          .from("events")
          .select("event_name, session_id, created_at, metadata")
          .order("created_at", { ascending: false })
          .limit(50),
      ),
    ),
    questionReachCounts(),
    fetchAll<StripeEventRow>(
      evRows(["checkout_session_created"], "owner_token, metadata"),
    ),
    fetchAll<StripeEventRow>(
      evRows(["purchase_completed"], "owner_token, metadata"),
    ),
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
          "tako_invite_ui_shown",
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
          // 全 payment_kind を取得する (2026-07-22: 課金分析強化)。
          // full_access 以外 (tako_unlock 等) も総売上・商品別内訳に含める。
          // コホートKPI (ARPU/課金転換) は従来どおり full_access のみで計算する。
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
    fetchAll<{
      session_id: string | null;
      owner_token: string | null;
      metadata: Record<string, unknown> | null;
    }>(evRows(["unmei_lp_view"], "session_id, owner_token, metadata")),
    fetchAll<{
      session_id: string | null;
      owner_token: string | null;
      metadata: Record<string, unknown> | null;
    }>(evRows(["unmei_purchase_start"], "session_id, owner_token, metadata")),
    fetchAll<{
      session_id: string | null;
      owner_token: string | null;
      metadata: Record<string, unknown> | null;
    }>(evRows(["unmei_reading_view"], "session_id, owner_token, metadata")),
    // unmei 購入イベントは期間フィルタを掛けず全期間で取得する。webhook 再送で同一決済の
    // 行が日をまたいで複数入るため、期間で切ると再送行が「期間内の初回」に化けて
    // 決済日が Stripe とズレる (2026-08-09 に「今日の売上」がズレた原因)。
    // 期間判定は重複排除後の最初の行 (=実決済時刻) で行う。
    fetchAll<UnmeiPurchaseEventRow>(() =>
      supabaseAdmin
        .from("events")
        .select("event_name, owner_token, metadata, created_at")
        .in("event_name", [
          "unmei_purchase_complete",
          "unmei_upgrade_complete",
        ])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ),
    fetchAll<EventMetaSessionRow>(
      evRows(["birth_form_view"], "session_id, metadata"),
    ),
    fetchAll<EventMetaSessionRow>(
      evRows(["birth_form_submit"], "session_id, metadata"),
    ),
    fetchAll<EventMetaSessionRow>(
      evRows(["birth_form_skip"], "session_id, metadata"),
    ),
    fetchAll<SessionRow>(evRows(["unmei_nav_badge_shown"])),
    fetchAll<SessionRow>(evRows(["unmei_nav_badge_clicked"])),
  ]);

  const toUnique = (rows: SessionRow[]) =>
    new Set(rows.map((e) => e.session_id).filter(Boolean)).size;
  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  // 課金カードは owner_token が取れる場合は本人単位、取れない場合だけセッション単位。
  // 同じ本人がページ再訪・別タブ表示しても分母を水増ししない。
  const toUniquePaywallAudience = (rows: PaywallEventRow[]): number => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (row.owner_token) keys.add(`owner:${row.owner_token}`);
      else if (row.session_id) keys.add(`session:${row.session_id}`);
    }
    return keys.size;
  };

  const countUniquePurchasers = (rows: StripeEventRow[]): number => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (!isLiveStripeRow(row)) continue;
      const userId = row.metadata?.user_id;
      const stripeSessionId = row.metadata?.stripe_session_id;
      if (row.owner_token) keys.add(`owner:${row.owner_token}`);
      else if (typeof userId === "string" && userId) keys.add(`user:${userId}`);
      else if (typeof stripeSessionId === "string") {
        keys.add(`stripe:${stripeSessionId}`);
      }
    }
    return keys.size;
  };

  const sumUniqueJpyPurchases = (rows: StripeEventRow[]): number => {
    const seen = new Set<string>();
    let total = 0;
    for (const row of rows) {
      if (!isLiveStripeRow(row)) continue;
      const sid = row.metadata?.stripe_session_id;
      if (typeof sid !== "string" || seen.has(sid)) continue;
      seen.add(sid);
      const currency = row.metadata?.currency;
      const amount = row.metadata?.amount_total;
      if (
        (currency === "jpy" || currency === "JPY") &&
        typeof amount === "number" &&
        Number.isFinite(amount)
      ) {
        total += amount;
      }
    }
    return total;
  };

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

  // 招待の解剖 (2026-08-04 計測開始): 送信UI露出 (surface別) と招待クリックの
  // channel/source 別内訳。招待未実行を「UIまで到達していない」/「見たのに送らない」に分解する。
  const inviteUiOwners = new Set<string>();
  const inviteUiSurfaceOwners = new Map<string, Set<string>>();
  const inviteClickOwners = new Set<string>();
  let inviteClickActions = 0;
  const inviteChannelStats = new Map<
    string,
    { actions: number; owners: Set<string> }
  >();
  const inviteSourceStats = new Map<
    string,
    { actions: number; owners: Set<string> }
  >();
  const metaString = (row: JourneyRow, key: string): string => {
    const v = row.metadata?.[key];
    return typeof v === "string" && v.length > 0 ? v : "unknown";
  };
  const bumpBreakdown = (
    map: Map<string, { actions: number; owners: Set<string> }>,
    key: string,
    owner: string,
  ) => {
    const cur = map.get(key) ?? { actions: 0, owners: new Set<string>() };
    cur.actions += 1;
    cur.owners.add(owner);
    map.set(key, cur);
  };

  for (const row of friendJourneyRows) {
    const owner = ownerForJourney(row);
    if (!owner) continue;

    // BottomNav と ResultViewTracker の effect 順により、バッジ表示が result_viewed より
    // 数ミリ秒先になる場合がある。コホート本人であれば表示・クリックはそのまま採用する。
    if (row.event_name === "tako_nav_badge_shown") badgeShownOwners.add(owner);
    if (row.event_name === "tako_nav_badge_clicked") badgeClickedOwners.add(owner);
    if (!happenedAfterCohortStart(row, owner)) continue;

    if (row.event_name === "tako_viewed") takoReachedOwners.add(owner);
    if (row.event_name === "tako_invite_ui_shown") {
      inviteUiOwners.add(owner);
      const surface = metaString(row, "surface");
      const set = inviteUiSurfaceOwners.get(surface) ?? new Set<string>();
      set.add(owner);
      inviteUiSurfaceOwners.set(surface, set);
    }
    if (
      row.event_name === "friend_invite_clicked" ||
      row.event_name === "friend_share_clicked" ||
      row.event_name === "friend_link_copied"
    ) {
      inviteActionOwners.add(owner);
    }
    if (row.event_name === "friend_invite_clicked") {
      inviteClickOwners.add(owner);
      inviteClickActions += 1;
      bumpBreakdown(inviteChannelStats, metaString(row, "channel"), owner);
      bumpBreakdown(inviteSourceStats, metaString(row, "source"), owner);
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

  // --- 流入元別 (Day 12-C3 の first-touch utm_source/ref → users.acquisition_source) ---
  // users 行は診断保存時に作られるため、この数字は「流入元別の診断完了者」。
  // acquisition_source が NULL の行は直接流入・SNSアプリ内ブラウザのクエリ欠落・
  // 計測開始前ユーザーのいずれかで、区別できないため1グループにまとめる。
  const ACQ_DIRECT_LABEL = "(直接/不明)";
  const acqSourceMap = new Map<string, number>();
  const acqCampaignMap = new Map<string, { source: string; campaign: string; users: number }>();
  for (const row of users) {
    const source = row.acquisition_source ?? ACQ_DIRECT_LABEL;
    acqSourceMap.set(source, (acqSourceMap.get(source) ?? 0) + 1);
    if (row.acquisition_source && row.acquisition_campaign) {
      const key = `${row.acquisition_source}${row.acquisition_campaign}`;
      const entry = acqCampaignMap.get(key) ?? {
        source: row.acquisition_source,
        campaign: row.acquisition_campaign,
        users: 0,
      };
      entry.users++;
      acqCampaignMap.set(key, entry);
    }
  }
  const acquisitionStats = {
    directLabel: ACQ_DIRECT_LABEL,
    sources: Array.from(acqSourceMap.entries())
      .map(([source, count]) => ({
        source,
        users: count,
        share: users.length > 0 ? count / users.length : 0,
      }))
      .sort((a, b) =>
        // 計測できた流入元を上に、(直接/不明) は人数に関わらず最後に置く
        a.source === ACQ_DIRECT_LABEL
          ? 1
          : b.source === ACQ_DIRECT_LABEL
            ? -1
            : b.users - a.users,
      ),
    campaigns: Array.from(acqCampaignMap.values()).sort(
      (a, b) => b.users - a.users,
    ),
  };

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

  // ===== 現在ユーザーに表示している課金カード =====
  // feature flag と同じモードを正本にし、カード表示・CTA・Stripe・決済を
  // paywall_version で一貫して接続する。開発プレビューとStripeテストは除外する。
  const activePaywallVersion =
    paywallCardMode() === "three-course"
      ? THREE_COURSE_PAYWALL_VERSION
      : "legacy";
  const isActivePaywallMeta = (
    metadata: Record<string, unknown> | null,
  ): boolean => metadata?.paywall_version === activePaywallVersion;
  const isMainResultPageMeta = (
    metadata: Record<string, unknown> | null,
  ): boolean => metadata?.page === "me" || metadata?.page === "tako";
  const isMainResultReturnMeta = (
    metadata: Record<string, unknown> | null,
  ): boolean =>
    metadata?.return_to === "me" || metadata?.return_to === "tako";
  const productFromMeta = (
    metadata: Record<string, unknown> | null,
  ): AccessProduct | null => {
    const product = metadata?.product;
    return typeof product === "string" &&
      (ACCESS_PRODUCTS as readonly string[]).includes(product)
      ? (product as AccessProduct)
      : null;
  };
  const isUpgradeMeta = (metadata: Record<string, unknown> | null): boolean => {
    const upgradeFrom = metadata?.upgrade_from;
    return typeof upgradeFrom === "string" && upgradeFrom !== "none";
  };

  const courseCardViewRows = paywallViewedRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isMainResultPageMeta(row.metadata),
  );
  const coursePlanViewRows = paywallPlanViewedRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isMainResultPageMeta(row.metadata),
  );
  const courseScrollRows = paywallScrollRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isMainResultPageMeta(row.metadata),
  );
  // 解除導線はカードが表示される前に押す入口なので、カードのversionでは絞らない。
  // 旧実装が表示モードを見ず3コース版として記録した期間も、実際の入口人数は復元できる。
  const mainResultScrollRows = paywallScrollRows.filter((row) =>
    isMainResultPageMeta(row.metadata),
  );
  const courseCtaRows = purchaseCtaRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isMainResultPageMeta(row.metadata),
  );
  const courseCheckoutRows = checkoutCreatedRows.filter(
    (row) =>
      isActivePaywallMeta(row.metadata) &&
      isMainResultReturnMeta(row.metadata) &&
      isLiveStripeRow(row),
  );
  const coursePurchaseRows = purchaseCompletedRows.filter(
    (row) =>
      isActivePaywallMeta(row.metadata) &&
      isMainResultReturnMeta(row.metadata) &&
      isLiveStripeRow(row),
  );

  const courseCardViewers = toUniquePaywallAudience(courseCardViewRows);
  const coursePlanViewers = toUniquePaywallAudience(coursePlanViewRows);
  const mainResultScrollClickers = toUniquePaywallAudience(
    mainResultScrollRows,
  );
  const courseCtaClickers = toUniquePaywallAudience(courseCtaRows);
  const courseStripeReached = countUniqueStripeSessions(courseCheckoutRows);
  const coursePurchasers = countUniquePurchasers(coursePurchaseRows);
  const courseTransactions = countUniqueStripeSessions(coursePurchaseRows);
  const courseNewPurchases = countUniqueStripeSessions(
    coursePurchaseRows.filter((row) => !isUpgradeMeta(row.metadata)),
  );
  const courseUpgrades = countUniqueStripeSessions(
    coursePurchaseRows.filter((row) => isUpgradeMeta(row.metadata)),
  );
  const courseRevenueJpy = sumUniqueJpyPurchases(coursePurchaseRows);

  const eligibleResultSessionIds = new Set<string>();
  for (const row of viewedSessionRows) {
    if (row.session_id) eligibleResultSessionIds.add(row.session_id);
  }
  for (const row of friendJourneyRows) {
    if (
      row.event_name === "tako_viewed" &&
      row.session_id &&
      inRange(row.created_at)
    ) {
      eligibleResultSessionIds.add(row.session_id);
    }
  }

  const coursePlans = ACCESS_PRODUCTS.map((product) => {
    const planViews = coursePlanViewRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const ctaClicks = courseCtaRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const checkouts = courseCheckoutRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const purchases = coursePurchaseRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const viewers = toUniquePaywallAudience(planViews);
    const ctaClickers = toUniquePaywallAudience(ctaClicks);
    const stripeReached = countUniqueStripeSessions(checkouts);
    const purchasers = countUniquePurchasers(purchases);
    const transactions = countUniqueStripeSessions(purchases);
    const newPurchases = countUniqueStripeSessions(
      purchases.filter((row) => !isUpgradeMeta(row.metadata)),
    );
    const upgrades = countUniqueStripeSessions(
      purchases.filter((row) => isUpgradeMeta(row.metadata)),
    );
    const revenueJpy = sumUniqueJpyPurchases(purchases);
    return {
      product,
      viewers,
      ctaClickers,
      stripeReached,
      purchasers,
      transactions,
      newPurchases,
      upgrades,
      revenueJpy,
      ctaRate: rate(ctaClickers, viewers),
      stripeRate: rate(stripeReached, ctaClickers),
      checkoutCompletionRate: rate(transactions, stripeReached),
      purchaseRate: rate(purchasers, viewers),
    };
  });

  // ===== 商品別課金ファネル =====
  //   自己診断ページは ¥199 self_report。友達診断・相性・韓国版は
  //   従来の full_access を維持する。¥199テストの転換率に¥499決済を混ぜないため、
  //   新イベントは metadata.product で厳密に分ける。
  // 判定:
  //   - paywall_viewed: metadata.page==='tako' (新カード) または variant==='tako' (旧カード互換)。
  //   - scroll/cta: metadata.page==='tako' または metadata.source が tako 系。
  //   - checkout/purchase: metadata.return_to==='tako' または metadata.source が tako 系。
  const isTakoMeta = (m: Record<string, unknown> | null): boolean =>
    m?.product === "tako_unlock" ||
    m?.page === "tako" ||
    m?.return_to === "tako" ||
    (typeof m?.source === "string" && TAKO_PAYWALL_SOURCES.has(m.source));
  const isTakoView = (m: Record<string, unknown> | null): boolean =>
    m?.page === "tako" || m?.variant === "tako";
  const isUnmeiMeta = (m: Record<string, unknown> | null): boolean =>
    m?.product === "unmei" ||
    m?.product === "unmei_upgrade" ||
    m?.page === "unmei" ||
    m?.return_to === "unmei" ||
    m?.source === "unmei_page";
  const isSelfReportMeta = (m: Record<string, unknown> | null): boolean =>
    m?.product === "self_report";

  const paywallViewedTakoRows = paywallViewedRows.filter((r) =>
    isTakoView(r.metadata),
  );
  const scrollFullRows = paywallScrollRows.filter(
    (r) => isSelfReportMeta(r.metadata),
  );
  const scrollTakoRows = paywallScrollRows.filter((r) => isTakoMeta(r.metadata));
  const ctaFullRows = purchaseCtaRows.filter(
    (r) => isSelfReportMeta(r.metadata),
  );
  const ctaTakoRows = purchaseCtaRows.filter((r) => isTakoMeta(r.metadata));
  const checkoutFullRows = checkoutCreatedRows.filter(
    (r) => isSelfReportMeta(r.metadata),
  );
  const checkoutTakoRows = checkoutCreatedRows.filter((r) =>
    isTakoMeta(r.metadata),
  );
  // ¥199決済完了は self_report だけを集計する。
  const purchaseFullRows = purchaseCompletedRows.filter(
    (r) => isSelfReportMeta(r.metadata),
  );
  const purchaseTakoRows = purchaseCompletedRows.filter((r) =>
    isTakoMeta(r.metadata),
  );

  // 友達診断ページ発のファネル数値 (決済完了は tako 系 source の full_access 決済)。
  const takoPaywallViewed = toUnique(paywallViewedTakoRows);
  const takoScrollClicked = toUnique(scrollTakoRows);
  const takoCtaClicked = toUnique(ctaTakoRows);
  const takoCheckoutCreated = countUniqueStripeSessions(checkoutTakoRows);
  // /tako ページ表示 (friendJourneyRows の tako_viewed・ユニークセッション)
  const takoPageViewed = new Set(
    friendJourneyRows
      .filter((r) => r.event_name === "tako_viewed")
      .map((r) => r.session_id)
      .filter(Boolean),
  ).size;

  // 運命の設計図 (/unmei) ファネル。購入開始は専用イベントに加え、
  // リリース済みの purchase_cta_clicked(page=unmei) も併合する。
  const unmeiCtaRows = purchaseCtaRows.filter((r) => isUnmeiMeta(r.metadata));
  const unmeiPurchaseIntentRows = [...unmeiPurchaseStartRows, ...unmeiCtaRows];
  const unmeiCheckoutRows = checkoutCreatedRows.filter((r) =>
    isUnmeiMeta(r.metadata),
  );
  // webhook 再送の重複行を除去し、決済ごとに最初の行 (=実決済時刻) だけ残す。
  // 行は created_at 昇順で取得済み。ファネル・売上とも期間判定はこの実決済時刻で行い、
  // Stripe ダッシュボードの計上日と一致させる。
  const seenUnmeiSessionIds = new Set<string>();
  const unmeiPurchaseFacts = unmeiPurchaseEventRows.filter((r) => {
    const sid = r.metadata?.stripe_session_id;
    if (typeof sid !== "string" || !sid) return true; // 旧形式 (id 無し) は個別に残す
    if (seenUnmeiSessionIds.has(sid)) return false;
    seenUnmeiSessionIds.add(sid);
    return true;
  });
  const unmeiPurchaseRowsInRange = unmeiPurchaseFacts.filter((r) =>
    inRange(r.created_at),
  );
  const unmeiBasePurchaseRows = unmeiPurchaseRowsInRange.filter(
    (r) => r.event_name === "unmei_purchase_complete",
  );
  const unmeiUpgradePurchaseRows = unmeiPurchaseRowsInRange.filter(
    (r) => r.event_name === "unmei_upgrade_complete",
  );
  const unmeiLpViewed = toUnique(unmeiLpRows);
  const unmeiPurchaseStarted = toUnique(unmeiPurchaseIntentRows);
  const unmeiCheckoutCreated = countUniqueStripeSessions(unmeiCheckoutRows);
  const unmeiPurchases = countUniqueStripeSessions(unmeiPurchaseRowsInRange);
  const unmeiBasePurchases = countUniqueStripeSessions(unmeiBasePurchaseRows);
  const unmeiUpgradePurchases = countUniqueStripeSessions(
    unmeiUpgradePurchaseRows,
  );
  const unmeiReadingViewed = toUnique(unmeiReadingRows);
  const birthFormViewed = toUnique(
    birthFormViewRows.filter((r) => isUnmeiMeta(r.metadata)),
  );
  const birthFormSubmitted = toUnique(
    birthFormSubmitRows.filter((r) => isUnmeiMeta(r.metadata)),
  );
  const birthFormSkipped = toUnique(
    birthFormSkipRows.filter((r) => isUnmeiMeta(r.metadata)),
  );
  const unmeiBadgeShown = toUnique(unmeiBadgeShownRows);
  const unmeiBadgeClicked = toUnique(unmeiBadgeClickedRows);

  // 運命の設計図: チャット決済フロー専用ファネル (ui/payment_method で抽出・旧リダイレクト版と分離)。
  // 段階順はチャット実態 (LP→作成CTA→出生入力→保存→決済フォーム→完了)。
  // ⑤決済フォーム到達は checkout_session_created(payment_method=card_embedded)=埋め込みフォーム生成で代替。
  const unmeiChatLaunched = toUnique(
    purchaseCtaRows.filter((r) => r.metadata?.ui === "chat_launch"),
  );
  const unmeiChatBirthViewed = toUnique(
    birthFormViewRows.filter((r) => r.metadata?.ui === "chat_purchase"),
  );
  const unmeiChatBirthSubmitted = toUnique(
    birthFormSubmitRows.filter((r) => r.metadata?.ui === "chat_purchase"),
  );
  const unmeiChatCheckoutRows = unmeiCheckoutRows.filter(
    (r) => r.metadata?.payment_method === "card_embedded",
  );
  const unmeiChatCheckoutReached = countUniqueStripeSessions(
    unmeiChatCheckoutRows,
  );
  // チャット決済で作られた Stripe セッション (card_embedded=埋め込み / paypay=PayPay直行) の
  // stripe_session_id を集め、その ID で完了した購入のみをチャット発の決済完了として数える。
  const unmeiChatCheckoutSessionIds = new Set<string>();
  for (const r of unmeiCheckoutRows) {
    const pm = r.metadata?.payment_method;
    if (pm !== "card_embedded" && pm !== "paypay") continue;
    const sid = r.metadata?.stripe_session_id;
    if (typeof sid === "string") unmeiChatCheckoutSessionIds.add(sid);
  }
  const unmeiChatPurchaseRows = unmeiPurchaseRowsInRange.filter((r) => {
    const sid = r.metadata?.stripe_session_id;
    return typeof sid === "string" && unmeiChatCheckoutSessionIds.has(sid);
  });
  const unmeiChatPurchases = countUniqueStripeSessions(unmeiChatPurchaseRows);

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

  const buildAttribution = (
    scrollRows: AttributionRow[],
    ctaRows: AttributionRow[],
    checkoutRows: AttributionRow[],
    purchaseRows: AttributionRow[],
  ) => {
    const scrollBySource = uniqueCountsBySource(scrollRows, "session_id");
    const purchaseCtaBySource = uniqueCountsBySource(ctaRows, "session_id");
    const checkoutBySource = uniqueCountsBySource(
      checkoutRows,
      "stripe_session_id",
    );
    const purchaseBySource = uniqueCountsBySource(
      purchaseRows,
      "stripe_session_id",
    );
    const attributionSources = new Set([
      ...scrollBySource.keys(),
      ...purchaseCtaBySource.keys(),
      ...checkoutBySource.keys(),
      ...purchaseBySource.keys(),
    ]);
    return Array.from(attributionSources).map((source) => {
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
    });
  };
  const paywallAttribution = buildAttribution(
    scrollFullRows,
    ctaFullRows,
    checkoutFullRows,
    purchaseFullRows,
  ).sort(
    (a, b) =>
      b.purchases - a.purchases ||
      b.stripeReached - a.stripeReached ||
      b.scrollClicks - a.scrollClicks,
  );
  const takoAttribution = buildAttribution(
    scrollTakoRows,
    ctaTakoRows,
    checkoutTakoRows,
    purchaseTakoRows,
  ).sort(
    (a, b) =>
      b.purchases - a.purchases ||
      b.stripeReached - a.stripeReached ||
      b.scrollClicks - a.scrollClicks,
  );
  const courseAttribution = buildAttribution(
    courseScrollRows,
    courseCtaRows,
    courseCheckoutRows,
    coursePurchaseRows,
  ).sort(
    (a, b) =>
      b.purchases - a.purchases ||
      b.stripeReached - a.stripeReached ||
      b.scrollClicks - a.scrollClicks,
  );

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

  // kind 付きの全商品決済ファクト。総売上・商品別内訳・日別推移の源泉。
  // コホートKPI (computeCoreKpis) へは full_access のみを渡す (従来と同義)。
  // ローカル開発が本番 Supabase + テスト Stripe の構成で動くため、テストモード決済
  // (cs_test_) が本番 DB に混入している (2026-08-09 実測: 計¥8,860)。Stripe の
  // ライブ売上には存在しないため、売上ファクトから除外する。
  const verifiedPaymentFacts: (CoreKpiPaymentFact & { kind: string })[] = [];
  const knownStripeSessions = new Set<string>();
  for (const row of paymentHistoryRows) {
    const paidAt = row.paid_at ?? row.created_at;
    knownStripeSessions.add(row.stripe_session_id);
    if (isTestStripeSession(row.stripe_session_id)) continue;
    verifiedPaymentFacts.push({
      stripeSessionId: row.stripe_session_id,
      userId: row.user_id,
      paidAt,
      currency: row.currency,
      amountMinor: row.amount_jpy,
      refundedAmountMinor: row.amount_refunded_minor ?? 0,
      kind: row.payment_kind ?? "unknown",
    });
  }

  let unmatchedPaymentCount = 0;
  for (const row of unmeiPurchaseFacts) {
    const rawStripeSessionId = row.metadata?.stripe_session_id;
    const stripeSessionId =
      typeof rawStripeSessionId === "string" && rawStripeSessionId
        ? rawStripeSessionId
        : `legacy-unmei:${row.event_name}:${row.created_at}`;
    if (knownStripeSessions.has(stripeSessionId)) continue;
    if (isTestStripeSession(stripeSessionId)) continue;

    const amount = row.metadata?.amount_total;
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
      continue;
    }

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
          (ownerToken ? ownerTokenToUserId.get(ownerToken) : null) ??
          `stripe:${stripeSessionId}`;
    const rawCurrency = row.metadata?.currency;
    const rawProduct = row.metadata?.product;
    const kind =
      rawProduct === "unmei" || rawProduct === "unmei_upgrade"
        ? rawProduct
        : row.event_name === "unmei_upgrade_complete"
          ? "unmei_upgrade"
          : "unmei";

    verifiedPaymentFacts.push({
      stripeSessionId,
      userId,
      paidAt: row.created_at,
      currency:
        typeof rawCurrency === "string" && rawCurrency ? rawCurrency : "jpy",
      amountMinor: amount,
      refundedAmountMinor: 0,
      kind,
    });
  }

  for (const row of kpiPaymentEventRows) {
    if (row.event_name !== "purchase_completed") continue;
    const stripeSessionId = row.metadata?.stripe_session_id;
    if (typeof stripeSessionId !== "string" || !stripeSessionId) {
      unmatchedPaymentCount++;
      continue;
    }
    if (knownStripeSessions.has(stripeSessionId)) continue;
    knownStripeSessions.add(stripeSessionId);
    if (isTestStripeSession(stripeSessionId)) continue;

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
    const rawProduct = row.metadata?.product;
    verifiedPaymentFacts.push({
      stripeSessionId,
      userId,
      paidAt: row.created_at,
      currency,
      amountMinor: amount,
      refundedAmountMinor: 0,
      kind:
        typeof rawProduct === "string" && rawProduct
          ? rawProduct
          : "full_access",
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
  // 通貨をまたいだユニーク購入者数。バケット別 payers を合算すると
  // JPY と KRW の両方で購入した同一ユーザーを二重計上するため、別途 dedup する。
  const periodPayerIds = new Set<string>();
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
    periodPayerIds.add(payment.userId);
    periodRevenueBuckets.set(currency, bucket);
  }

  const periodRevenue = {
    basis: "選択期間中に支払いが確定した全商品の純売上 (返金控除後)",
    uniquePayers: periodPayerIds.size,
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

  const unmeiRevenueBuckets = new Map<
    string,
    {
      purchases: number;
      netRevenueMinor: number;
    }
  >();
  for (const payment of verifiedPaymentFacts) {
    if (
      !inRange(payment.paidAt) ||
      (payment.kind !== "unmei" && payment.kind !== "unmei_upgrade")
    ) {
      continue;
    }
    const currency = payment.currency.toLowerCase();
    const bucket = unmeiRevenueBuckets.get(currency) ?? {
      purchases: 0,
      netRevenueMinor: 0,
    };
    const refundedMinor = Math.min(
      Math.max(payment.refundedAmountMinor, 0),
      payment.amountMinor,
    );
    bucket.purchases++;
    bucket.netRevenueMinor += payment.amountMinor - refundedMinor;
    unmeiRevenueBuckets.set(currency, bucket);
  }
  const unmeiRevenue = {
    currencies: Array.from(unmeiRevenueBuckets.entries())
      .map(([currency, bucket]) => ({
        currency,
        purchases: bucket.purchases,
        netRevenueMinor: bucket.netRevenueMinor,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };

  // ===== 商品別の売上内訳 (選択期間・kind × 通貨) =====
  const kindBuckets = new Map<
    string,
    {
      kind: string;
      currency: string;
      purchases: number;
      grossRevenueMinor: number;
      refundedMinor: number;
      netRevenueMinor: number;
    }
  >();
  for (const payment of verifiedPaymentFacts) {
    if (!inRange(payment.paidAt)) continue;
    const currency = payment.currency.toLowerCase();
    const key = `${payment.kind}|${currency}`;
    const bucket = kindBuckets.get(key) ?? {
      kind: payment.kind,
      currency,
      purchases: 0,
      grossRevenueMinor: 0,
      refundedMinor: 0,
      netRevenueMinor: 0,
    };
    const refundedMinor = Math.min(
      Math.max(payment.refundedAmountMinor, 0),
      payment.amountMinor,
    );
    bucket.purchases++;
    bucket.grossRevenueMinor += payment.amountMinor;
    bucket.refundedMinor += refundedMinor;
    bucket.netRevenueMinor += payment.amountMinor - refundedMinor;
    kindBuckets.set(key, bucket);
  }
  const revenueByKind = Array.from(kindBuckets.values()).sort(
    (a, b) =>
      b.netRevenueMinor - a.netRevenueMinor || b.purchases - a.purchases,
  );

  // ===== 日別の売上推移 (選択期間・JST の日付単位・全商品) =====
  // 期間未指定 (全期間) でも直近が見えるよう、末尾 62 日分に丸めて返す。
  const dailyBuckets = new Map<
    string,
    {
      date: string;
      purchases: number;
      currencies: Map<string, { netRevenueMinor: number; refundedMinor: number }>;
    }
  >();
  for (const payment of verifiedPaymentFacts) {
    if (!inRange(payment.paidAt)) continue;
    const d = new Date(payment.paidAt);
    if (Number.isNaN(d.getTime())) continue;
    // サーバ TZ に依存しないよう JST (+9h) に固定してから日付を切り出す。
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const date = jst.toISOString().slice(0, 10);
    const bucket = dailyBuckets.get(date) ?? {
      date,
      purchases: 0,
      currencies: new Map(),
    };
    const currency = payment.currency.toLowerCase();
    const refundedMinor = Math.min(
      Math.max(payment.refundedAmountMinor, 0),
      payment.amountMinor,
    );
    const cur = bucket.currencies.get(currency) ?? {
      netRevenueMinor: 0,
      refundedMinor: 0,
    };
    cur.netRevenueMinor += payment.amountMinor - refundedMinor;
    cur.refundedMinor += refundedMinor;
    bucket.currencies.set(currency, cur);
    bucket.purchases++;
    dailyBuckets.set(date, bucket);
  }
  // 友達診断ページ発の決済完了数 (tako 系 source の full_access 決済・選択期間)。
  const takoPurchases = countUniqueStripeSessions(purchaseTakoRows);

  const revenueDaily = Array.from(dailyBuckets.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 62)
    .map((bucket) => ({
      date: bucket.date,
      purchases: bucket.purchases,
      currencies: Array.from(bucket.currencies.entries())
        .map(([currency, v]) => ({
          currency,
          netRevenueMinor: v.netRevenueMinor,
          refundedMinor: v.refundedMinor,
        }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    }));

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
    // コホートKPI (ARPU/課金転換) は従来定義のまま full_access のみで計算する。
    payments: verifiedPaymentFacts.filter((p) => p.kind === "full_access"),
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
        // 表示率の分母は takoReachRate と同じ「コホートの診断完了セッション数」。
        badgeShowRate: rate(
          badgeShownOwners.size,
          diagnosisCohortSessions.size,
        ),
        badgeClicked: badgeClickedOwners.size,
        badgeClickRate: rate(badgeClickedOwners.size, badgeShownOwners.size),
        takoReached: takoReachedOwners.size,
        takoReachRate: rate(
          takoReachedOwners.size,
          diagnosisCohortSessions.size,
        ),
      },
      // 招待の解剖 (tako_invite_ui_shown は 2026-08-04 計測開始)。
      // clickOwners は friend_invite_clicked のみ (ownerFunnel の招待実行は
      // 友達到達による補完込みなので、ここでは実クリックだけを数える)。
      inviteDetail: {
        uiShownOwners: inviteUiOwners.size,
        uiSurfaces: Array.from(inviteUiSurfaceOwners.entries())
          .map(([surface, owners]) => ({ surface, owners: owners.size }))
          .sort((a, b) => b.owners - a.owners),
        clickOwners: inviteClickOwners.size,
        clickActions: inviteClickActions,
        uiToClickRate: rate(inviteClickOwners.size, inviteUiOwners.size),
        channels: Array.from(inviteChannelStats.entries())
          .map(([channel, v]) => ({
            channel,
            actions: v.actions,
            owners: v.owners.size,
          }))
          .sort((a, b) => b.actions - a.actions),
        sources: Array.from(inviteSourceStats.entries())
          .map(([source, v]) => ({
            source,
            actions: v.actions,
            owners: v.owners.size,
          }))
          .sort((a, b) => b.actions - a.actions),
      },
    },
    // 現在表示中の課金カードの合計ファネル。別バージョン・開発プレビュー・
    // テスト決済は含めない。解除導線クリックはカードへの流入操作なので別指標として保持する。
    paywallFunnel: [
      { label: "結果ページ表示", count: eligibleResultSessionIds.size },
      { label: "課金カード表示", count: courseCardViewers },
      { label: "解除ボタン押下", count: mainResultScrollClickers },
      { label: "購入CTA押下", count: courseCtaClickers },
      { label: "Stripe到達", count: courseStripeReached },
      { label: "決済完了", count: coursePurchasers },
    ],
    coursePaywall: {
      version: activePaywallVersion,
      cardViewers: courseCardViewers,
      planViewers: coursePlanViewers,
      ctaClickers: courseCtaClickers,
      stripeReached: courseStripeReached,
      purchasers: coursePurchasers,
      transactions: courseTransactions,
      newPurchases: courseNewPurchases,
      upgrades: courseUpgrades,
      revenueJpy: courseRevenueJpy,
      revenuePerViewerJpy: rate(courseRevenueJpy, courseCardViewers),
      purchaseRate: rate(coursePurchasers, courseCardViewers),
      plans: coursePlans,
    },
    // 課金ファネル (友達診断ページ発の ¥499 完全版)。Stripe到達は 2026-07-22 に計測追加。
    // 決済完了は tako 系 source / return_to 付きの full_access 決済を数える。
    takoFunnel: [
      { label: "/tako 表示", count: takoPageViewed },
      { label: "課金カード表示", count: takoPaywallViewed },
      { label: "解除ボタン押下", count: takoScrollClicked },
      { label: "購入CTA押下", count: takoCtaClicked },
      { label: "Stripe到達", count: takoCheckoutCreated },
      { label: "決済完了", count: takoPurchases },
    ],
    unmei: {
      funnel: [
        { label: "LP表示", count: unmeiLpViewed },
        { label: "購入開始", count: unmeiPurchaseStarted },
        { label: "Stripe到達", count: unmeiCheckoutCreated },
        { label: "決済完了", count: unmeiPurchases },
        { label: "出生フォーム表示", count: birthFormViewed },
        { label: "出生情報保存", count: birthFormSubmitted },
        { label: "鑑定表示", count: unmeiReadingViewed },
      ],
      // チャット決済フロー (flag ON) の実態ファネル。段階順が旧リダイレクト版と異なる
      // (出生入力が決済の前)。ui=chat_launch/chat_purchase・payment_method=card_embedded で抽出。
      chatFunnel: [
        { label: "LP表示", count: unmeiLpViewed },
        { label: "作成CTA(起動)", count: unmeiChatLaunched },
        { label: "出生情報 入力", count: unmeiChatBirthViewed },
        { label: "出生情報 保存", count: unmeiChatBirthSubmitted },
        { label: "決済フォーム到達", count: unmeiChatCheckoutReached },
        { label: "決済完了", count: unmeiChatPurchases },
      ],
      purchases: {
        total: unmeiPurchases,
        basic: unmeiBasePurchases,
        upgrade: unmeiUpgradePurchases,
      },
      revenue: unmeiRevenue,
      birthForm: {
        viewed: birthFormViewed,
        submitted: birthFormSubmitted,
        skipped: birthFormSkipped,
        submitRate: rate(birthFormSubmitted, birthFormViewed),
      },
      navBadge: {
        shown: unmeiBadgeShown,
        clicked: unmeiBadgeClicked,
        clickRate: rate(unmeiBadgeClicked, unmeiBadgeShown),
      },
    },
    paywallSources,
    paywallAttribution: courseAttribution,
    legacyPaywallAttribution: paywallAttribution,
    takoAttribution,
    purchaseCompleted: coursePurchasers,
    purchaseConversionRate: rate(coursePurchasers, courseCardViewers),
    paidUsers,
    revenueJpy,
    revenueByKind,
    revenueDaily,
    recentEvents: recentRes.data ?? [],
    friendToDiagClicked,
    friendToDiagRate: rate(friendToDiagClicked, friendAnswerCompleted),
    typeDistribution,
    friendCountDistribution,
    diagQuestionReach,
    campaignStats,
    acquisitionStats,
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
