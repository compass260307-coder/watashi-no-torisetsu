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
  THREE_COURSE_PAYWALL_VERSION,
  type AccessProduct,
} from "@/lib/access-products";
import { isMissingHoshiyomiStore } from "@/lib/hoshiyomi/store";

const PAGE = 1000;
// 複数列を返す高頻度イベントは250行でもSupabaseのstatement_timeoutに届く。
// 初回だけ1000行で試し、タイムアウトしたクエリだけ100行へ縮小する。
const RETRY_PAGE = 100;
const TOTAL_QUESTIONS = 50; // 診断の設問数 (10問 × 5ページ)
const QUESTION_COUNT_CONCURRENCY = 2;
// 高頻度イベントを無制限に並行取得するとstatement_timeoutに達する一方、
// 直列では全期間が300秒を超える。2本に制限して安定性と実行時間を両立する。
const DB_QUERY_CONCURRENCY = 2;
// /tako 到達を owner_token + invite_code 付きでページ本体から計測し始める時刻。
// これ以前を分母に混ぜると「到達していたがイベントが無い人」が離脱扱いになるため除外する。
const FRIEND_JOURNEY_EVENTS_STARTED_AT = "2026-07-18T04:15:00.000Z";
// 初回回答の発火点修正を含む、友達診断ファネル v2 の開始。
const FRIEND_FUNNEL_MEASUREMENT_STARTED_AT = "2026-08-22T03:54:21.000Z";
// シェア選択UIの表示漏れと、前段を通らない下流イベントを数えていた
// 問題を修正した自己結果シェアファネル v3 の開始。修正前データは混ぜない。
const SELF_RESULT_SHARE_FUNNEL_MEASUREMENT_STARTED_AT =
  "2026-08-22T12:15:31.000Z";
const SELF_RESULT_SHARE_FUNNEL_VERSION = "share_v3";
const ALICE_FUNNEL_MEASUREMENT_STARTED_AT = "2026-08-18";

export type AdminStatsLocale = "ja" | "ko";

type ComputeStatsOptions = {
  locale?: AdminStatsLocale;
};

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

