"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  HEADLINES,
  NUMBERS_EARLIEST_DAY,
  formatNumbersClock,
  formatNumbersDay,
  isNumbersCatchingUp,
  shiftNumbersDay,
  todayInJst,
  type HeadlineKey,
  type HeadlineSeriesMode,
  type NumbersPayload,
} from "@/lib/internal-numbers";

import { NumbersHourlyChart } from "./NumbersHourlyChart";
import {
  FriendFlowCard,
  FunnelCard,
  HoursCard,
  KpiRow,
  SocialCards,
  SourcesCard,
} from "./NumbersSections";
import {
  Card,
  NUMBERS_THEME,
  Segmented,
  numberFormat,
  yen,
} from "./numbers-ui";

// 今日の表示だけ、前回の結果を端末に控えておく。開いた瞬間に前回の数字を出し、
// 取り直せたら差し替える (集計済みの数字だけで、個人を特定する値は含まない)。
const CACHE_KEY = "wt_internal_numbers_v1";

// catching_up: 数字は出せているが、ファネルの集計がまだ途中で、続きを数えさせている。
type Status = "loading" | "catching_up" | "ready" | "error";

// 古い日のイベントは DB のキャッシュに載っておらず、初めて読むと時間がかかる。
// 途中まで数えた結果が返ってきたら、数え終わるまで自動で呼び直す。
const CATCH_UP_LIMIT = 60;
const CATCH_UP_PAUSE_MS = 300;
// 時間切れで失敗した呼び出しも、読んだ分は DB のキャッシュに残る。1 回だけ自動でやり直す。
const AUTO_RETRIES = 1;

const pause = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

function readCache(): NumbersPayload | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as NumbersPayload;
    return cached?.meta?.day === todayInJst() ? cached : null;
  } catch {
    return null;
  }
}

function writeCache(payload: NumbersPayload): void {
  try {
    if (payload.meta.is_today) {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }
  } catch {
    // 保存できない端末 (プライベートブラウズ等) では、毎回取り直すだけ。
  }
}

