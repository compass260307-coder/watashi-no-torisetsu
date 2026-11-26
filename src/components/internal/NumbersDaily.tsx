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
  SERVER_COST_USD_JPY,
  costUntil,
  dailyAmounts,
  formatNumbersDay,
  shiftNumbersMonth,
  sumDailyRows,
  todayInJst,
  type NumbersAdAccountsDaily,
  type NumbersDailyAmounts,
  type NumbersDailyPayload,
  type NumbersDailyRow,
  type NumbersDayBlock,
  type NumbersPayload,
  type NumbersServerCostsDaily,
} from "@/lib/internal-numbers";

import {
  NUMBERS_GUTTER,
  NUMBERS_MAIN,
  NUMBERS_THEMES,
  NumbersHeader,
  OUTLINE_BUTTON,
  Section,
  Segmented,
  StepButton,
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
    // サーバー費の実額 (円)。取り込みが済んだ日だけ入っている。
    const serverActual = new Map(
      (data.server_costs?.days ?? []).map((entry) => [entry.day, entry.total]),
    );
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
        serverActual.get(entry.day) ?? null,
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
      className={NUMBERS_MAIN}
      style={NUMBERS_THEMES[theme]}
      data-theme={theme}
    >
      <NumbersHeader
        current="month"
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={() => show(shownMonth)}
        busy={loading}
      >
        <div className="flex items-center">
          <StepButton
            direction="previous"
            label="前の月"
            disabled={shownMonth <= NUMBERS_EARLIEST_DAY.slice(0, 7)}
            onClick={() => show(shiftNumbersMonth(shownMonth, -1))}
          />
          <p
            aria-live="polite"
            className="min-w-[6.5rem] text-center text-[15px] font-semibold tabular-nums"
          >
            {year}年{monthIndex}月
          </p>
          <StepButton
            direction="next"
            label="次の月"
            disabled={shownMonth >= currentMonth}
            onClick={() => show(shiftNumbersMonth(shownMonth, 1))}
          />
        </div>
      </NumbersHeader>

      <div className={`grid gap-12 pt-6 sm:pt-7 xl:gap-14 ${NUMBERS_GUTTER}`}>
        {status === "not_installed" && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--nb-surface-2)] px-5 py-5 text-base leading-relaxed"
          >
            月の推移を出すための準備（データベースへのSQLの追加）が、まだ済んでいません。
          </p>
        )}
        {status === "error" && (
          <p
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--nb-down)_9%,transparent)] px-5 py-4 text-base leading-relaxed"
          >
            <span className="mr-auto">数字を取得できませんでした。</span>
            <button
              type="button"
              onClick={() => show(shownMonth)}
              className={OUTLINE_BUTTON}
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
            <MonthSummary
              rows={rows}
              today={data.today}
              month={shownMonth}
              coupon={data.coupon ?? null}
              onCouponSaved={() => void load(shownMonth)}
            />
            <Section
              title={`${metric.label}トレンド`}
              hint={metric.hint}
              plain
              action={
                <div className="max-w-full overflow-x-auto">
                  <Segmented
                    label="グラフに出す項目"
                    value={metric.key}
                    onChange={setMetricKey}
                    options={METRICS.map((item) => ({
                      value: item.key,
                      label: item.label,
                    }))}
                  />
                </div>
              }
            >
              <div className="pt-3">
                <DailyChart
                  rows={rows}
                  month={shownMonth}
                  metric={metric}
                  today={data.today}
                />
              </div>
            </Section>
            <DailyTable
              rows={rows}
              today={data.today}
              filling={filling}
              failed={failed}
              todayLoaded={todayPayload !== null}
            />
            <AdAccountsTable
              data={data.ad_accounts ?? null}
              days={data.days.map((entry) => entry.day)}
              today={data.today}
            />
            <ServerCostsTable
              data={data.server_costs ?? null}
              days={data.days.map((entry) => entry.day)}
            />
          </>
        )}
      </div>
      <ThemeToggle theme={theme} onToggle={toggleTheme} variant="wide" />
    </main>
  );
}

