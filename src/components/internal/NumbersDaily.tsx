"use client";

// 月の推移 (日次)。1 か月分を、月の合計・推移のグラフ・日ごとの表で見る。
//   * 終わった日は DB の控えから出す。控えが無い日は、開いたときに 1 日ずつ数えさせて埋める
//     (古い日は 1 日 10〜20 秒かかるので、進み具合を出す)。一度数えた日は次からすぐ出る。
//   * 今日は、今の数字 (途中) を別に取って出す。
//   * 表の日付を押すと、その日の「1日の数字」に移る。
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  NUMBERS_EARLIEST_DAY,
  buildDailyRow,
  costUntil,
  dailyAmounts,
  formatNumbersDay,
  shiftNumbersMonth,
  sumDailyRows,
  todayInJst,
  type NumbersDailyAmounts,
  type NumbersDailyPayload,
  type NumbersDailyRow,
  type NumbersDayBlock,
  type NumbersPayload,
} from "@/lib/internal-numbers";

import {
  Card,
  NAV_BUTTON,
  NUMBERS_THEMES,
  NumbersNav,
  ThemeToggle,
  numberFormat,
  percent,
} from "./numbers-ui";
import { useNumbersTheme } from "./use-numbers-theme";

type Status = "loading" | "ready" | "error" | "not_installed";

interface Filled {
  amounts: NumbersDailyAmounts;
  cohort: NumbersDayBlock["cohort"];
}

const signedYen = (value: number) =>
  `${value < 0 ? "−" : ""}¥${numberFormat.format(Math.abs(Math.round(value)))}`;
const unitYen = (value: number) => `¥${value.toFixed(2)}`;

/* ------------------------------------------------------------------ 取得 */

async function fetchDaily(
  month: string,
): Promise<NumbersDailyPayload | "not_installed"> {
  const response = await fetch(`/api/internal/numbers/daily?month=${month}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 503) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (body?.error === "daily_not_installed") return "not_installed";
  }
  if (!response.ok) throw new Error(`daily ${response.status}`);
  return (await response.json()) as NumbersDailyPayload;
}

async function fetchToday(): Promise<NumbersPayload> {
  const response = await fetch("/api/internal/numbers", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`numbers ${response.status}`);
  return (await response.json()) as NumbersPayload;
}

/** 終わった 1 日分を数えさせて受け取る (DB 側で控えにも残る)。 */
async function fetchBlock(day: string): Promise<NumbersDayBlock> {
  const response = await fetch(`/api/internal/numbers?fill=${day}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`block ${response.status}`);
  const body = (await response.json()) as { block: NumbersDayBlock | null };
  if (!body.block) throw new Error("block empty");
  return body.block;
}

/* ------------------------------------------------------------ グラフの指標 */

type MetricKey = "diagnoses" | "net" | "profit" | "cost" | "rate" | "cpa";

interface Metric {
  key: MetricKey;
  label: string;
  hint: string;
  /** 量は棒、率や単価は線で描く。 */
  shape: "bar" | "line";
  pick: (row: NumbersDailyRow) => number | null;
  format: (value: number) => string;
}

const METRICS: Metric[] = [
  {
    key: "diagnoses",
    label: "診断数",
    hint: "診断を完了した人数",
    shape: "bar",
    pick: (row) => row.amounts?.diagnoses ?? null,
    format: (value) => numberFormat.format(Math.round(value)),
  },
  {
    key: "net",
    label: "純売上",
    hint: "決済額から返金を引いた金額",
    shape: "bar",
    pick: (row) => row.amounts?.net ?? null,
    format: signedYen,
  },
  {
    key: "profit",
    label: "利益",
    hint: "純売上 − 手数料 − サーバー・AI費の概算 − 広告費",
    shape: "bar",
    pick: (row) => row.economics?.profit ?? null,
    format: signedYen,
  },
  {
    key: "cost",
    label: "広告費",
    hint: "実績。実績が無い時間帯は配信計画の金額",
    shape: "bar",
    pick: (row) => row.cost,
    format: signedYen,
  },
  {
    key: "rate",
    label: "課金率",
    hint: "買い切り ÷ 診断数",
    shape: "line",
    pick: (row) => row.rate,
    format: (value) => percent(value, 2),
  },
  {
    key: "cpa",
    label: "CPA",
    hint: "広告費 ÷ 広告流入の診断数",
    shape: "line",
    pick: (row) => row.economics?.cpaAd ?? null,
    format: unitYen,
  },
];