async function fetchNumbers(day: string | null): Promise<NumbersPayload> {
  const response = await fetch(
    `/api/internal/numbers${day ? `?day=${day}` : ""}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (!response.ok) throw new Error(`numbers ${response.status}`);
  return (await response.json()) as NumbersPayload;
}

export function NumbersDashboard() {
  // null は「今日」。日付を固定すると、日をまたいだあとも前日を見続けてしまうため。
  const [day, setDay] = useState<string | null>(null);
  const [payload, setPayload] = useState<NumbersPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [metricKey, setMetricKey] = useState<HeadlineKey>("diagnoses");
  const [mode, setMode] = useState<HeadlineSeriesMode>("hourly");
  const latestRequest = useRef(0);

  const load = useCallback(async (target: string | null) => {
    const request = ++latestRequest.current;
    let failures = 0;
    for (let round = 0; round <= CATCH_UP_LIMIT; round += 1) {
      let next: NumbersPayload;
      try {
        next = await fetchNumbers(target);
      } catch {
        if (request !== latestRequest.current) return;
        failures += 1;
        if (failures > AUTO_RETRIES) {
          setStatus("error");
          return;
        }
        continue;
      }
      if (request !== latestRequest.current) return; // 古い応答は捨てる
      setPayload(next);
      writeCache(next);
      if (!isNumbersCatchingUp(next) || round === CATCH_UP_LIMIT) {
        setStatus("ready");
        return;
      }
      setStatus("catching_up");
      await pause(CATCH_UP_PAUSE_MS);
      if (request !== latestRequest.current) return;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // 端末の控えは描画後にしか読めない (サーバー側には無い) ので、ここで読む。
      const cached = await Promise.resolve(readCache());
      if (cancelled) return;
      if (cached) setPayload((current) => current ?? cached);
      await load(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const show = (target: string | null) => {
    setDay(target);
    setStatus("loading");
    void load(target);
  };

  const today = todayInJst();
  const shownDay = payload?.meta.day ?? day ?? today;
  const loading = status === "loading";
  const busy = loading || status === "catching_up";
  // 取り直し中に見えているのが、別の日の数字や端末の控えのときは、そう分かるようにする。
  const stale = loading && payload !== null;
  const live = payload?.meta.is_today === true && status === "ready";
  const navButton =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--nb-border)] text-[var(--nb-text)] transition-colors hover:border-[var(--nb-border-strong)] hover:bg-[var(--nb-surface-2)] disabled:pointer-events-none disabled:opacity-30";

  return (
    <main
      className="min-h-dvh flex-1 bg-[var(--nb-bg)] pb-10 text-[var(--nb-text)]"
      style={NUMBERS_THEME}
    >
      <header className="sticky top-0 z-30 border-b border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-bg)_82%,transparent)] backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 xl:px-8">
          {/* スマホでは見出しと時刻を縦に重ね、日付の操作と更新ボタンを同じ行に収める。 */}
          <div className="mr-auto flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              数値
            </h1>
            <p
              className="flex min-w-0 items-center gap-2 text-xs text-[var(--nb-text-2)]"
              aria-live="polite"
            >
              {payload ? (
                <>
                  <span
                    aria-hidden
                    className={`h-2 w-2 shrink-0 rounded-full ${live ? "animate-pulse" : ""}`}
                    style={{
                      background: live
                        ? "var(--nb-up)"
                        : "var(--nb-border-strong)",
                    }}
                  />
                  <span className="truncate tabular-nums">
                    {payload.meta.is_today
                      ? `${formatNumbersClock(payload.meta.generated_at)} 時点`
                      : `${formatNumbersDay(payload.meta.day)} の1日分`}
                    {stale ? " ・ 取り直しています..." : ""}
                    {status === "catching_up"
                      ? " ・ ファネルを集計しています..."
                      : ""}
                  </span>
                </>
              ) : loading ? (
                "読み込んでいます..."
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {shownDay !== today && (
              <button
                type="button"
                onClick={() => show(null)}
                className="h-9 rounded-lg border border-[var(--nb-border)] px-3 text-sm font-bold transition-colors hover:border-[var(--nb-border-strong)] hover:bg-[var(--nb-surface-2)]"
              >
                今日
              </button>
            )}
            <button
              type="button"
              aria-label="前の日"
              disabled={shownDay <= NUMBERS_EARLIEST_DAY}
              onClick={() => show(shiftNumbersDay(shownDay, -1))}
              className={navButton}
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
            <label>
              <span className="sr-only">表示する日</span>
              <input
                type="date"
                value={shownDay}
                min={NUMBERS_EARLIEST_DAY}
                max={today}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) show(value >= today ? null : value);
                }}
                className="h-9 w-[8.6rem] rounded-lg border border-[var(--nb-border)] bg-transparent px-2 text-sm tabular-nums text-[var(--nb-text)] transition-colors hover:border-[var(--nb-border-strong)] sm:w-auto sm:px-2.5"
              />
            </label>
            <button
              type="button"
              aria-label="次の日"
              disabled={shownDay >= today}
              onClick={() => {
                const next = shiftNumbersDay(shownDay, 1);
                show(next >= today ? null : next);
              }}
              className={navButton}
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

          <button
            type="button"
            onClick={() => show(day)}
            disabled={busy}
            aria-busy={busy}
            className="flex h-9 min-w-9 items-center justify-center gap-2 rounded-lg bg-[var(--nb-text)] px-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-70 sm:min-w-[6.5rem] sm:px-4"
          >
            <svg
              aria-hidden
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              className={busy ? "animate-spin" : ""}
            >
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {/* スマホでは日付の操作と1行に収めるため、文字は読み上げ用にだけ残す。 */}
            <span className="sr-only sm:not-sr-only">
              {busy ? "更新中..." : "更新"}
            </span>
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 sm:px-6 xl:px-8 xl:pt-6">
        {status === "error" && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--nb-down)_45%,transparent)] bg-[color-mix(in_srgb,var(--nb-down)_10%,transparent)] px-4 py-3 text-sm"
          >
            <span className="mr-auto">
              数字を取得できませんでした。
              {payload ? "表示しているのは前回の数字です。" : ""}
            </span>
            <button
              type="button"
              onClick={() => show(day)}
              className="rounded-lg border border-[color-mix(in_srgb,var(--nb-down)_45%,transparent)] px-3 py-1.5 font-bold"
            >
              もう一度試す
            </button>
          </div>
        )}

        {payload ? (
          <Body
            payload={payload}
            metricKey={metricKey}
            onMetric={setMetricKey}
            mode={mode}
            onMode={setMode}
            dimmed={stale}
          />
        ) : loading ? (
          <Skeleton />
        ) : null}
      </div>
    </main>
  );
}

function Skeleton() {
  const block =
    "animate-pulse rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-surface)]";
  return (
    <div aria-hidden className="grid gap-3 xl:gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:gap-4">
        {HEADLINES.map((item, index) => (
          <div
            key={item.key}
            className={`${block} h-36 ${index === 0 ? "col-span-2 md:col-span-1" : ""}`}
          />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
        <div className={`${block} h-[26rem] xl:col-span-8`} />
        <div className={`${block} h-[26rem] xl:col-span-4`} />
      </div>
    </div>
  );
}

function Body({
  payload,
  metricKey,
  onMetric,
  mode,
  onMode,
  dimmed,
}: {
  payload: NumbersPayload;
  metricKey: HeadlineKey;
  onMetric: (key: HeadlineKey) => void;
  mode: HeadlineSeriesMode;
  onMode: (mode: HeadlineSeriesMode) => void;
  dimmed: boolean;
}) {
  const { meta, day, compare } = payload;
  const metric =
    HEADLINES.find((item) => item.key === metricKey) ?? HEADLINES[0];
  const nowHours = meta.is_today
    ? Math.min(24, meta.elapsed_seconds / 3600)
    : null;
  const currentHour =
    nowHours === null ? null : Math.min(23, Math.floor(nowHours));
  const dayLabel = formatNumbersDay(meta.day);
  const compareLabel = formatNumbersDay(meta.compare_day);
  const lastFullHour = currentHour === null ? null : currentHour - 1;
  const lastFull =
    lastFullHour !== null && lastFullHour >= 0 ? day.hours[lastFullHour] : null;
  const lastFullBefore = lastFull ? compare.hours[lastFull.h] : null;

  return (
    <div
      className={`grid gap-3 transition-opacity duration-200 xl:gap-4 ${dimmed ? "opacity-50" : ""}`}
    >
      <KpiRow
        day={day}
        compare={compare}
        selected={metric.key}
        onSelect={onMetric}
        compareNote={meta.is_today ? `${compareLabel} 同時刻` : compareLabel}
        currentHour={currentHour}
        nowHours={nowHours}
      />

      <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
        <Card
          title={metric.label}
          hint={metric.hint}
          className="xl:col-span-8"
          action={
            <Segmented
              label="グラフの見方"
              value={mode}
              onChange={onMode}
              options={[
                { value: "hourly", label: "時間別" },
                { value: "cumulative", label: "累計" },
              ]}
            />
          }
        >
          <div className="px-3 pb-2 sm:px-4">
            <NumbersHourlyChart
              metric={metric}
              mode={mode}
              hours={day.hours}
              compareHours={compare.hours}
              dayLabel={dayLabel}
              compareLabel={compareLabel}
              currentHour={currentHour}
              nowHours={nowHours}
            />
          </div>
          {lastFull && lastFullBefore && (
            <div className="mt-auto border-t border-[var(--nb-border)] sm:flex sm:items-stretch">
              <p className="px-4 pt-3 text-xs font-bold text-[var(--nb-text-2)] sm:flex sm:w-40 sm:shrink-0 sm:items-center sm:px-5 sm:pt-0">
                直近1時間（{lastFull.h}時台）
              </p>
              <dl className="grid flex-1 grid-cols-3 sm:divide-x sm:divide-[var(--nb-border)] sm:border-l sm:border-[var(--nb-border)]">
                {[
                  {
                    label: "診断数",
                    now: numberFormat.format(lastFull.diagnoses),
                    before: numberFormat.format(lastFullBefore.diagnoses),
                  },
                  {
                    label: "純売上",
                    now: yen(lastFull.net),
                    before: yen(lastFullBefore.net),
                  },
                  {
                    label: "買い切り",
                    now: numberFormat.format(lastFull.purchases_full),
                    before: numberFormat.format(lastFullBefore.purchases_full),
                  },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 px-4 py-3 sm:px-5">
                    <dt className="text-xs text-[var(--nb-text-2)]">
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 tabular-nums">
                      <span className="text-lg font-bold">{item.now}</span>
                      <span className="block truncate text-xs text-[var(--nb-text-2)] sm:ml-2 sm:inline">
                        {compareLabel} {item.before}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>

        <FunnelCard
          day={day}
          compare={compare}
          compareLabel={compareLabel}
          partial={isNumbersCatchingUp(payload)}
          className="xl:col-span-4"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
        <HoursCard
          day={day}
          compare={compare}
          currentHour={currentHour}
          compareLabel={compareLabel}
          className="xl:col-span-7"
        />
        <SourcesCard day={day} className="xl:col-span-5" />
      </div>

      <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
        <FriendFlowCard
          day={day}
          compare={compare}
          compareLabel={compareLabel}
          className="xl:col-span-8"
        />
        <SocialCards
          day={day}
          compare={compare}
          compareLabel={compareLabel}
          className="xl:col-span-4"
        />
      </div>
    </div>
  );
}