export async function computeStats(
  from: string | null,
  to: string | null,
  options: ComputeStatsOptions = {},
) {
  const statsLocale = options.locale;

  function applyRange<T>(query: T, column = "created_at"): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = query as any;
    if (from) q = q.gte(column, from);
    if (to) q = q.lte(column, to);
    return q as T;
  }

  function applyLocale<T>(query: T, column = "locale"): T {
    if (!statsLocale) return query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (query as any).eq(column, statsLocale) as T;
  }

  type PageQueryFactory = (() => {
    // Supabase query builders carry table-specific generics.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }) & {
    pagination?: "created_at-id";
    debugLabel?: string;
    rowFilter?: (row: unknown) => boolean;
  };

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
          `[admin-stats] ${make.debugLabel ?? "query"} page timed out; retrying with ${RETRY_PAGE} rows`,
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
          `[admin-stats] fetchAll(${make.debugLabel ?? "query"}): ${error.code ?? "unknown"} ${error.message ?? "query failed"}`,
        );
      }
      if (!data || data.length === 0) break;
      const pageRows = make.rowFilter
        ? (data as T[]).filter((row) => make.rowFilter?.(row) === true)
        : (data as T[]);
      out.push(...pageRows);
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
        "locale",
      ]),
    ).join(", ");
    const make = (() => {
      let query = supabaseAdmin.from("events").select(selectCols);
      query =
        names.length === 1
          ? query.eq("event_name", names[0])
          : query.in("event_name", names);
      return applyRange(
        query
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      );
    }) as PageQueryFactory;
    make.pagination = "created_at-id";
    make.debugLabel = `events:${names.join(",")}`;
    if (statsLocale) {
      make.rowFilter = (row) =>
        (row as { locale?: string }).locale === statsLocale;
    }
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
        "locale",
      ]),
    ).join(", ");
    const make = (() => {
      let query = supabaseAdmin
        .from("events")
        .select(selectCols)
        .in("event_name", names)
        .gte("created_at", FRIEND_JOURNEY_EVENTS_STARTED_AT)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (
        from &&
        Date.parse(from) > Date.parse(FRIEND_JOURNEY_EVENTS_STARTED_AT)
      ) {
        query = query.gte("created_at", from);
      }
      return query;
    }) as PageQueryFactory;
    make.pagination = "created_at-id";
    make.debugLabel = `journey:${names.join(",")}`;
    if (statsLocale) {
      make.rowFilter = (row) =>
        (row as { locale?: string }).locale === statsLocale;
    }
    return make;
  };

  type StripeEventRow = {
    owner_token: string | null;
    metadata: Record<string, unknown> | null;
  };
  type PurchaseDeliveryRow = StripeEventRow & { event_name: string };
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
    metadata: Record<string, unknown> | null;
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

  // 質問到達: DB 内で一度だけ GROUP BY する。migration 未適用のデプロイ順序でも
  // 管理画面を止めないよう、RPC が無い間だけ従来の count クエリへフォールバックする。
  const questionReachCounts = async (): Promise<Record<number, number>> => {
    const { data: aggregateRows, error: aggregateError } =
      await withDbQuerySlot(() =>
        supabaseAdmin.rpc("admin_question_reach", {
          p_from: from,
          p_to: to,
          p_locale: statsLocale ?? null,
        }),
      );
    if (!aggregateError) {
      const reach: Record<number, number> = {};
      for (const row of (aggregateRows ?? []) as Array<{
        question_id: number | string;
        event_count: number | string;
      }>) {
        const questionId = Number(row.question_id);
        const count = Number(row.event_count);
        if (
          Number.isInteger(questionId) &&
          questionId >= 1 &&
          questionId <= TOTAL_QUESTIONS &&
          Number.isFinite(count) &&
          count > 0
        ) {
          reach[questionId - 1] = count;
        }
      }
      return reach;
    }
    console.warn(
      `[admin-stats] question reach aggregate unavailable; using compatibility counts: ${aggregateError.code ?? "unknown"} ${aggregateError.message}`,
    );

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
                applyLocale(
                  supabaseAdmin
                    .from("events")
                    .select("id", { count: "exact", head: true })
                    .eq("event_name", "diagnosis_question_answered")
                    .eq("metadata->>questionId", String(index + 1)),
                ),
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
  type AliceEventRow = EventMetaSessionRow & {
    event_name: string;
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
    rawPerceptions,
    diagQuestionReach,
    checkoutCreatedRows,
    purchaseCompletedRows,
    purchaseDeliveryRows,
    friendJourneyRows,
    identityRows,
    coreUserRows,
    rawPaymentHistoryRows,
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
    aliceEventRows,
    rawAliceConversationRows,
    rawAliceReservationRows,
    rawAliceCreditRows,
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
      acquisition_locale: AdminStatsLocale;
    }>(() =>
      applyRange(
        applyLocale(
          supabaseAdmin
            .from("users")
            .select(
              "id, scores, campaign, generation, source_user_id, acquisition_source, acquisition_campaign, acquisition_locale",
            )
            .order("created_at", { ascending: true })
            .order("id", { ascending: true }),
          "acquisition_locale",
        ),
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
    questionReachCounts(),
    fetchAll<StripeEventRow>(
      evRows(["checkout_session_created"], "owner_token, metadata"),
    ),
    fetchAll<StripeEventRow>(
      evRows(["purchase_completed"], "owner_token, metadata"),
    ),
    fetchAll<PurchaseDeliveryRow>(
      () =>
        applyLocale(
          supabaseAdmin
            .from("events")
            .select("event_name, owner_token, metadata")
            .in("event_name", [
              "meta_purchase_claimed",
              "browser_tiktok_purchase_pushed",
              "server_purchase_conversion_sent",
            ])
            .order("id", { ascending: true }),
      ),
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
          "diagnosis_started",
          "diagnosis_completed",
          "tako_viewed",
          "tako_nav_badge_shown",
          "tako_nav_badge_clicked",
          "tako_invite_ui_shown",
          "friend_invite_clicked",
          "friend_share_clicked",
          "friend_link_copied",
          "friend_landing_viewed",
          "friend_answer_started",
          "friend_answer_completed",
          "friend_v2_completed",
          "friend_to_diagnosis_clicked",
          "friend_v2_self_cta_clicked",
          "share_ui_shown",
          "share_clicked",
          "share_landing_viewed",
          "share_to_diagnosis_clicked",
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
      applyLocale(
        supabaseAdmin
          .from("users")
          .select("id, owner_token, invite_code, source_user_id, created_at")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        "acquisition_locale",
      ),
    ),
    fetchAll<{
      id: string;
      diagnosis_completed_at: string | null;
      full_access_at: string | null;
      source_user_id: string | null;
    }>(
      () =>
        applyLocale(
          supabaseAdmin
            .from("users")
            .select(
              "id, diagnosis_completed_at, full_access_at, source_user_id",
            )
            .order("id", { ascending: true }),
          "acquisition_locale",
        ),
      recordCoreSchemaIssue,
    ),
    fetchAll<PaymentHistoryRow>(
      () =>
        supabaseAdmin
          .from("payment_history")
          .select(
            "user_id, stripe_session_id, amount_jpy, amount_refunded_minor, currency, status, paid_at, created_at, payment_kind, metadata",
          )
          // 全 payment_kind を取得する (2026-07-22: 課金分析強化)。
          // full_access 以外 (tako_unlock 等) も総売上・商品別内訳に含める。
          // コホートKPI (ARPU/課金転換) も同じ全商品ファクトを使う。
          .in("status", ["completed", "refunded"])
          .order("created_at", { ascending: true })
          .order("stripe_session_id", { ascending: true }),
      recordCoreSchemaIssue,
    ),
    fetchAll<KpiPaymentEventRow>(() =>
      applyLocale(
        supabaseAdmin
          .from("events")
          .select("event_name, owner_token, metadata, created_at")
          .in("event_name", ["checkout_session_created", "purchase_completed"])
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
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
      applyLocale(
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
    fetchAll<AliceEventRow>(
      evRows(
        [
          "hoshiyomi_page_viewed",
          "hoshiyomi_paywall_opened",
          "hoshiyomi_message_sent",
          "hoshiyomi_response_completed",
          "hoshiyomi_response_failed",
        ],
        "event_name, session_id, metadata",
      ),
    ),
    fetchAll<{ id: string; user_id: string; created_at: string }>(
      () =>
        applyRange(
          supabaseAdmin
            .from("hoshiyomi_conversations")
            .select("id, user_id, created_at")
            .order("created_at", { ascending: true })
            .order("id", { ascending: true }),
        ),
      (error) => isMissingHoshiyomiStore(error),
    ),
    fetchAll<{
      id: string;
      user_id: string;
      status: "reserved" | "committed" | "released";
      created_at: string;
    }>(
      () =>
        applyRange(
          supabaseAdmin
            .from("hoshiyomi_credit_reservations")
            .select("id, user_id, status, created_at")
            .order("created_at", { ascending: true })
            .order("id", { ascending: true }),
        ),
      (error) => isMissingHoshiyomiStore(error),
    ),
    fetchAll<{
      user_id: string;
      credits_total: number;
      credits_remaining: number;
    }>(
      () =>
        supabaseAdmin
          .from("hoshiyomi_credit_balances")
          .select("user_id, credits_total, credits_remaining")
          .order("user_id", { ascending: true }),
      (error) => isMissingHoshiyomiStore(error),
    ),
  ]);

  // friend_perceptions と payment_history はロケール列を持たないため、
  // acquisition_locale で絞った users を正本にして関連行だけを残す。
  const localeUserIds = new Set(identityRows.map((row) => row.id));
  const perceptions = statsLocale
    ? rawPerceptions.filter((row) => localeUserIds.has(row.target_user_id))
    : rawPerceptions;
  const paymentHistoryRows = statsLocale
    ? rawPaymentHistoryRows.filter((row) => localeUserIds.has(row.user_id))
    : rawPaymentHistoryRows;
  const aliceConversationRows = statsLocale
    ? rawAliceConversationRows.filter((row) => localeUserIds.has(row.user_id))
    : rawAliceConversationRows;
  const aliceReservationRows = statsLocale
    ? rawAliceReservationRows.filter((row) => localeUserIds.has(row.user_id))
    : rawAliceReservationRows;
  const aliceCreditRows = statsLocale
    ? rawAliceCreditRows.filter((row) => localeUserIds.has(row.user_id))
    : rawAliceCreditRows;

  const toUnique = (rows: SessionRow[]) =>
    new Set(rows.map((e) => e.session_id).filter(Boolean)).size;
  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  // ===== LINE / Alice Plus (2026-09-01) =====
  // 件数だけ欲しいので fetchAll ではなく head+count で取る (1000行制限の影響なし)。
  // LINE機能は ja 限定のため、ko ビューではスナップショットを 0 にする
  // (期間イベントは recordLineEvent が locale=ja で書くため applyLocale で自然に 0 になる)。
  // 管理統計は商品実装へ依存させない。現在の月額・年額を月次換算して
  // MRRスナップショットを算出する。
  const ALICE_PLUS_MONTHLY_MRR_JPY = 480;
  const ALICE_PLUS_ANNUAL_MRR_JPY = 4_800 / 12;
  // 失敗しても 0 に倒して stats 全体を巻き込まない (adminが新セクション起因で
  // 全損しないことを最優先にする)
  const countExact = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    build: () => any,
    label: string,
  ): Promise<number> => {
    try {
      const { count, error } = await withDbQuerySlot<{
        count: number | null;
        error: { message?: string } | null;
      }>(() => build());
      if (error) {
        console.error(`[admin-stats] ${label} count failed`, error.message);
        return 0;
      }
      return count ?? 0;
    } catch (caught) {
      console.error(`[admin-stats] ${label} count threw`, {
        message: caught instanceof Error ? caught.message : String(caught),
      });
      return 0;
    }
  };
  const lineEventCount = (eventName: string) =>
    countExact(
      () =>
        applyLocale(
          applyRange(
            supabaseAdmin
              .from("events")
              .select("id", { count: "exact", head: true })
              .eq("event_name", eventName),
          ),
        ),
      `events:${eventName}`,
    );
  const [
    lineFriends,
    lineLinked,
    linePlusActive,
    linePlusMonthlyActive,
    linePlusAnnualActive,
    linePlusTrialing,
    linePlusCancelScheduled,
    lineFollowCount,
    lineLinkCompletedCount,
    linePlusCheckoutOpenedCount,
    linePlusSubscribedCount,
    linePlusCanceledCount,
    lineAliceCardViewedCount,
    lineAliceAddFriendClickedCount,
    lineAliceLinkCodeRequestedCount,
    lineAliceLinkCodeIssuedCount,
    lineAliceLinkCodeFailedCount,
  ] = await Promise.all([
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_accounts")
              .select("line_user_id", { count: "exact", head: true })
              .is("unfollowed_at", null),
          "line_accounts:friends",
        ),
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_accounts")
              .select("line_user_id", { count: "exact", head: true })
              .is("unfollowed_at", null)
              .not("user_id", "is", null),
          "line_accounts:linked",
        ),
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_plus_subscriptions")
              .select("id", { count: "exact", head: true })
              .in("status", ["active", "trialing"]),
          "line_plus:active",
        ),
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_plus_subscriptions")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .eq("plan_key", "monthly"),
          "line_plus:monthly_active",
        ),
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_plus_subscriptions")
              .select("id", { count: "exact", head: true })
              .eq("status", "active")
              .eq("plan_key", "annual"),
          "line_plus:annual_active",
        ),
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_plus_subscriptions")
              .select("id", { count: "exact", head: true })
              .eq("status", "trialing"),
          "line_plus:trialing",
        ),
    statsLocale === "ko"
      ? Promise.resolve(0)
      : countExact(
          () =>
            supabaseAdmin
              .from("line_plus_subscriptions")
              .select("id", { count: "exact", head: true })
              .in("status", ["active", "trialing"])
              .eq("cancel_at_period_end", true),
          "line_plus:cancel_scheduled",
        ),
    lineEventCount("line_follow"),
    lineEventCount("line_link_completed"),
    lineEventCount("line_plus_checkout_opened"),
    lineEventCount("line_plus_subscribed"),
    lineEventCount("line_plus_canceled"),
    lineEventCount("line_alice_card_viewed"),
    lineEventCount("line_alice_add_friend_clicked"),
    lineEventCount("line_alice_link_code_requested"),
    lineEventCount("line_alice_link_code_issued"),
    lineEventCount("line_alice_link_code_failed"),
  ]);

  const aliceEvents = (eventName: string) =>
    aliceEventRows.filter((row) => row.event_name === eventName);
  const alicePageRows = aliceEvents("hoshiyomi_page_viewed");
  const aliceUnlockedPageRows = alicePageRows.filter(
    (row) => row.metadata?.access_state === "unlocked",
  );
  const aliceLockedPageRows = alicePageRows.filter(
    (row) => row.metadata?.access_state === "locked",
  );
  const alicePaywallRows = aliceEvents("hoshiyomi_paywall_opened");
  const aliceMessageRows = aliceEvents("hoshiyomi_message_sent");
  const aliceResponseRows = aliceEvents("hoshiyomi_response_completed");
  const aliceFailureRows = aliceEvents("hoshiyomi_response_failed");
  const alicePageViews = toUnique(alicePageRows);
  const aliceAccessViewers = toUnique(aliceUnlockedPageRows);
  const aliceLockedViewers = toUnique(aliceLockedPageRows);
  const alicePaywallOpeners = toUnique(alicePaywallRows);
  const aliceMessageSenders = toUnique(aliceMessageRows);
  const aliceResponseViewers = toUnique(aliceResponseRows);
  const aliceFailureViewers = toUnique(aliceFailureRows);
  const aliceCommittedRows = aliceReservationRows.filter(
    (row) => row.status === "committed",
  );
  const aliceReleasedRows = aliceReservationRows.filter(
    (row) => row.status === "released",
  );
  const aliceSettledMessages =
    aliceCommittedRows.length + aliceReleasedRows.length;
  const aliceActiveUsers = new Set(
    aliceCommittedRows.map((row) => row.user_id),
  ).size;
  const aliceCreditTotals = aliceCreditRows.reduce(
    (totals, row) => ({
      total: totals.total + Number(row.credits_total ?? 0),
      remaining: totals.remaining + Number(row.credits_remaining ?? 0),
    }),
    { total: 0, remaining: 0 },
  );

  // 購入ファネルのブラウザ段階は「ユニークセッション」で統一する。
  // 古い行など session_id が無い場合だけ owner_token をフォールバックに使い、
  // 行そのものを欠落させない。
  const toUniquePaywallSessions = (rows: PaywallEventRow[]): number => {
    const keys = new Set<string>();
    for (const row of rows) {
      if (row.session_id) keys.add(`session:${row.session_id}`);
      else if (row.owner_token) keys.add(`owner:${row.owner_token}`);
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

  const sumUniqueCurrencyPurchases = (
    rows: StripeEventRow[],
    targetCurrency: string,
  ): number => {
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
        typeof currency === "string" &&
        currency.toLowerCase() === targetCurrency.toLowerCase() &&
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
    const funnelVersion = row.metadata?.funnelVersion;
    if (
      row.event_name !== "result_viewed" ||
      (funnelVersion !== "share_v2" &&
        funnelVersion !== SELF_RESULT_SHARE_FUNNEL_VERSION) ||
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

  // v3 の result_viewed がある本人だけを、修正後の自己結果シェア
  // コホートとする。友達診断ファネルはv2とv3を連続して数える。
  const selfShareCohortStartedAt = new Map<string, number>();
  for (const row of friendJourneyRows) {
    if (
      row.event_name !== "result_viewed" ||
      row.metadata?.funnelVersion !== SELF_RESULT_SHARE_FUNNEL_VERSION ||
      !row.owner_token ||
      !row.session_id ||
      !journeyInCohortRange(row.created_at)
    ) {
      continue;
    }
    const time = Date.parse(row.created_at);
    if (
      time < Date.parse(SELF_RESULT_SHARE_FUNNEL_MEASUREMENT_STARTED_AT)
    ) {
      continue;
    }
    const completedAt = diagnosisCohortSessions.get(row.session_id);
    if (completedAt === undefined || completedAt > time) continue;
    const previous = selfShareCohortStartedAt.get(row.owner_token);
    if (previous === undefined || time < previous) {
      selfShareCohortStartedAt.set(row.owner_token, time);
    }
  }
  const selfShareCohortOwners = new Set(selfShareCohortStartedAt.keys());

  const inviteToOwner = new Map<string, string>();
  for (const row of identityRows) {
    if (!row.owner_token) continue;
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
  const friendAnswerStartedSessions = new Set<string>();
  const friendAnswerSessions = new Set<string>();
  const friendToDiagnosisSessions = new Set<string>();
  const friendToDiagnosisClickedAt = new Map<string, number>();
  const friendDiagnosisCompletedSessions = new Set<string>();

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
    if (row.event_name === "friend_answer_started" && row.session_id) {
      friendAnswerStartedSessions.add(row.session_id);
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
      if (row.session_id) {
        friendToDiagnosisSessions.add(row.session_id);
        const clickedAt = Date.parse(row.created_at);
        const previous = friendToDiagnosisClickedAt.get(row.session_id);
        if (previous === undefined || clickedAt < previous) {
          friendToDiagnosisClickedAt.set(row.session_id, clickedAt);
        }
      }
    }
  }

  // 自己診断完了時の owner_token は、招待した本人ではなく新しく診断した友達本人を指す。
  // ownerForJourney() に通すと、その直後の result_viewed を友達本人のコホート開始として
  // 完了イベントが「開始前」に落とされるため、CTA 時点で招待元コホートへ帰属済みの
  // session_id を正本にして後続完了を判定する。
  for (const row of friendJourneyRows) {
    if (row.event_name !== "diagnosis_completed" || !row.session_id) continue;
    const clickedAt = friendToDiagnosisClickedAt.get(row.session_id);
    if (
      clickedAt !== undefined &&
      Date.parse(row.created_at) >= clickedAt
    ) {
      friendDiagnosisCompletedSessions.add(row.session_id);
    }
  }

  // --- 自己結果シェアファネル ---
  // /share 到達以降は共有者と別セッションになるため、invite_code で共有者へ戻し、
  // 診断ページ以降は同じ訪問者 session_id を引き継いで共有者へ帰属させる。
  // 各段階は「前段を時系列で通過した人」に限定する。これにより、
  // UI表示よりシェア操作が多い、CTA 0人の後に診断開始がいる、などの
  // 直列ファネルとして成立しない数値を出さない。
  const shareSessionToOwner = new Map<string, string>();
  const attributedShareRows: Array<{
    row: JourneyRow;
    owner: string;
    sessionOwner: string | null;
    time: number;
  }> = [];

  for (const row of friendJourneyRows) {
    const directOwner =
      row.owner_token && selfShareCohortOwners.has(row.owner_token)
        ? row.owner_token
        : null;
    const inviteOwner = row.invite_code
      ? inviteToOwner.get(row.invite_code) ?? null
      : null;
    if (
      row.session_id &&
      inviteOwner &&
      selfShareCohortOwners.has(inviteOwner) &&
      (row.event_name === "share_landing_viewed" ||
        row.event_name === "share_to_diagnosis_clicked")
    ) {
      // 時系列順に更新し、同じブラウザが別の共有URLを後で開いた場合も、
      // それ以前の診断イベントを後の共有者へ誤帰属させない。
      shareSessionToOwner.set(row.session_id, inviteOwner);
    }
    const sessionOwner = row.session_id
      ? shareSessionToOwner.get(row.session_id) ?? null
      : null;
    const owner = directOwner ?? inviteOwner ?? sessionOwner;
    if (
      !owner ||
      !selfShareCohortOwners.has(owner) ||
      Date.parse(row.created_at) <
        (selfShareCohortStartedAt.get(owner) ?? Infinity)
    ) {
      continue;
    }
    attributedShareRows.push({
      row,
      owner,
      sessionOwner,
      time: Date.parse(row.created_at),
    });
  }

  const setEarliest = (map: Map<string, number>, key: string, time: number) => {
    const previous = map.get(key);
    if (previous === undefined || time < previous) map.set(key, time);
  };
  const shareUiAtByOwner = new Map<string, number>();
  for (const { row, owner, time } of attributedShareRows) {
    if (row.event_name === "share_ui_shown") {
      setEarliest(shareUiAtByOwner, owner, time);
    }
  }

  const shareActionAtByOwner = new Map<string, number>();
  for (const { row, owner, time } of attributedShareRows) {
    if (
      row.event_name === "share_clicked" &&
      row.metadata?.kind === "character" &&
      (shareUiAtByOwner.get(owner) ?? Infinity) <= time
    ) {
      setEarliest(shareActionAtByOwner, owner, time);
    }
  }

  type ShareSessionStage = { owner: string; time: number };
  const setEarliestStage = (
    map: Map<string, ShareSessionStage>,
    key: string,
    owner: string,
    time: number,
  ) => {
    const previous = map.get(key);
    if (!previous || time < previous.time) map.set(key, { owner, time });
  };
  const shareJourneyKey = (sessionId: string, owner: string) =>
    `${sessionId}\u0000${owner}`;

  const shareLandingAtByJourney = new Map<string, ShareSessionStage>();
  for (const { row, owner, time } of attributedShareRows) {
    const actionAt = shareActionAtByOwner.get(owner);
    if (
      row.event_name === "share_landing_viewed" &&
      row.session_id &&
      actionAt !== undefined &&
      actionAt <= time
    ) {
      setEarliestStage(
        shareLandingAtByJourney,
        shareJourneyKey(row.session_id, owner),
        owner,
        time,
      );
    }
  }

  const shareDiagnosisCtaAtByJourney = new Map<string, ShareSessionStage>();
  for (const { row, owner, time } of attributedShareRows) {
    if (row.event_name !== "share_to_diagnosis_clicked" || !row.session_id) {
      continue;
    }
    const key = shareJourneyKey(row.session_id, owner);
    const landing = shareLandingAtByJourney.get(key);
    if (landing && landing.time <= time) {
      setEarliestStage(shareDiagnosisCtaAtByJourney, key, owner, time);
    }
  }

  const shareDiagnosisStartedAtByJourney = new Map<string, ShareSessionStage>();
  for (const { row, owner, sessionOwner, time } of attributedShareRows) {
    if (
      row.event_name !== "diagnosis_started" ||
      !row.session_id ||
      sessionOwner !== owner
    ) {
      continue;
    }
    const key = shareJourneyKey(row.session_id, owner);
    const cta = shareDiagnosisCtaAtByJourney.get(key);
    if (cta && cta.time <= time) {
      setEarliestStage(shareDiagnosisStartedAtByJourney, key, owner, time);
    }
  }

  const shareDiagnosisCompletedAtByJourney = new Map<
    string,
    ShareSessionStage
  >();
  for (const { row, owner, sessionOwner, time } of attributedShareRows) {
    if (
      row.event_name !== "diagnosis_completed" ||
      !row.session_id ||
      sessionOwner !== owner
    ) {
      continue;
    }
    const key = shareJourneyKey(row.session_id, owner);
    const started = shareDiagnosisStartedAtByJourney.get(key);
    if (started && started.time <= time) {
      setEarliestStage(shareDiagnosisCompletedAtByJourney, key, owner, time);
    }
  }

  const ownersFromStages = (stages: Map<string, ShareSessionStage>) =>
    new Set(Array.from(stages.values(), (stage) => stage.owner));
  const shareUiOwners = new Set(shareUiAtByOwner.keys());
  const shareActionOwners = new Set(shareActionAtByOwner.keys());
  const shareLandingOwners = ownersFromStages(shareLandingAtByJourney);
  const shareDiagnosisCtaOwners = ownersFromStages(
    shareDiagnosisCtaAtByJourney,
  );
  const shareDiagnosisStartedOwners = ownersFromStages(
    shareDiagnosisStartedAtByJourney,
  );
  const shareDiagnosisCompletedOwners = ownersFromStages(
    shareDiagnosisCompletedAtByJourney,
  );

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

  // ===== 現在ユーザーに表示している課金カード =====
  // カードの見た目とは分けて、現行オファー固有の paywall_version で
  // 表示・CTA・Stripe・決済を一貫して接続する。開発プレビューは除外する。
  const activePaywallVersion = THREE_COURSE_PAYWALL_VERSION;
  const isActivePaywallMeta = (
    metadata: Record<string, unknown> | null,
  ): boolean => metadata?.paywall_version === activePaywallVersion;
  const isCoursePaywallPageMeta = (
    metadata: Record<string, unknown> | null,
  ): boolean => {
    const isResultPage =
      metadata?.page === "me" ||
      metadata?.page === "tako" ||
      metadata?.page === "result";
    return (
      isResultPage ||
      metadata?.page === "aisho" ||
      metadata?.page === "unmei" ||
      metadata?.page === "hoshiyomi"
    );
  };
  const isCoursePaywallReturnMeta = (
    metadata: Record<string, unknown> | null,
  ): boolean => {
    const isResultReturn =
      metadata?.return_to === "me" || metadata?.return_to === "tako";
    return (
      isResultReturn ||
      metadata?.return_to === "aisho" ||
      metadata?.return_to === "unmei" ||
      metadata?.return_to === "hoshiyomi"
    );
  };
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
    isActivePaywallMeta(row.metadata) && isCoursePaywallPageMeta(row.metadata),
  );
  const coursePlanViewRows = paywallPlanViewedRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isCoursePaywallPageMeta(row.metadata),
  );
  const courseScrollRows = paywallScrollRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isCoursePaywallPageMeta(row.metadata),
  );
  const courseCtaRows = purchaseCtaRows.filter((row) =>
    isActivePaywallMeta(row.metadata) && isCoursePaywallPageMeta(row.metadata),
  );
  const courseCheckoutRows = checkoutCreatedRows.filter(
    (row) =>
      isActivePaywallMeta(row.metadata) &&
      isCoursePaywallReturnMeta(row.metadata) &&
      isLiveStripeRow(row),
  );
  const coursePurchaseRows = purchaseCompletedRows.filter(
    (row) =>
      isActivePaywallMeta(row.metadata) &&
      isCoursePaywallReturnMeta(row.metadata) &&
      isLiveStripeRow(row),
  );

  const courseCardViewers = toUniquePaywallSessions(courseCardViewRows);
  const coursePlanViewers = toUniquePaywallSessions(coursePlanViewRows);
  const courseScrollClickers = toUniquePaywallSessions(courseScrollRows);
  const courseCtaClickers = toUniquePaywallSessions(courseCtaRows);
  const courseStripeReached = countUniqueStripeSessions(courseCheckoutRows);
  const coursePurchasers = countUniquePurchasers(coursePurchaseRows);
  const courseTransactions = countUniqueStripeSessions(coursePurchaseRows);
  const courseNewPurchases = countUniqueStripeSessions(
    coursePurchaseRows.filter((row) => !isUpgradeMeta(row.metadata)),
  );
  const courseUpgrades = countUniqueStripeSessions(
    coursePurchaseRows.filter((row) => isUpgradeMeta(row.metadata)),
  );
  const courseRevenueCurrency = statsLocale === "ko" ? "krw" : "jpy";
  const courseRevenueMinor = sumUniqueCurrencyPurchases(
    coursePurchaseRows,
    courseRevenueCurrency,
  );
  const courseRevenueJpy = sumUniqueCurrencyPurchases(coursePurchaseRows, "jpy");

  const coursePlans = ACCESS_PRODUCTS.map((product) => {
    // 旧カードデザインは paywall_plan_viewed を送らないため、商品別の
    // paywall_viewed も表示分母へ含める。セッション単位の集計で重複は除かれる。
    const planViews = [
      ...courseCardViewRows.filter(
        (row) => productFromMeta(row.metadata) === product,
      ),
      ...coursePlanViewRows.filter(
        (row) => productFromMeta(row.metadata) === product,
      ),
    ];
    const ctaClicks = courseCtaRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const checkouts = courseCheckoutRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const purchases = coursePurchaseRows.filter(
      (row) => productFromMeta(row.metadata) === product,
    );
    const viewers = toUniquePaywallSessions(planViews);
    const ctaClickers = toUniquePaywallSessions(ctaClicks);
    const stripeReached = countUniqueStripeSessions(checkouts);
    const purchasers = countUniquePurchasers(purchases);
    const transactions = countUniqueStripeSessions(purchases);
    const newPurchases = countUniqueStripeSessions(
      purchases.filter((row) => !isUpgradeMeta(row.metadata)),
    );
    const upgrades = countUniqueStripeSessions(
      purchases.filter((row) => isUpgradeMeta(row.metadata)),
    );
    const revenueMinor = sumUniqueCurrencyPurchases(
      purchases,
      courseRevenueCurrency,
    );
    const revenueJpy = sumUniqueCurrencyPurchases(purchases, "jpy");
    return {
      product,
      viewers,
      ctaClickers,
      stripeReached,
      purchasers,
      transactions,
      newPurchases,
      upgrades,
      currency: courseRevenueCurrency,
      revenueMinor,
      revenueJpy,
      ctaRate: rate(ctaClickers, viewers),
      stripeRate: rate(stripeReached, ctaClickers),
      checkoutCompletionRate: rate(transactions, stripeReached),
      purchaseRate: rate(purchasers, viewers),
    };
  });

  // ===== 商品別課金ファネル =====
  //   自己診断ページは self_report。友達診断・相性・韓国版は
  //   従来の full_access を維持する。ライトの転換率に完全版決済を混ぜないため、
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
    m?.surface === "unmei" ||
    m?.return_to === "unmei" ||
    (typeof m?.source === "string" &&
      [
        "unmei_page",
        "unmei_hero",
        "unmei_birth_chat",
        "nav_locked_unmei",
      ].includes(m.source));
  const isAliceMeta = (m: Record<string, unknown> | null): boolean =>
    m?.page === "hoshiyomi" ||
    m?.surface === "hoshiyomi" ||
    m?.return_to === "hoshiyomi" ||
    (typeof m?.source === "string" &&
      ["hoshiyomi_first_send", "nav_locked_hoshiyomi"].includes(m.source));
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
  // ライト決済完了は self_report だけを集計する。
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
  const unmeiCurrentPurchaseRows = purchaseCompletedRows.filter(
    (r) => isUnmeiMeta(r.metadata) && isLiveStripeRow(r),
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
  const unmeiCurrentPurchases = countUniqueStripeSessions(
    unmeiCurrentPurchaseRows,
  );
  const unmeiLegacyPurchases = countUniqueStripeSessions(
    unmeiPurchaseRowsInRange,
  );
  const unmeiAttributedPurchaseRows: StripeEventRow[] = [
    ...unmeiPurchaseRowsInRange,
    ...unmeiCurrentPurchaseRows,
  ];
  const unmeiPurchases = countUniqueStripeSessions(
    unmeiAttributedPurchaseRows,
  );
  const unmeiBasePurchases = countUniqueStripeSessions(unmeiBasePurchaseRows);
  const unmeiUpgradePurchases = countUniqueStripeSessions(
    unmeiUpgradePurchaseRows,
  );
  const unmeiPremiumPurchases = countUniqueStripeSessions(
    unmeiCurrentPurchaseRows.filter(
      (r) => r.metadata?.product === "premium_bundle",
    ),
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

  // 運命の設計図: チャット決済フロー専用ファネル。
  // 旧埋め込み決済は payment_method、新しいStripe-hosted Checkoutは source で抽出する。
  // 段階順はチャット実態 (LP→作成CTA→出生入力→保存→決済フォーム→完了)。
  // ⑤決済フォーム到達は checkout_session_created で数える。
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
    (r) =>
      r.metadata?.payment_method === "card_embedded" ||
      r.metadata?.source === "unmei_birth_chat",
  );
  const unmeiChatCheckoutReached = countUniqueStripeSessions(
    unmeiChatCheckoutRows,
  );
  // 旧チャットの埋め込み/PayPayと、新しい出生情報チャットのStripe Session IDを集め、
  // そのIDで完了した購入だけをチャット発の決済完了として数える。
  const unmeiChatCheckoutSessionIds = new Set<string>();
  for (const r of unmeiCheckoutRows) {
    const pm = r.metadata?.payment_method;
    const source = r.metadata?.source;
    if (
      pm !== "card_embedded" &&
      pm !== "paypay" &&
      source !== "unmei_birth_chat"
    ) {
      continue;
    }
    const sid = r.metadata?.stripe_session_id;
    if (typeof sid === "string") unmeiChatCheckoutSessionIds.add(sid);
  }
  const unmeiChatPurchaseRows = unmeiAttributedPurchaseRows.filter((r) => {
    const sid = r.metadata?.stripe_session_id;
    return typeof sid === "string" && unmeiChatCheckoutSessionIds.has(sid);
  });
  const unmeiChatPurchases = countUniqueStripeSessions(unmeiChatPurchaseRows);

  // 下部ナビのロック → コース選択は、設計図LPの出生情報チャットとは別導線。
  // surface/source/return_to をつないで、入口から決済完了までを独立して表示する。
  const unmeiNavOpenRows = paywallScrollRows.filter(
    (r) => r.metadata?.source === "nav_locked_unmei",
  );
  const unmeiNavPlanRows = paywallPlanViewedRows.filter(
    (r) =>
      isActivePaywallMeta(r.metadata) &&
      r.metadata?.surface === "unmei" &&
      r.metadata?.source === "nav_locked_unmei",
  );
  const unmeiNavCtaRows = purchaseCtaRows.filter(
    (r) => r.metadata?.source === "nav_locked_unmei",
  );
  const unmeiNavCheckoutRows = checkoutCreatedRows.filter(
    (r) =>
      isActivePaywallMeta(r.metadata) &&
      r.metadata?.return_to === "unmei" &&
      isLiveStripeRow(r),
  );
  const unmeiNavPurchaseRows = purchaseCompletedRows.filter(
    (r) =>
      isActivePaywallMeta(r.metadata) &&
      r.metadata?.return_to === "unmei" &&
      isLiveStripeRow(r),
  );
  const unmeiNavOpened = toUniquePaywallSessions(unmeiNavOpenRows);
  const unmeiNavCardViewers = toUniquePaywallSessions(unmeiNavPlanRows);
  const unmeiNavCtaClickers = toUniquePaywallSessions(unmeiNavCtaRows);
  const unmeiNavStripeReached = countUniqueStripeSessions(
    unmeiNavCheckoutRows,
  );
  const unmeiNavPurchases = countUniqueStripeSessions(unmeiNavPurchaseRows);

  // Aliceは「会話利用」と「購入導線」を分離して計測する。下部ナビのロックと、
  // Aliceページで初回送信したときのカードを同じ surface=hoshiyomi で束ねる。
  const alicePlanRows = paywallPlanViewedRows.filter(
    (r) => isActivePaywallMeta(r.metadata) && isAliceMeta(r.metadata),
  );
  const aliceCtaRows = purchaseCtaRows.filter(
    (r) => isActivePaywallMeta(r.metadata) && isAliceMeta(r.metadata),
  );
  const aliceCheckoutRows = checkoutCreatedRows.filter(
    (r) =>
      isActivePaywallMeta(r.metadata) &&
      isAliceMeta(r.metadata) &&
      isLiveStripeRow(r),
  );
  const alicePurchaseRows = purchaseCompletedRows.filter(
    (r) =>
      isActivePaywallMeta(r.metadata) &&
      isAliceMeta(r.metadata) &&
      isLiveStripeRow(r),
  );
  const aliceCardViewers = toUniquePaywallSessions(alicePlanRows);
  const aliceCtaClickers = toUniquePaywallSessions(aliceCtaRows);
  const aliceStripeReached = countUniqueStripeSessions(aliceCheckoutRows);
  const alicePurchasers = countUniquePurchasers(alicePurchaseRows);
  const alicePurchases = countUniqueStripeSessions(alicePurchaseRows);

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

  // kind 付きの全商品決済ファクト。総売上・商品別内訳・日別推移・
  // コホートKPIの共通源泉。商品を限定せず「何らかの有償購入」を課金として扱う。
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

  // 選択期間中に確定した全商品決済の実売上。
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
  const periodPurchaseTransactions = periodRevenue.currencies.reduce(
    (total, row) => total + row.purchases,
    0,
  );
  const paidUsers = periodRevenue.uniquePayers;
  const revenueJpy =
    periodRevenue.currencies.find((row) => row.currency === "jpy")
      ?.netRevenueMinor ?? 0;

  const periodPaymentSessionIds = new Set(
    verifiedPaymentFacts
      .filter((payment) => inRange(payment.paidAt))
      .map((payment) => payment.stripeSessionId),
  );
  let purchaseConversionOutboxRows: Array<{
    stripe_session_id: string;
    status: "pending" | "processing" | "sent" | "failed";
  }> = [];
  const { data: outboxData, error: outboxError } = await withDbQuerySlot(() =>
    supabaseAdmin
      .from("purchase_conversion_outbox")
      .select("stripe_session_id, status")
      .in("status", ["pending", "processing", "failed"]),
  );
  if (outboxError) {
    // Keep admin/metrics available during the migration-before-deploy window.
    if (outboxError.code !== "42P01" && outboxError.code !== "PGRST205") {
      throw new Error(
        `[admin-stats] purchase conversion outbox lookup failed: ${outboxError.message}`,
      );
    }
    console.warn(
      "[admin-stats] purchase conversion outbox migration is not applied yet",
    );
  } else {
    purchaseConversionOutboxRows = (outboxData ?? []) as typeof purchaseConversionOutboxRows;
  }
  const periodPurchaseEventSessionIds = new Set<string>();
  for (const row of [
    ...kpiPaymentEventRows.filter(
      (event) => event.event_name === "purchase_completed",
    ),
    ...unmeiPurchaseFacts,
  ]) {
    const sid = row.metadata?.stripe_session_id;
    if (typeof sid === "string" && sid && !isTestStripeSession(sid)) {
      periodPurchaseEventSessionIds.add(sid);
    }
  }
  const trackedPaymentSessions = Array.from(periodPaymentSessionIds).filter(
    (sid) => periodPurchaseEventSessionIds.has(sid),
  ).length;
  const deliverySessions = (provider: "browser" | "meta" | "tiktok") => {
    const ids = new Set<string>();
    for (const row of purchaseDeliveryRows) {
      const sid = row.metadata?.stripe_session_id;
      const rowProvider = row.metadata?.provider;
      const matches =
        provider === "browser"
          ? row.event_name === "meta_purchase_claimed"
          : rowProvider === provider;
      if (
        matches &&
        typeof sid === "string" &&
        periodPaymentSessionIds.has(sid)
      ) {
        ids.add(sid);
      }
    }
    return ids.size;
  };
  const metaConfigValues = [
    process.env.META_PIXEL_ID,
    process.env.META_CONVERSIONS_API_TOKEN,
    process.env.META_GRAPH_API_VERSION,
  ];
  const tiktokConfigValues = [
    process.env.TIKTOK_PIXEL_CODE,
    process.env.TIKTOK_EVENTS_API_TOKEN,
  ];
  const purchaseTracking = {
    verifiedPayments: periodPaymentSessionIds.size,
    purchaseEvents: trackedPaymentSessions,
    missingPurchaseEvents: Math.max(
      0,
      periodPaymentSessionIds.size - trackedPaymentSessions,
    ),
    browserMetaPushed: deliverySessions("browser"),
    browserTikTokPushed: new Set(
      purchaseDeliveryRows
        .filter(
          (row) =>
            row.event_name === "browser_tiktok_purchase_pushed" &&
            typeof row.metadata?.stripe_session_id === "string" &&
            periodPaymentSessionIds.has(row.metadata.stripe_session_id),
        )
        .map((row) => row.metadata?.stripe_session_id as string),
    ).size,
    serverMetaSent: deliverySessions("meta"),
    serverTikTokSent: deliverySessions("tiktok"),
    serverQueuePending: purchaseConversionOutboxRows.filter(
      (row) =>
        periodPaymentSessionIds.has(row.stripe_session_id) &&
        (row.status === "pending" || row.status === "processing"),
    ).length,
    serverQueueFailed: purchaseConversionOutboxRows.filter(
      (row) =>
        periodPaymentSessionIds.has(row.stripe_session_id) &&
        row.status === "failed",
    ).length,
    metaServerConfigured: metaConfigValues.every((value) => !!value?.trim()),
    tiktokServerConfigured: tiktokConfigValues.every(
      (value) => !!value?.trim(),
    ),
  };

  const paymentMetadataBySession = new Map(
    paymentHistoryRows.map((row) => [
      row.stripe_session_id,
      row.metadata,
    ] as const),
  );
  const stripeSessionIds = (rows: StripeEventRow[]): Set<string> =>
    new Set(
      rows
        .map((row) => row.metadata?.stripe_session_id)
        .filter((sid): sid is string => typeof sid === "string" && !!sid),
    );
  const unmeiAttributedSessionIds = stripeSessionIds(
    unmeiAttributedPurchaseRows,
  );
  const aliceAttributedSessionIds = stripeSessionIds(alicePurchaseRows);

  const attributedRevenue = (
    matches: (payment: (typeof verifiedPaymentFacts)[number]) => boolean,
  ) => {
    const buckets = new Map<
      string,
      { purchases: number; netRevenueMinor: number }
    >();
    for (const payment of verifiedPaymentFacts) {
      if (!inRange(payment.paidAt) || !matches(payment)) continue;
      const currency = payment.currency.toLowerCase();
      const bucket = buckets.get(currency) ?? {
        purchases: 0,
        netRevenueMinor: 0,
      };
      const refundedMinor = Math.min(
        Math.max(payment.refundedAmountMinor, 0),
        payment.amountMinor,
      );
      bucket.purchases++;
      bucket.netRevenueMinor += payment.amountMinor - refundedMinor;
      buckets.set(currency, bucket);
    }
    return {
      currencies: Array.from(buckets.entries())
        .map(([currency, bucket]) => ({
          currency,
          purchases: bucket.purchases,
          netRevenueMinor: bucket.netRevenueMinor,
        }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    };
  };

  // 旧「運命」商品に加え、現行の運命チャット／ナビロックから購入された
  // 3コース決済も、return_to/source を根拠に運命導線売上へ含める。
  const unmeiRevenue = attributedRevenue(
    (payment) =>
      payment.kind === "unmei" ||
      payment.kind === "unmei_upgrade" ||
      unmeiAttributedSessionIds.has(payment.stripeSessionId) ||
      isUnmeiMeta(paymentMetadataBySession.get(payment.stripeSessionId) ?? null),
  );
  const aliceRevenue = attributedRevenue(
    (payment) =>
      aliceAttributedSessionIds.has(payment.stripeSessionId) ||
      isAliceMeta(paymentMetadataBySession.get(payment.stripeSessionId) ?? null),
  );

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
    cohortOwners.size,
    takoReachedOwners.size,
    inviteUiOwners.size,
    inviteActionOwners.size,
    friendReachedOwners.size,
    friendAnsweredOwners.size,
  ];
  const ownerFunnelLabels = [
    "結果ページ到達",
    "友達診断ページ到達",
    "招待UI表示",
    "招待実行（友達到達で補完）",
    "友達がページ到達",
    "友達が1人以上回答完了",
  ];
  const ownerFunnel = ownerFunnelCounts.map((count, index) => ({
    key: [
      "result",
      "tako",
      "invite_ui",
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
    friendAnswerStartedSessions.size,
    friendAnswerSessions.size,
    friendToDiagnosisSessions.size,
    friendDiagnosisCompletedSessions.size,
  ];
  const friendFunnelLabels = [
    "友達が招待ページ到達",
    "友達が最初の設問に回答",
    "友達が回答完了",
    "友達が「自分も診断」をクリック",
    "友達が自己診断完了",
  ];
  const friendFunnel = friendFunnelCounts.map((count, index) => ({
    key: ["landing", "answer_start", "answer", "self_cta", "self_complete"][index],
    label: friendFunnelLabels[index],
    count,
    rateFromPrevious:
      index === 0 ? null : rate(count, friendFunnelCounts[index - 1]),
    rateFromLanding: rate(count, friendFunnelCounts[0]),
  }));

  const selfResultShareCounts = [
    selfShareCohortOwners.size,
    shareUiOwners.size,
    shareActionOwners.size,
    shareLandingOwners.size,
    shareDiagnosisCtaOwners.size,
    shareDiagnosisStartedOwners.size,
    shareDiagnosisCompletedOwners.size,
  ];
  const selfResultShareLabels = [
    "結果ページ到達",
    "シェアUI表示",
    "シェア操作",
    "シェア結果ページ到達",
    "自己診断CTAクリック",
    "自己診断開始",
    "自己診断完了",
  ];
  const selfResultShareFunnel = selfResultShareCounts.map((count, index) => ({
    key: [
      "result",
      "share_ui",
      "share_action",
      "share_landing",
      "diagnosis_cta",
      "diagnosis_start",
      "diagnosis_complete",
    ][index],
    label: selfResultShareLabels[index],
    count,
    rateFromPrevious:
      index === 0 ? null : rate(count, selfResultShareCounts[index - 1]),
    rateFromResult: rate(count, selfResultShareCounts[0]),
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
      diagnosisCompleted: diagnosisCohortSessions.size,
      cohortDefinition:
        "share_v2/v3 の結果表示が選択期間内にあり、同一セッションで自己診断完了も確認できた本人を起点に、その後の友達招待と診断完了までを追跡する",
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
    selfResultShareFunnel: {
      measurementStartedAt: SELF_RESULT_SHARE_FUNNEL_MEASUREMENT_STARTED_AT,
      cohortDefinition:
        "share_v3 の結果表示がある本人を起点に、各段を時系列で通過した共有者だけを invite_code と訪問者 session_id で追跡する",
      steps: selfResultShareFunnel,
    },
    // 現在表示中の課金カードの合計ファネル。自己・友達・相性・運命・Aliceの
    // 全導線を含み、別バージョン・開発プレビュー・テスト決済は含めない。
    // 全ページ共通の入口はカード表示なので、そこを分母に揃える。
    paywallFunnel: [
      { label: "課金カード表示", count: courseCardViewers },
      { label: "解除ボタン押下", count: courseScrollClickers },
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
      currency: courseRevenueCurrency,
      revenueMinor: courseRevenueMinor,
      revenueJpy: courseRevenueJpy,
      revenuePerViewerJpy: rate(courseRevenueJpy, courseCardViewers),
      purchaseRate: rate(coursePurchasers, courseCardViewers),
      plans: coursePlans,
    },
    // 課金ファネル (友達診断ページ発の完全版)。Stripe到達は 2026-07-22 に計測追加。
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
      navigationFunnel: [
        { label: "ロックタップ", count: unmeiNavOpened },
        { label: "コースカード表示", count: unmeiNavCardViewers },
        { label: "購入CTA押下", count: unmeiNavCtaClickers },
        { label: "Stripe到達", count: unmeiNavStripeReached },
        { label: "決済完了", count: unmeiNavPurchases },
      ],
      purchases: {
        total: unmeiPurchases,
        current: unmeiCurrentPurchases,
        premium: unmeiPremiumPurchases,
        legacy: unmeiLegacyPurchases,
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
    alice: {
      measurementStartedAt: ALICE_FUNNEL_MEASUREMENT_STARTED_AT,
      purchaseFunnel: [
        { label: "コースカード表示", count: aliceCardViewers },
        { label: "購入CTA押下", count: aliceCtaClickers },
        { label: "Stripe到達", count: aliceStripeReached },
        { label: "決済完了", count: alicePurchases },
      ],
      funnel: [
        { label: "Aliceページ表示", count: alicePageViews },
        { label: "チャット解放済みで表示", count: aliceAccessViewers },
        { label: "メッセージ送信", count: aliceMessageSenders },
        { label: "Aliceの応答表示", count: aliceResponseViewers },
      ],
      pageViews: alicePageViews,
      accessViewers: aliceAccessViewers,
      lockedViewers: aliceLockedViewers,
      paywallOpeners: alicePaywallOpeners,
      cardViewers: aliceCardViewers,
      ctaClickers: aliceCtaClickers,
      stripeReached: aliceStripeReached,
      purchasers: alicePurchasers,
      purchases: alicePurchases,
      revenue: aliceRevenue,
      messageSenders: aliceMessageSenders,
      messageActions: aliceMessageRows.length,
      responseViewers: aliceResponseViewers,
      responseFailureViewers: aliceFailureViewers,
      pageToSendRate: rate(aliceMessageSenders, alicePageViews),
      accessToSendRate: rate(aliceMessageSenders, aliceAccessViewers),
      paywallOpenRate: rate(alicePaywallOpeners, aliceLockedViewers),
      activeUsers: aliceActiveUsers,
      conversationsStarted: aliceConversationRows.length,
      responsesCompleted: aliceCommittedRows.length,
      responsesFailed: aliceReleasedRows.length,
      responseSuccessRate: rate(
        aliceCommittedRows.length,
        aliceSettledMessages,
      ),
      credits: {
        holders: aliceCreditRows.length,
        total: aliceCreditTotals.total,
        remaining: aliceCreditTotals.remaining,
        used: Math.max(
          0,
          aliceCreditTotals.total - aliceCreditTotals.remaining,
        ),
      },
    },
    // LINE基盤 + Alice Plus。snapshot系 (friends/linked/加入者/MRR) は
    // 現在値・イベント系 (follows〜canceled) は選択期間内の件数
    linePlus: {
      friends: lineFriends,
      linked: lineLinked,
      activeSubscribers: linePlusActive,
      monthlySubscribers: linePlusMonthlyActive,
      annualSubscribers: linePlusAnnualActive,
      trialingSubscribers: linePlusTrialing,
      cancelScheduled: linePlusCancelScheduled,
      mrrJpy:
        linePlusMonthlyActive * ALICE_PLUS_MONTHLY_MRR_JPY +
        linePlusAnnualActive * ALICE_PLUS_ANNUAL_MRR_JPY,
      follows: lineFollowCount,
      linkCompleted: lineLinkCompletedCount,
      checkoutOpened: linePlusCheckoutOpenedCount,
      subscribed: linePlusSubscribedCount,
      canceled: linePlusCanceledCount,
      cardViewed: lineAliceCardViewedCount,
      addFriendClicked: lineAliceAddFriendClickedCount,
      linkCodeRequested: lineAliceLinkCodeRequestedCount,
      linkCodeIssued: lineAliceLinkCodeIssuedCount,
      linkCodeFailed: lineAliceLinkCodeFailedCount,
    },
    paywallSources,
    paywallAttribution: courseAttribution,
    legacyPaywallAttribution: paywallAttribution,
    takoAttribution,
    // 汎用の課金指標は payment_history 正本の全商品。現行3コースだけの評価は
    // coursePurchase* / coursePaywall に明示して、旧商品や運命の設計図と混ぜない。
    purchaseCompleted: periodPurchaseTransactions,
    purchaseConversionRate: computedCoreKpis.diagnosisToPaid.rate,
    coursePurchaseCompleted: courseTransactions,
    coursePurchaseConversionRate: rate(coursePurchasers, courseCardViewers),
    paidUsers,
    revenueJpy,
    revenueByKind,
    revenueDaily,
    purchaseTracking,
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