/* ------------------------------------------------------------------ 本体 */

export function NumbersDaily() {
  const { theme, toggleTheme } = useNumbersTheme();
  // null は、まだ決めていない (描画後に、URL の ?month= か今月に決める)。
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<NumbersDailyPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [todayPayload, setTodayPayload] = useState<NumbersPayload | null>(null);
  // 開いてから数えさせた日の数字。
  const [filled, setFilled] = useState<Record<string, Filled>>({});
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [filling, setFilling] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [metricKey, setMetricKey] = useState<MetricKey>("diagnoses");
  const latest = useRef(0);

  const load = useCallback(async (target: string) => {
    const request = ++latest.current;
    // 今月を見ているときだけ、今日の途中の数字を別に取る (表を待たせないよう、並行で)。
    if (target === todayInJst().slice(0, 7)) {
      void fetchToday().then(
        (payload) => {
          if (request === latest.current) setTodayPayload(payload);
        },
        () => undefined,
      );
    }
    try {
      const daily = await fetchDaily(target);
      if (request !== latest.current) return;
      if (daily === "not_installed") {
        setStatus("not_installed");
        return;
      }
      setData(daily);
      setStatus("ready");
    } catch {
      if (request === latest.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const asked = new URLSearchParams(window.location.search).get("month");
      const target =
        asked && /^\d{4}-\d{2}$/.test(asked) ? asked : todayInJst().slice(0, 7);
      setMonth(target);
      await load(target);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const show = (target: string) => {
    setMonth(target);
    setData(null);
    setTodayPayload(null);
    setFilled({});
    setFailed({});
    setFilling(null);
    setPaused(false);
    setStatus("loading");
    void load(target);
  };

  // まだ数えていない、終わった日。新しい日から順に 1 日ずつ数えさせる。
  const pendingDays = data
    ? data.days
        .filter(
          (entry) =>
            !entry.counted &&
            entry.day < data.today &&
            !filled[entry.day] &&
            !failed[entry.day],
        )
        .map((entry) => entry.day)
        .sort()
        .reverse()
    : [];
  const nextDay = pendingDays[0] ?? null;
  useEffect(() => {
    if (!nextDay || paused) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setFilling(nextDay);
      let block: NumbersDayBlock | null = null;
      // 時間切れで失敗しても、読んだ分は DB のキャッシュに残る。もう 1 回だけ試す。
      for (let attempt = 0; attempt < 2 && !block; attempt += 1) {
        try {
          block = await fetchBlock(nextDay);
        } catch {
          block = null;
        }
        if (cancelled) return;
      }
      if (block) {
        const counted: Filled = {
          amounts: dailyAmounts(block.hours),
          cohort: block.cohort,
        };
        setFilled((current) => ({ ...current, [nextDay]: counted }));
      } else {
        setFailed((current) => ({ ...current, [nextDay]: true }));
      }
      setFilling(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [nextDay, paused]);

  const today = todayInJst();
  const currentMonth = today.slice(0, 7);
  const shownMonth = month ?? currentMonth;

  // 日付の古い順 (グラフ用)。表は新しい順に並べ替えて出す。
  const rows = useMemo<NumbersDailyRow[]>(() => {
    if (!data) return [];
    return data.days.map((entry) => {
      if (entry.day === data.today) {
        if (!todayPayload || todayPayload.meta.day !== entry.day) {
          return buildDailyRow(entry.day, null, null, null, data.settings);
        }
        const costs = todayPayload.costs?.day;
        return buildDailyRow(
          entry.day,
          todayPayload.day.until_cut,
          todayPayload.day.cohort,
          costs
            ? {
                ...costUntil(costs, todayPayload.meta.elapsed_seconds / 3600),
                has_actual: costs.has_actual,
              }
            : null,
          data.settings,
        );
      }
      const counted = filled[entry.day];
      return buildDailyRow(
        entry.day,
        entry.totals ?? counted?.amounts ?? null,
        entry.cohort ?? counted?.cohort ?? null,
        entry.cost,
        data.settings,
      );
    });
  }, [data, todayPayload, filled]);

  const uncountedAtLoad = data
    ? data.days.filter((entry) => !entry.counted && entry.day < data.today)
        .length
    : 0;
  const failedCount = Object.keys(failed).length;
  const fillDone = Object.keys(filled).length + failedCount;
  const metric = METRICS.find((item) => item.key === metricKey) ?? METRICS[0];
  const loading = status === "loading";
  const [year, monthIndex] = shownMonth.split("-").map(Number);

  return (
    <main
      className="min-h-dvh flex-1 touch-manipulation bg-[var(--nb-bg)] pb-12 font-medium text-[var(--nb-text)] antialiased"
      style={NUMBERS_THEMES[theme]}
      data-theme={theme}
    >
      <header className="sticky top-0 z-30 border-b border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-bg)_82%,transparent)] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 xl:px-8">
          <div className="mr-auto flex min-w-0 items-center gap-3">
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              数値
            </h1>
            <div className="hidden sm:block">
              <NumbersNav current="month" />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="前の月"
              disabled={shownMonth <= NUMBERS_EARLIEST_DAY.slice(0, 7)}
              onClick={() => show(shiftNumbersMonth(shownMonth, -1))}
              className={`flex ${NAV_BUTTON}`}
            >
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M10 3 5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <p
              aria-live="polite"
              className="min-w-[7.5rem] text-center text-base font-bold tabular-nums"
            >
              {year}年{monthIndex}月
            </p>
            <button
              type="button"
              aria-label="次の月"
              disabled={shownMonth >= currentMonth}
              onClick={() => show(shiftNumbersMonth(shownMonth, 1))}
              className={`flex ${NAV_BUTTON}`}
            >
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="m6 3 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} variant="icon" />
          <button
            type="button"
            onClick={() => show(shownMonth)}
            disabled={loading}
            aria-busy={loading}
            className="flex h-9 min-w-9 items-center justify-center gap-2 rounded-lg bg-[var(--nb-text)] px-2.5 text-base font-bold text-[var(--nb-bg)] transition-opacity hover:opacity-90 disabled:opacity-70 sm:min-w-[6.5rem] sm:px-4"
          >
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              className={loading ? "animate-spin" : ""}
            >
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="sr-only sm:not-sr-only">
              {loading ? "更新中..." : "更新"}
            </span>
          </button>
        </div>
      </header>
      {/* スマホではヘッダーに収まらないので、行き来のタブはその下に置く (固定しない)。 */}
      <div className="px-4 pt-3 sm:hidden">
        <NumbersNav current="month" />
      </div>

      <div className="grid gap-4 px-4 pt-5 sm:px-6 xl:gap-5 xl:px-8">
        {status === "not_installed" && (
          <p
            role="alert"
            className="rounded-2xl border border-[var(--nb-border-strong)] bg-[var(--nb-surface)] px-5 py-6 text-base leading-relaxed"
          >
            月の推移を出すための準備（データベースへのSQLの追加）が、まだ済んでいません。
          </p>
        )}
        {status === "error" && (
          <p
            role="alert"
            className="rounded-2xl border border-[var(--nb-down)] bg-[var(--nb-surface)] px-5 py-6 text-base leading-relaxed"
          >
            数字を取得できませんでした。
            <button
              type="button"
              onClick={() => show(shownMonth)}
              className="ml-2 font-bold underline"
            >
              もう一度試す
            </button>
          </p>
        )}
        {loading && !data && <DailySkeleton />}

        {data && status === "ready" && (
          <>
            {uncountedAtLoad > 0 && (
              <FillNotice
                total={uncountedAtLoad}
                done={fillDone}
                failed={failedCount}
                filling={filling}
                paused={paused}
                onPause={() => setPaused(true)}
                onResume={() => setPaused(false)}
                onRetry={() => {
                  setFailed({});
                  setPaused(false);
                }}
              />
            )}
            <MonthSummary rows={rows} today={data.today} />
            <Card
              title={`${metric.label}の推移`}
              hint={metric.hint}
              action={
                <div
                  role="tablist"
                  aria-label="グラフに出す項目"
                  className="flex flex-wrap gap-1 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-0.5"
                >
                  {METRICS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={item.key === metric.key}
                      onClick={() => setMetricKey(item.key)}
                      className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                        item.key === metric.key
                          ? "bg-[var(--nb-surface-2)] text-[var(--nb-text)] shadow-[inset_0_0_0_1px_var(--nb-border-strong)]"
                          : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="px-3 pb-4 sm:px-5">
                <DailyChart
                  rows={rows}
                  month={shownMonth}
                  metric={metric}
                  today={data.today}
                />
              </div>
            </Card>
            <DailyTable
              rows={rows}
              today={data.today}
              filling={filling}
              failed={failed}
              todayLoaded={todayPayload !== null}
            />
          </>
        )}
      </div>
      <ThemeToggle theme={theme} onToggle={toggleTheme} variant="wide" />
    </main>
  );
}

function DailySkeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-4 xl:gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-5">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-surface)]"
          />
        ))}
      </div>
      <div className="h-80 rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-surface)]" />
      <div className="h-96 rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-surface)]" />
    </div>
  );
}

/** まだ数えていない日を、1 日ずつ数えているときの知らせ。 */
function FillNotice({
  total,
  done,
  failed,
  filling,
  paused,
  onPause,
  onResume,
  onRetry,
}: {
  total: number;
  done: number;
  failed: number;
  filling: string | null;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
}) {
  const finished = done >= total;
  // すべて数え終わって失敗も無ければ、知らせは出さない。
  if (finished && failed === 0) return null;
  const button =
    "h-9 shrink-0 rounded-lg border border-[var(--nb-border-strong)] px-3.5 text-sm font-bold text-[var(--nb-text)] transition-colors hover:bg-[var(--nb-surface-2)]";
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[var(--nb-border-strong)] bg-[var(--nb-surface)] px-5 py-4"
    >
      <div className="mr-auto min-w-0">
        <p className="text-base font-bold">
          {finished
            ? `集計できなかった日が ${failed} 日あります`
            : `まだ集計していない日を、1日ずつ集計しています（${done} / ${total} 日）`}
        </p>
        <p className="mt-0.5 text-sm text-[var(--nb-text-2)]">
          {finished
            ? "時間をおいて、もう一度試してください。"
            : `古い日は1日あたり10〜20秒かかります。一度集計した日は、次からすぐ出ます。${
                filling
                  ? `いまは ${formatNumbersDay(filling)} を集計中です。`
                  : ""
              }`}
        </p>
        {!finished && (
          <div className="mt-3 h-2 max-w-xl rounded-full bg-[var(--nb-surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--nb-accent)] transition-[width] duration-500 ease-out"
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        )}
      </div>
      {finished ? (
        <button type="button" className={button} onClick={onRetry}>
          もう一度試す
        </button>
      ) : paused ? (
        <button type="button" className={button} onClick={onResume}>
          再開する
        </button>
      ) : (
        <button type="button" className={button} onClick={onPause}>
          止める
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- 月の合計 */

function MonthSummary({
  rows,
  today,
}: {
  rows: NumbersDailyRow[];
  today: string;
}) {
  const total = sumDailyRows(rows);
  const includesToday = rows.some((row) => row.day === today && row.amounts);
  const hasCost = total.costDays > 0;
  const tiles = [
    {
      label: "診断数",
      value: numberFormat.format(total.amounts.diagnoses),
      note:
        total.days > 0
          ? `1日平均 ${numberFormat.format(Math.round(total.amounts.diagnoses / total.days))}`
          : "",
    },
    {
      label: "純売上",
      value: signedYen(total.amounts.net),
      note:
        total.days > 0
          ? `1日平均 ${signedYen(total.amounts.net / total.days)}`
          : "",
    },
    {
      label: "買い切り",
      value: numberFormat.format(total.amounts.purchases_full),
      note: `課金率 ${percent(total.rate, 2)}`,
    },
    {
      label: "広告費",
      value: hasCost ? signedYen(total.cost) : "–",
      note: !hasCost
        ? "未入力"
        : total.costPlan > 0
          ? `うち推定 ${signedYen(total.costPlan)}`
          : "すべて実績",
    },
    {
      label: "利益",
      value: hasCost ? signedYen(total.profit) : "–",
      tone: hasCost
        ? total.profit < 0
          ? "var(--nb-down)"
          : "var(--nb-up)"
        : undefined,
      note: hasCost ? `広告費が分かる ${total.costDays} 日分` : "",
    },
    {
      label: "CPA",
      value: total.cpaAd === null ? "–" : unitYen(total.cpaAd),
      note: "広告流入の診断1件",
    },
  ];
  return (
    <section aria-label="月の合計">
      <p className="mb-3 text-sm text-[var(--nb-text-2)]">
        月の合計（数字がある{" "}
        <span className="font-bold text-[var(--nb-text)]">{total.days}</span>{" "}
        日分{includesToday ? "。今日の途中までを含みます" : ""}）
      </p>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-5">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="min-w-0 rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-surface)] px-4 py-4 xl:px-6 xl:py-5"
          >
            <dt className="text-base font-bold text-[var(--nb-text)]">
              {tile.label}
            </dt>
            <dd className="mt-3">
              <span
                className="block whitespace-nowrap text-[1.5rem] font-bold leading-none tracking-tight tabular-nums sm:text-[1.75rem] xl:text-[2.125rem]"
                style={{ color: tile.tone ?? "var(--nb-text)" }}
              >
                {tile.value}
              </span>
              <span className="mt-2 block min-h-5 text-sm leading-snug tabular-nums text-[var(--nb-text-2)]">
                {tile.note}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------------------------------------------------------------- グラフ */

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const lead = value / power;
  const step =
    lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 2.5 ? 2.5 : lead <= 5 ? 5 : 10;
  return step * power;
}

function DailyChart({
  rows,
  month,
  metric,
  today,
}: {
  rows: NumbersDailyRow[];
  month: string;
  metric: Metric;
  today: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const byDay = new Map(rows.map((row) => [Number(row.day.slice(8)), row]));
  const points = Array.from({ length: daysInMonth }, (_, index) => {
    const row = byDay.get(index + 1) ?? null;
    return { date: index + 1, row, value: row ? metric.pick(row) : null };
  });
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null);

  const narrow = width > 0 && width < 640;
  const height = narrow ? 240 : 340;
  const pad = { top: 16, right: 12, bottom: 30, left: narrow ? 52 : 72 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const top = niceCeil(Math.max(0, ...values));
  const low = Math.min(0, ...values);
  const bottom = low < 0 ? -niceCeil(-low) : 0;
  const y = (value: number) =>
    pad.top + plotH * (1 - (value - bottom) / (top - bottom));
  const slot = plotW / daysInMonth;
  const x = (index: number) => pad.left + slot * (index + 0.5);
  const barWidth = Math.max(2, Math.min(slot * 0.62, 30));
  const ticks = bottom < 0 ? [bottom, 0, top] : [0, top / 2, top];
  const labelEvery = slot >= 24 ? 1 : slot >= 12 ? 2 : 5;
  const linePoints = points
    .map((point, index) =>
      point.value === null ? null : `${x(index)},${y(point.value)}`,
    )
    .filter((point): point is string => point !== null)
    .join(" ");
  const hovered = hover === null ? null : points[hover];

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && values.length === 0 && (
        <p className="absolute inset-0 flex items-center justify-center text-base text-[var(--nb-text-2)]">
          この月の数字は、まだありません
        </p>
      )}
      {width > 0 && values.length > 0 && (
        <svg
          role="img"
          aria-label={`${monthIndex}月の${metric.label}の推移`}
          width={width}
          height={height}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={
                  tick === 0 ? "var(--nb-border-strong)" : "var(--nb-border)"
                }
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize={13}
                fill="var(--nb-text-2)"
              >
                {metric.format(tick)}
              </text>
            </g>
          ))}
          {hover !== null && (
            <rect
              x={pad.left + slot * hover}
              y={pad.top}
              width={slot}
              height={plotH}
              fill="var(--nb-surface-2)"
            />
          )}
          {metric.shape === "bar" &&
            points.map((point, index) =>
              point.value === null ? null : (
                <rect
                  key={point.date}
                  x={x(index) - barWidth / 2}
                  y={Math.min(y(point.value), y(0))}
                  width={barWidth}
                  height={Math.max(1, Math.abs(y(point.value) - y(0)))}
                  rx={Math.min(3, barWidth / 2)}
                  fill={point.value < 0 ? "var(--nb-down)" : "var(--nb-accent)"}
                  // 今日は途中なので、薄くして区別する。
                  opacity={point.row?.day === today ? 0.45 : 1}
                />
              ),
            )}
          {metric.shape === "line" && (
            <>
              <polyline
                points={linePoints}
                fill="none"
                stroke="var(--nb-accent)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((point, index) =>
                point.value === null ? null : (
                  <circle
                    key={point.date}
                    cx={x(index)}
                    cy={y(point.value)}
                    r={4}
                    fill={
                      point.row?.day === today
                        ? "var(--nb-surface)"
                        : "var(--nb-accent)"
                    }
                    stroke="var(--nb-accent)"
                    strokeWidth={2}
                  />
                ),
              )}
            </>
          )}
          {points.map((point, index) =>
            point.date === 1 ||
            point.date % labelEvery === 0 ||
            point.date === daysInMonth ? (
              <text
                key={point.date}
                x={x(index)}
                y={height - 9}
                textAnchor="middle"
                fontSize={13}
                fill="var(--nb-text-2)"
              >
                {point.date}
              </text>
            ) : null,
          )}
          {/* 触れた日を見分けるための、見えない当たり判定。 */}
          {points.map((point, index) => (
            <rect
              key={point.date}
              x={pad.left + slot * index}
              y={pad.top}
              width={slot}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onClick={() => setHover(index)}
            />
          ))}
        </svg>
      )}
      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-[var(--nb-border-strong)] bg-[var(--nb-surface)] px-3.5 py-2.5 text-sm shadow-lg"
          style={{
            left: Math.min(
              Math.max(8, pad.left + slot * (hover + 0.5) - 80),
              Math.max(8, width - 190),
            ),
          }}
        >
          <p className="text-[var(--nb-text-2)]">
            {hovered.row
              ? formatNumbersDay(hovered.row.day)
              : `${monthIndex}/${hovered.date}`}
            {hovered.row?.day === today ? "（途中）" : ""}
          </p>
          <p className="mt-0.5 text-base font-bold tabular-nums">
            {metric.label}{" "}
            {hovered.value === null ? "–" : metric.format(hovered.value)}
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- 表 */

/** 0 の値は薄くする (表の中で、意味のある数字だけが目に入るように)。 */
const quiet = (value: number | null | undefined) =>
  value === 0 ? "text-[var(--nb-text-3)]" : "";

function DailyTable({
  rows,
  today,
  filling,
  failed,
  todayLoaded,
}: {
  rows: NumbersDailyRow[];
  today: string;
  filling: string | null;
  failed: Record<string, true>;
  todayLoaded: boolean;
}) {
  const head = [
    "日付",
    "診断数",
    "純売上",
    "買い切り",
    "課金率",
    "診断あたり",
    "広告費",
    "利益",
    "CPA",
    "非広告比率",
    "友達診断率",
    "シェア率",
  ];
  const cell =
    "whitespace-nowrap border-b border-[var(--nb-border)] px-3.5 py-3 text-right tabular-nums";
  const first =
    "sticky left-0 whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface)] px-3.5 py-3 text-left font-bold tabular-nums";
  // 新しい日を上に。
  const ordered = [...rows].reverse();
  return (
    <Card
      title="日ごとの数字"
      hint="日付を押すと、その日の詳しい数字に移ります。広告費の「推定」は、配信計画の金額で補った分を含む日です"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-base">
          <thead>
            <tr>
              {head.map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={`whitespace-nowrap border-y border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-3.5 py-2.5 text-sm font-bold text-[var(--nb-text-2)] ${
                    index === 0 ? "sticky left-0 z-[1] text-left" : "text-right"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const isToday = row.day === today;
              const date = (
                <th scope="row" className={first}>
                  <Link
                    href={
                      isToday
                        ? "/internal/numbers"
                        : `/internal/numbers?day=${row.day}`
                    }
                    className="underline decoration-[var(--nb-border-strong)] underline-offset-4 hover:decoration-[var(--nb-text)]"
                  >
                    {formatNumbersDay(row.day)}
                  </Link>
                  {isToday && (
                    <span className="ml-2 rounded-full border border-[var(--nb-border-strong)] px-1.5 py-px text-[13px] font-normal text-[var(--nb-text-2)]">
                      途中
                    </span>
                  )}
                </th>
              );
              if (!row.amounts) {
                return (
                  <tr key={row.day}>
                    {date}
                    <td
                      colSpan={head.length - 1}
                      className={`${cell} text-left text-sm text-[var(--nb-text-2)]`}
                    >
                      {isToday
                        ? todayLoaded
                          ? "今日の数字を取得できませんでした"
                          : "読み込んでいます..."
                        : failed[row.day]
                          ? "集計できませんでした"
                          : filling === row.day
                            ? "集計しています..."
                            : "集計を待っています"}
                    </td>
                  </tr>
                );
              }
              const profit = row.economics?.profit ?? null;
              return (
                <tr key={row.day} className="hover:bg-[var(--nb-surface-2)]">
                  {date}
                  <td className={`${cell} font-bold`}>
                    {numberFormat.format(row.amounts.diagnoses)}
                  </td>
                  <td className={`${cell} font-bold ${quiet(row.amounts.net)}`}>
                    {signedYen(row.amounts.net)}
                  </td>
                  <td
                    className={`${cell} ${quiet(row.amounts.purchases_full)}`}
                  >
                    {numberFormat.format(row.amounts.purchases_full)}
                  </td>
                  <td
                    className={`${cell} ${quiet(row.amounts.purchases_full)}`}
                  >
                    {percent(row.rate, 2)}
                  </td>
                  <td className={`${cell} ${quiet(row.amounts.net)}`}>
                    {row.perDiagnosis === null
                      ? "–"
                      : unitYen(row.perDiagnosis)}
                  </td>
                  <td className={cell}>
                    {row.cost === null ? (
                      <span className="text-[var(--nb-text-3)]">未入力</span>
                    ) : (
                      <>
                        {row.costPlan > 0 && (
                          <span className="mr-2 text-[13px] text-[var(--nb-text-3)]">
                            {row.costPlan >= row.cost ? "推定" : "一部推定"}
                          </span>
                        )}
                        {signedYen(row.cost)}
                      </>
                    )}
                  </td>
                  <td
                    className={`${cell} font-bold`}
                    style={{
                      color:
                        profit === null
                          ? undefined
                          : profit < 0
                            ? "var(--nb-down)"
                            : "var(--nb-up)",
                    }}
                  >
                    {profit === null ? (
                      <span className="font-medium text-[var(--nb-text-3)]">
                        –
                      </span>
                    ) : (
                      signedYen(profit)
                    )}
                  </td>
                  <td className={cell}>
                    {row.economics?.cpaAd == null ? (
                      <span className="text-[var(--nb-text-3)]">–</span>
                    ) : (
                      unitYen(row.economics.cpaAd)
                    )}
                  </td>
                  <td className={cell}>{percent(row.nonAdShare)}</td>
                  <td className={cell}>{percent(row.friendRate)}</td>
                  <td className={cell}>{percent(row.shareRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {ordered.length === 0 && (
          <p className="px-4 py-10 text-center text-base text-[var(--nb-text-2)]">
            この月の数字は、まだありません
          </p>
        )}
      </div>
    </Card>
  );
}