function DailySkeleton() {
  const block = "rounded-xl bg-[var(--nb-surface-2)]";
  return (
    <div aria-hidden className="grid animate-pulse gap-10">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className={`${block} h-20`} />
        ))}
      </div>
      <div className={`${block} h-80`} />
      <div className={`${block} h-96`} />
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
  const button = `${OUTLINE_BUTTON} shrink-0 bg-[var(--nb-bg)]`;
  return (
    <div
      role="status"
      className="-mb-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-[var(--nb-surface-2)] px-5 py-4"
    >
      <div className="mr-auto min-w-0">
        <p className="text-base font-semibold">
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
          <div className="mt-3 h-1 max-w-xl rounded-full bg-[var(--nb-border-strong)]">
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

/** その月に使ったクーポンの額を保存する (null で取り消し)。 */
async function saveCoupon(month: string, amount: number | null): Promise<void> {
  const response = await fetch("/api/internal/numbers/costs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action: "coupon", month, amount }),
  });
  if (!response.ok) throw new Error(`coupon ${response.status}`);
}

/** 月の合計の「クーポン」の入力。その月に X の請求で差し引かれたクーポンの合計を入れる。 */
function CouponEditor({
  month,
  amount,
  onSaved,
}: {
  month: string;
  amount: number | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const parsed = Number(value.replace(/[,，¥￥\s]/g, ""));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const link =
    "text-sm font-semibold text-[var(--nb-accent)] underline-offset-2 hover:underline disabled:opacity-50";

  const submit = async (next: number | null) => {
    setBusy(true);
    setFailed(false);
    try {
      await saveCoupon(month, next);
      setEditing(false);
      onSaved();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          className={link}
          onClick={() => {
            setValue(amount === null ? "" : String(Math.round(amount)));
            setFailed(false);
            setEditing(true);
          }}
        >
          {amount === null ? "入力する" : "直す"}
        </button>
        {amount === null ? <span>この月に使った額</span> : null}
      </span>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !busy) void submit(Math.round(parsed));
      }}
    >
      <label className="sr-only" htmlFor={`coupon-${month}`}>
        この月に使ったクーポンの額 (円)
      </label>
      <input
        id={`coupon-${month}`}
        inputMode="numeric"
        autoFocus
        placeholder="例: 182592"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-8 w-28 rounded-lg border border-[var(--nb-border-strong)] bg-[var(--nb-bg)] px-2 text-sm tabular-nums text-[var(--nb-text)] outline-none focus:border-[var(--nb-accent)]"
      />
      <button type="submit" className={link} disabled={!valid || busy}>
        {busy ? "保存中" : "保存"}
      </button>
      {amount !== null ? (
        <button
          type="button"
          className={link}
          disabled={busy}
          onClick={() => void submit(null)}
        >
          消す
        </button>
      ) : null}
      <button
        type="button"
        className={link}
        disabled={busy}
        onClick={() => setEditing(false)}
      >
        やめる
      </button>
      {failed ? (
        <span className="text-[var(--nb-down)]">保存できませんでした</span>
      ) : null}
    </form>
  );
}

function MonthSummary({
  rows,
  today,
  month,
  coupon,
  onCouponSaved,
}: {
  rows: NumbersDailyRow[];
  today: string;
  month: string;
  /** null なら、保存先がまだ無い (クーポンの欄を出さない)。 */
  coupon: { amount: number | null } | null;
  onCouponSaved: () => void;
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
      // 広告費が推定を含むときは色を付けない (推定の利益を確かな黒字・赤字に見せない)。
      tone:
        hasCost && total.costPlan <= 0
          ? total.profit < 0
            ? "var(--nb-down)"
            : "var(--nb-up)"
          : undefined,
      note: !hasCost
        ? ""
        : total.costPlan > 0
          ? `推定を含む・${total.costDays} 日分`
          : `${total.costDays} 日分`,
    },
    {
      label: "CPA",
      value: total.cpaAd === null ? "–" : unitYen(total.cpaAd),
      note: "広告流入の診断1件",
    },
  ] as {
    label: string;
    value: string;
    tone?: string;
    note: React.ReactNode;
  }[];
  // クーポン (手入力、月ごと)。利益には足し戻した「控除後」も出す。
  if (coupon) {
    const amount = coupon.amount;
    const afterCoupon = total.profit + (amount ?? 0);
    tiles.push(
      {
        label: "クーポン",
        value: amount === null ? "未入力" : signedYen(amount),
        tone: amount === null ? "var(--nb-text-2)" : undefined,
        note: (
          <CouponEditor month={month} amount={amount} onSaved={onCouponSaved} />
        ),
      },
      {
        label: "利益（クーポン込み）",
        value: hasCost && amount !== null ? signedYen(afterCoupon) : "–",
        tone:
          hasCost && amount !== null && total.costPlan <= 0
            ? afterCoupon < 0
              ? "var(--nb-down)"
              : "var(--nb-up)"
            : undefined,
        note: amount === null ? "クーポンを入れると出ます" : "利益 ＋ クーポン",
      },
    );
  }
  return (
    <Section
      title="月の合計"
      note={`${total.days} 日分${includesToday ? "（今日の途中までを含む）" : ""}`}
    >
      {/* 枠や区切り線は使わず、余白だけで並べる。 */}
      <dl
        className={`grid grid-cols-2 gap-x-8 gap-y-8 pt-6 ${
          tiles.length > 6 ? "md:grid-cols-4" : "md:grid-cols-3 xl:grid-cols-6"
        }`}
      >
        {tiles.map((tile) => (
          <div key={tile.label} className="min-w-0">
            <dt className="text-sm text-[var(--nb-text-2)]">{tile.label}</dt>
            <dd className="mt-1">
              <span
                className="block whitespace-nowrap text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.025em] tabular-nums lg:text-[1.875rem] xl:text-[2.125rem]"
                style={{ color: tile.tone ?? "var(--nb-text)" }}
              >
                {tile.value}
              </span>
              <div className="mt-1 min-h-5 text-sm leading-snug tabular-nums text-[var(--nb-text-3)]">
                {tile.note}
              </div>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
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
  const height = narrow ? 240 : 320;
  const pad = { top: 16, right: 4, bottom: 30, left: narrow ? 52 : 72 };
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
                strokeDasharray={tick === 0 ? undefined : "2 4"}
              />
              <text
                x={pad.left - (narrow ? 8 : 12)}
                y={y(tick) + 4.5}
                textAnchor="end"
                fontSize={13}
                fill="var(--nb-text-3)"
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
                  rx={Math.min(4, barWidth / 2)}
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
                fill="var(--nb-text-3)"
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
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3.5 py-2.5 text-[13px] shadow-[var(--nb-shadow)]"
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
          <p className="mt-0.5 text-base font-semibold tabular-nums">
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
  value === 0 ? "text-[var(--nb-faint)]" : "";

// 枠や見出しの地色は使わず、行の下の細い線だけで区切る。左右の端はページの余白にそろえる。
const TABLE_CELL =
  "whitespace-nowrap border-b border-[var(--nb-border)] px-3 py-[11px] text-right tabular-nums last:pr-0";
const TABLE_FIRST =
  "sticky left-0 whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-bg)] py-[11px] pl-0 pr-3 text-left font-medium tabular-nums group-hover:bg-[var(--nb-surface-2)]";
const TABLE_HEAD =
  "whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-2.5 text-[13px] font-medium text-[var(--nb-text-3)] last:pr-0";

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
    "サーバー費",
    "利益",
    "CPA",
    "非広告比率",
    "友達診断率",
    "シェア率",
  ];
  const cell = TABLE_CELL;
  const first = TABLE_FIRST;
  // 新しい日を上に。
  const ordered = [...rows].reverse();
  return (
    <Section
      title="日別実績"
      plain
      hint="日付を押すと、その日の詳しい数字に移ります。広告費の「推定」は、配信計画の金額で補った分を含む日です。サーバー費はVercelの請求額を円に直した実額で、利益から引いています。実額は2日ほど遅れて入るので、それまでは診断1件あたりの単価で出した「概算」です"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-base">
          <thead>
            <tr>
              {head.map((label, index) => (
                <th
                  key={label}
                  scope="col"
                  className={`${TABLE_HEAD} ${
                    index === 0
                      ? "sticky left-0 z-[1] pl-0 text-left"
                      : "text-right"
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
                    className="underline-offset-4 hover:underline"
                  >
                    {formatNumbersDay(row.day)}
                  </Link>
                  {isToday && (
                    <span className="ml-2 rounded-[5px] bg-[var(--nb-surface-2)] px-1.5 py-0.5 text-[13px] font-normal leading-none text-[var(--nb-text-2)]">
                      途中
                    </span>
                  )}
                </th>
              );
              if (!row.amounts) {
                return (
                  <tr key={row.day} className="group">
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
                <tr key={row.day} className="group hover:bg-[var(--nb-surface-2)]">
                  {date}
                  <td className={`${cell} font-semibold`}>
                    {numberFormat.format(row.amounts.diagnoses)}
                  </td>
                  <td className={`${cell} ${quiet(row.amounts.net)}`}>
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
                  <td className={cell}>
                    {row.server === null ? (
                      <span className="text-[var(--nb-text-3)]">–</span>
                    ) : (
                      <>
                        {row.serverEstimated && (
                          <span className="mr-2 text-[13px] text-[var(--nb-text-3)]">
                            概算
                          </span>
                        )}
                        {signedYen(row.server)}
                      </>
                    )}
                  </td>
                  <td
                    className={`${cell} font-semibold`}
                    style={{
                      // 広告費が推定を含む日は色を付けない (推定の利益を確かな黒字・赤字に見せない)。
                      color:
                        profit === null || row.costPlan > 0
                          ? undefined
                          : profit < 0
                            ? "var(--nb-down)"
                            : "var(--nb-up)",
                    }}
                  >
                    {profit === null ? (
                      <span className="font-normal text-[var(--nb-text-3)]">
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
          <p className="py-12 text-center text-base text-[var(--nb-text-2)]">
            この月の数字は、まだありません
          </p>
        )}
      </div>
    </Section>
  );
}

/* ------------------------------------------- 日付 × 内訳の表 (広告費・サーバー費) */

interface BreakdownColumn {
  key: string;
  label: string;
  /** 見出しに指を置いたときに出す、省略しない名前。 */
  title?: string;
  total: number;
}

interface BreakdownDay {
  day: string;
  total: number;
  values: Record<string, number>;
}

/**
 * 日付を縦、内訳 (アカウントやプロジェクト) を横に並べる表。いちばん上に月の合計、
 * 左に全体の合計を置く。金額が無いところは「–」。
 */
function BreakdownTable({
  title,
  hint,
  columns,
  rows,
  days,
  partialDay,
  format,
  failedText,
  emptyText,
}: {
  title: string;
  hint: string;
  /** null は、読めなかった。 */
  columns: BreakdownColumn[] | null;
  rows: BreakdownDay[];
  /** 表に出す日 (上の日別実績と同じ)。 */
  days: string[];
  /** 「途中」と添える日 (無ければ添えない)。 */
  partialDay?: string;
  format: (value: number) => string;
  failedText: string;
  emptyText: string;
}) {
  const none = <span className="text-[var(--nb-faint)]">–</span>;
  const byDay = new Map(rows.map((entry) => [entry.day, entry]));
  const monthTotal = (columns ?? []).reduce(
    (sum, column) => sum + column.total,
    0,
  );
  // 新しい日を上に。
  const ordered = [...days].sort().reverse();
  const total = `${TABLE_CELL} font-semibold`;
  return (
    <Section title={title} plain hint={hint}>
      {!columns ? (
        <p role="alert" className="py-8 text-base text-[var(--nb-text-2)]">
          {failedText}
        </p>
      ) : columns.length === 0 ? (
        <p className="py-12 text-center text-base text-[var(--nb-text-2)]">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-base">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`${TABLE_HEAD} sticky left-0 z-[1] pl-0 text-left`}
                >
                  日付
                </th>
                <th scope="col" className={`${TABLE_HEAD} text-right`}>
                  合計
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    title={column.title}
                    className={`${TABLE_HEAD} text-right`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="group">
                <th scope="row" className={`${TABLE_FIRST} font-semibold`}>
                  月の合計
                </th>
                <td className={total}>{format(monthTotal)}</td>
                {columns.map((column) => (
                  <td key={column.key} className={total}>
                    {format(column.total)}
                  </td>
                ))}
              </tr>
              {ordered.map((day) => {
                const entry = byDay.get(day);
                return (
                  <tr
                    key={day}
                    className="group hover:bg-[var(--nb-surface-2)]"
                  >
                    <th scope="row" className={TABLE_FIRST}>
                      {formatNumbersDay(day)}
                      {day === partialDay && (
                        <span className="ml-2 rounded-[5px] bg-[var(--nb-surface-2)] px-1.5 py-0.5 text-[13px] font-normal leading-none text-[var(--nb-text-2)]">
                          途中
                        </span>
                      )}
                    </th>
                    <td className={`${total} ${quiet(entry?.total)}`}>
                      {entry ? format(entry.total) : none}
                    </td>
                    {columns.map((column) => {
                      const value = entry?.values[column.key];
                      return (
                        <td
                          key={column.key}
                          className={`${TABLE_CELL} ${quiet(value)}`}
                        >
                          {value === undefined ? none : format(value)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** X の広告費の実績を、日付 × アカウントで並べる。 */
function AdAccountsTable({
  data,
  days,
  today,
}: {
  /** null は、読めなかった。 */
  data: NumbersAdAccountsDaily | null;
  days: string[];
  today: string;
}) {
  return (
    <BreakdownTable
      title="X広告費（アカウント別）"
      hint="Xの時間別の実績を、アカウントごとに1日分ずつ足した金額です。配信計画で補った推定、X以外の媒体、クーポンは入りません"
      columns={
        data
          ? data.accounts.map((account) => ({
              key: account.code,
              label: account.name,
              title: `${account.name}（${account.code}）`,
              total: account.total,
            }))
          : null
      }
      rows={(data?.days ?? []).map((entry) => ({
        day: entry.day,
        total: entry.total,
        values: entry.spend,
      }))}
      days={days}
      partialDay={today}
      format={signedYen}
      failedText="アカウント別の広告費を取得できませんでした。"
      emptyText="この月のXの実績は、まだありません"
    />
  );
}

/** サーバー費の実額 (Vercel の請求額を円に直したもの) を、日付 × プロジェクトで並べる。 */
function ServerCostsTable({
  data,
  days,
}: {
  /** null は、読めなかった。 */
  data: NumbersServerCostsDaily | null;
  days: string[];
}) {
  return (
    <BreakdownTable
      title="サーバー費（プロジェクト別）"
      hint={`日別実績の「サーバー費」の内訳です。Vercelの請求額（ドル）を、1ドル${data?.usd_jpy ?? SERVER_COST_USD_JPY}円で円に直しています。Vercelの1日は日本時間の17時に始まるので、時間の比で日本時間の1日に分け直しています。毎朝4:50に取り込み、前後の分がそろった日（おおむね2日前まで）だけ出ます。Supabaseなど、Vercel以外の費用は入りません`}
      columns={
        data
          ? data.projects.map((project) => ({
              key: project.key,
              label: project.name,
              total: project.total,
            }))
          : null
      }
      rows={(data?.days ?? []).map((entry) => ({
        day: entry.day,
        total: entry.total,
        values: entry.cost,
      }))}
      days={days}
      format={signedYen}
      failedText="サーバー費の実額を取得できませんでした。"
      emptyText="この月のサーバー費の実額は、まだ取り込まれていません"
    />
  );
}
