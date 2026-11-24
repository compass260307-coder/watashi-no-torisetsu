"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  HEADLINES,
  MAX_COMPARISONS,
  NUMBERS_EARLIEST_DAY,
  buildComparison,
  comparisonDay,
  DEFAULT_COMPARISON_ID,
  formatNumbersClock,
  formatNumbersDay,
  formatNumbersValue,
  isNumbersCatchingUp,
  isValidNumbersDay,
  shiftNumbersDay,
  sortComparisonIds,
  todayInJst,
  type ComparisonId,
  type HeadlineKey,
  type HeadlineSeriesMode,
  type NumbersComparison,
  type NumbersDayBlock,
  type NumbersPayload,
} from "@/lib/internal-numbers";

import {
  NumbersHourlyChart,
  type NumbersChartType,
} from "./NumbersHourlyChart";
import { NumbersCostEntry } from "./NumbersCostEntry";
import { EconomicsCard } from "./NumbersEconomics";
import { useNumbersTheme } from "./use-numbers-theme";
import {
  FriendFlowCard,
  FunnelCard,
  HoursCard,
  KpiRow,
  SocialCards,
  SourcesCard,
} from "./NumbersSections";
import {
  DateButton,
  GHOST_BASE,
  NUMBERS_GUTTER,
  NUMBERS_MAIN,
  NUMBERS_THEMES,
  NumbersHeader,
  OUTLINE_BUTTON,
  Segmented,
  StepButton,
  ThemeToggle,
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

// 比べる相手として選んだ日の 1 日分。イベントの集計が途中なら、数え終わるまで呼び直す。
async function fetchDayBlock(day: string): Promise<NumbersDayBlock> {
  for (let round = 0; ; round += 1) {
    const response = await fetch(`/api/internal/numbers?block=${day}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`numbers block ${response.status}`);
    const body = (await response.json()) as {
      block: NumbersDayBlock;
      events_complete: boolean;
    };
    if (body.events_complete || round >= CATCH_UP_LIMIT) return body.block;
    await pause(CATCH_UP_PAUSE_MS);
  }
}

export function NumbersDashboard() {
  // null は「今日」。日付を固定すると、日をまたいだあとも前日を見続けてしまうため。
  const [day, setDay] = useState<string | null>(null);
  const [payload, setPayload] = useState<NumbersPayload | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [metricKey, setMetricKey] = useState<HeadlineKey>("diagnoses");
  const [mode, setMode] = useState<HeadlineSeriesMode>("hourly");
  const [chartType, setChartType] = useState<NumbersChartType>("line");
  // 何と比べるか (最大 2 つ)。選ぶまでは、平均の元がそろっていれば平均、なければ前日。
  const [selection, setSelection] = useState<ComparisonId[] | null>(null);
  // 「日付を足す」で足した日付。選択から外しても、候補としては残す。
  const [customDays, setCustomDays] = useState<string[]>([]);
  // 比べる相手として、あとから取った日付ごとの 1 日分。
  const [extraBlocks, setExtraBlocks] = useState<
    Record<string, NumbersDayBlock>
  >({});
  const [failedDays, setFailedDays] = useState<Record<string, true>>({});
  const requestedDays = useRef(new Set<string>());
  const [costEntryOpen, setCostEntryOpen] = useState(false);
  // 配色。既定は白地 (2026-11-22 本人の指定)。黒地にも切り替えられる (端末ごとに覚える)。
  const { theme, toggleTheme } = useNumbersTheme();
  // スマホでは下の内訳を 1 つずつ切り替えて見る (全部並べると縦に長すぎる)。
  const [section, setSection] = useState<SectionKey>("funnel");
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
      // 「月の推移」の表から来たときは、?day= で指定された日を開く。
      const asked = new URLSearchParams(window.location.search).get("day");
      const target =
        isValidNumbersDay(asked) && asked < todayInJst() ? asked : null;
      if (target) {
        setDay(target);
      } else if (cached) {
        setPayload((current) => current ?? cached);
      }
      await load(target);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // 選んだ相手のうち、まだ数字を取っていない日を取りに行く。
  const selected = payload ? (selection ?? [DEFAULT_COMPARISON_ID]) : [];
  const missingDays = payload
    ? selected
        .map((id) => comparisonDay(payload, id))
        .filter(
          (target): target is string =>
            target !== null &&
            target !== payload.meta.compare_day &&
            !extraBlocks[target] &&
            !failedDays[target],
        )
    : [];
  const missingKey = missingDays.join(",");
  useEffect(() => {
    for (const target of missingKey ? missingKey.split(",") : []) {
      if (requestedDays.current.has(target)) continue;
      requestedDays.current.add(target);
      void fetchDayBlock(target).then(
        (block) =>
          setExtraBlocks((current) => ({ ...current, [target]: block })),
        () => {
          requestedDays.current.delete(target);
          setFailedDays((current) => ({ ...current, [target]: true }));
        },
      );
    }
  }, [missingKey]);

  const toggleComparison = (id: ComparisonId) => {
    if (!payload) return;
    const current = selection ?? [DEFAULT_COMPARISON_ID];
    if (current.includes(id)) {
      setSelection(current.filter((item) => item !== id));
      return;
    }
    if (current.length >= MAX_COMPARISONS) return;
    // 一度失敗した日も、選び直したらもう一度取りに行く。
    const target = comparisonDay(payload, id);
    if (target && failedDays[target]) {
      setFailedDays((current) => {
        const next = { ...current };
        delete next[target];
        return next;
      });
    }
    setSelection(sortComparisonIds([...current, id]));
  };
  const addCustomDay = (target: string) => {
    if (!payload) return;
    setCustomDays((days) => (days.includes(target) ? days : [...days, target]));
    const current = selection ?? [DEFAULT_COMPARISON_ID];
    const id: ComparisonId = `date:${target}`;
    if (!current.includes(id) && current.length < MAX_COMPARISONS) {
      setSelection(sortComparisonIds([...current, id]));
    }
  };
  const removeCustomDay = (target: string) => {
    setCustomDays((days) => days.filter((item) => item !== target));
    setSelection((current) =>
      current ? current.filter((item) => item !== `date:${target}`) : current,
    );
  };

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

  return (
    <main
      className={NUMBERS_MAIN}
      style={NUMBERS_THEMES[theme]}
      data-theme={theme}
    >
      <NumbersHeader
        current="day"
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={() => show(day)}
        busy={busy}
        status={
          <p
            className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--nb-text-3)]"
            aria-live="polite"
          >
            {payload ? (
              <>
                {/* 今日を見ていて、数字が最新のときだけ緑の点を出す。 */}
                {live && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nb-up)]"
                  />
                )}
                <span className="truncate tabular-nums">
                  {payload.meta.is_today
                    ? `${formatNumbersClock(payload.meta.generated_at)} 時点`
                    : `${formatNumbersDay(payload.meta.day)} の1日分`}
                  {stale ? " ・ 取り直しています..." : ""}
                  {status === "catching_up" ? " ・ 続きを集計しています..." : ""}
                </span>
              </>
            ) : loading ? (
              "読み込んでいます..."
            ) : null}
          </p>
        }
      >
        {shownDay !== today && (
          <button
            type="button"
            onClick={() => show(null)}
            className={`${GHOST_BASE} px-2.5`}
          >
            今日
          </button>
        )}
        <div className="flex items-center">
          <StepButton
            direction="previous"
            label="前の日"
            disabled={shownDay <= NUMBERS_EARLIEST_DAY}
            onClick={() => show(shiftNumbersDay(shownDay, -1))}
          />
          <DateButton
            label={formatNumbersDay(shownDay)}
            ariaLabel="表示する日"
            value={shownDay}
            min={NUMBERS_EARLIEST_DAY}
            max={today}
            onPick={(value) => show(value >= today ? null : value)}
            className="h-9 rounded-lg px-1.5 text-[15px] font-semibold tabular-nums transition-colors hover:bg-[var(--nb-surface-2)] sm:px-2.5"
          />
          <StepButton
            direction="next"
            label="次の日"
            disabled={shownDay >= today}
            onClick={() => {
              const next = shiftNumbersDay(shownDay, 1);
              show(next >= today ? null : next);
            }}
          />
        </div>
      </NumbersHeader>

      <div className={`pt-5 sm:pt-6 ${NUMBERS_GUTTER}`}>
        {status === "error" && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--nb-down)_9%,transparent)] px-4 py-3 text-base"
          >
            <span className="mr-auto">
              数字を取得できませんでした。
              {payload ? "表示しているのは前回の数字です。" : ""}
            </span>
            <button
              type="button"
              onClick={() => show(day)}
              className={OUTLINE_BUTTON}
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
            chartType={chartType}
            onChartType={setChartType}
            selected={selected}
            customDays={customDays}
            extraBlocks={extraBlocks}
            failedDays={failedDays}
            onToggleComparison={toggleComparison}
            onAddCustomDay={addCustomDay}
            onRemoveCustomDay={removeCustomDay}
            onOpenCostEntry={() => setCostEntryOpen(true)}
            section={section}
            onSection={setSection}
            dimmed={stale}
          />
        ) : loading ? (
          <Skeleton />
        ) : null}
      </div>
      <ThemeToggle theme={theme} onToggle={toggleTheme} variant="wide" />
      {costEntryOpen && (
        <NumbersCostEntry
          onClose={() => setCostEntryOpen(false)}
          // 保存したら、裏の数字も取り直す (表示は消さずに差し替える)。
          onSaved={() => void load(day)}
        />
      )}
    </main>
  );
}

function Skeleton() {
  const block = "animate-pulse rounded-xl bg-[var(--nb-surface-2)]";
  return (
    <div aria-hidden className="grid gap-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-5">
        {HEADLINES.map((item, index) => (
          <div
            key={item.key}
            className={`${block} h-24 ${index === 0 ? "col-span-2 md:col-span-1" : ""}`}
          />
        ))}
      </div>
      <div className={`${block} h-[22rem]`} />
      <div className={`${block} h-32`} />
    </div>
  );
}

type SectionKey = "funnel" | "hours" | "sources" | "social";

const SECTIONS: { value: SectionKey; label: string }[] = [
  { value: "funnel", label: "ファネル" },
  { value: "hours", label: "時間帯別" },
  { value: "sources", label: "流入経路" },
  { value: "social", label: "友達・口コミ" },
];

/** 比べる相手を選ぶ。最大 2 つ。いちばん左で選んでいるものが、増減の基準になる。 */
function ComparisonPicker({
  payload,
  selected,
  customDays,
  comparisons,
  failedDays,
  onToggle,
  onAdd,
  onRemove,
}: {
  payload: NumbersPayload;
  selected: ComparisonId[];
  customDays: string[];
  /** 選んだ相手のうち、数字が用意できたもの (グラフの色の順)。 */
  comparisons: NumbersComparison[];
  failedDays: Record<string, true>;
  onToggle: (id: ComparisonId) => void;
  onAdd: (day: string) => void;
  onRemove: (day: string) => void;
}) {
  const { meta, baseline } = payload;
  const options: { id: ComparisonId; label: string; removable?: string }[] = [];
  if ((baseline?.days ?? 0) >= 1) {
    options.push({ id: "average", label: `直近${baseline?.days}日平均` });
  }
  options.push({
    id: "previous",
    label: `前日 ${formatNumbersDay(shiftNumbersDay(meta.day, -1))}`,
  });
  const weekAgo = shiftNumbersDay(meta.day, -7);
  if (weekAgo >= NUMBERS_EARLIEST_DAY) {
    options.push({
      id: "week",
      label: `1週間前 ${formatNumbersDay(weekAgo)}`,
    });
  }
  for (const target of customDays) {
    options.push({
      id: `date:${target}`,
      label: formatNumbersDay(target),
      removable: target,
    });
  }
  const full = selected.length >= MAX_COMPARISONS;
  const lastDay = shiftNumbersDay(meta.day, -1);

  const chip =
    "inline-flex h-8 items-center rounded-full text-sm transition-colors";

  return (
    <div
      role="group"
      aria-label="比べる相手"
      className="flex flex-wrap items-center gap-1"
    >
      <span className="mr-2 text-sm text-[var(--nb-text-3)]">比較</span>
      {options.map((option) => {
        const on = selected.includes(option.id);
        const ready = comparisons.some((item) => item.id === option.id);
        const target = comparisonDay(payload, option.id);
        const failed = on && target !== null && failedDays[target];
        const loading = on && !ready && !failed;
        return (
          <span
            key={option.id}
            className={`${chip} ${
              on
                ? "bg-[var(--nb-text)] text-[var(--nb-bg)]"
                : "text-[var(--nb-text-2)] hover:bg-[var(--nb-surface-2)] hover:text-[var(--nb-text)]"
            } ${!on && full ? "opacity-40" : ""} ${loading ? "animate-pulse" : ""}`}
          >
            <button
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              title={
                !on && full
                  ? `同時に比べられるのは${MAX_COMPARISONS}つまでです`
                  : undefined
              }
              onClick={() => onToggle(option.id)}
              className={`flex h-full items-center gap-1.5 rounded-full px-3.5 disabled:cursor-not-allowed ${on ? "font-semibold" : ""}`}
            >
              {option.label}
              {loading && <span className="sr-only">（取得中）</span>}
              {failed && <span className="font-normal">取得できません</span>}
            </button>
            {option.removable && (
              <button
                type="button"
                aria-label={`${option.label} を候補から外す`}
                onClick={() => onRemove(option.removable as string)}
                className="-ml-2 flex h-full items-center rounded-full pl-1 pr-3 opacity-60 hover:opacity-100"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      <DateButton
        label="＋ 日付を選ぶ"
        ariaLabel="比べる日付を足す"
        value=""
        min={NUMBERS_EARLIEST_DAY}
        max={lastDay}
        onPick={(value) => {
          if (value <= lastDay && value >= NUMBERS_EARLIEST_DAY) onAdd(value);
        }}
        className={`${chip} px-3.5 text-[var(--nb-text-2)] hover:bg-[var(--nb-surface-2)] hover:text-[var(--nb-text)]`}
      />
    </div>
  );
}

function Body({
  payload,
  metricKey,
  onMetric,
  mode,
  onMode,
  chartType,
  onChartType,
  selected,
  customDays,
  extraBlocks,
  failedDays,
  onToggleComparison,
  onAddCustomDay,
  onRemoveCustomDay,
  onOpenCostEntry,
  section,
  onSection,
  dimmed,
}: {
  payload: NumbersPayload;
  metricKey: HeadlineKey;
  onMetric: (key: HeadlineKey) => void;
  mode: HeadlineSeriesMode;
  onMode: (mode: HeadlineSeriesMode) => void;
  chartType: NumbersChartType;
  onChartType: (type: NumbersChartType) => void;
  selected: ComparisonId[];
  customDays: string[];
  extraBlocks: Record<string, NumbersDayBlock>;
  failedDays: Record<string, true>;
  onToggleComparison: (id: ComparisonId) => void;
  onAddCustomDay: (day: string) => void;
  onRemoveCustomDay: (day: string) => void;
  onOpenCostEntry: () => void;
  section: SectionKey;
  onSection: (key: SectionKey) => void;
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

  // 選んだ相手のうち、数字が用意できたもの。先頭が増減・要約・表の基準。
  const comparisons = selected
    .map((id) => buildComparison(payload, id, extraBlocks))
    .filter((item): item is NumbersComparison => item !== null);
  const comparison = comparisons[0] ?? null;
  // ファネルや口コミは 1 日分どうしで比べる。基準が平均のときは、最初の応答の比較日を使う。
  const flowCompare = comparison?.block ?? compare;
  const flowLabel = formatNumbersDay(flowCompare.day);

  const lastFullHour = currentHour === null ? null : currentHour - 1;
  const lastFull =
    lastFullHour !== null && lastFullHour >= 0 ? day.hours[lastFullHour] : null;
  const lastFullBefore =
    lastFull && comparison ? comparison.hours[lastFull.h] : null;
  // スマホでは選んだ内訳だけ、PC では全部を出す。
  const only = (key: SectionKey) =>
    section === key ? "contents" : "hidden xl:contents";

  return (
    <div
      className={`grid gap-12 transition-opacity duration-200 xl:gap-14 ${dimmed ? "opacity-60" : ""}`}
    >
      {/* いまの数字。指標のタブと、そのすぐ下のグラフで 1 つのまとまり。 */}
      <div className="min-w-0">
        <ComparisonPicker
          payload={payload}
          selected={selected}
          customDays={customDays}
          comparisons={comparisons}
          failedDays={failedDays}
          onToggle={onToggleComparison}
          onAdd={onAddCustomDay}
          onRemove={onRemoveCustomDay}
        />
        <div className="mt-6">
          <KpiRow
            day={day}
            comparison={comparison}
            selected={metric.key}
            onSelect={onMetric}
            isToday={meta.is_today}
          />
        </div>
        <div className="pt-4">
          <NumbersHourlyChart
            metric={metric}
            mode={mode}
            type={chartType}
            hours={day.hours}
            comparisons={comparisons}
            dayLabel={dayLabel}
            currentHour={currentHour}
            nowHours={nowHours}
            hint={`${metric.label}＝${metric.hint}`}
            toolbar={
              <>
                {mode === "hourly" && (
                  <Segmented
                    label="グラフの形"
                    value={chartType}
                    onChange={onChartType}
                    options={[
                      { value: "line", label: "線" },
                      { value: "bar", label: "棒" },
                    ]}
                  />
                )}
                <Segmented
                  label="グラフの見方"
                  value={mode}
                  onChange={onMode}
                  options={[
                    { value: "hourly", label: "時間別" },
                    { value: "cumulative", label: "累計" },
                  ]}
                />
              </>
            }
          />
        </div>
        {lastFull && (
          <dl className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-[var(--nb-border)] pt-3.5 text-sm tabular-nums">
            <dt className="text-[var(--nb-text-3)]">
              直近1時間（{lastFull.h}時台）
            </dt>
            {[
              {
                label: "診断数",
                now: numberFormat.format(lastFull.diagnoses),
                before: lastFullBefore
                  ? formatNumbersValue(lastFullBefore.diagnoses, "count")
                  : null,
              },
              {
                label: "純売上",
                now: yen(lastFull.net),
                before: lastFullBefore ? yen(lastFullBefore.net) : null,
              },
              {
                label: "買い切り",
                now: numberFormat.format(lastFull.purchases_full),
                before: lastFullBefore
                  ? formatNumbersValue(lastFullBefore.purchases_full, "count")
                  : null,
              },
            ].map((item) => (
              <dd key={item.label} className="flex items-baseline gap-2">
                <span className="text-[var(--nb-text-2)]">{item.label}</span>
                <span className="text-base font-semibold text-[var(--nb-text)]">
                  {item.now}
                </span>
                {item.before !== null && comparison && (
                  <span className="text-[13px] text-[var(--nb-text-3)]">
                    {comparison.shortLabel} {item.before}
                  </span>
                )}
              </dd>
            ))}
          </dl>
        )}
      </div>

      <EconomicsCard payload={payload} onOpenEntry={onOpenCostEntry} />

      {/* スマホでは下の内訳を 1 つずつ切り替えて見る。PC では全部を、上から順に並べる。 */}
      <div className="-mb-6 overflow-x-auto xl:hidden">
        <Segmented
          label="内訳"
          value={section}
          onChange={onSection}
          options={SECTIONS}
        />
      </div>

      <div className="grid min-w-0 gap-x-9 gap-y-12 xl:grid-cols-12 xl:gap-y-14 2xl:gap-x-14">
        <div className={only("funnel")}>
          <FunnelCard
            day={day}
            compare={flowCompare}
            compareLabel={flowLabel}
            partial={isNumbersCatchingUp(payload)}
            className="xl:col-span-12"
          />
        </div>
        <div className={only("hours")}>
          <HoursCard
            day={day}
            previous={buildComparison(payload, "previous", extraBlocks)}
            currentHour={currentHour}
            className="xl:col-span-7"
          />
        </div>
        <div className={only("sources")}>
          <SourcesCard day={day} className="xl:col-span-5" />
        </div>
        <div className={only("social")}>
          <FriendFlowCard
            day={day}
            compare={flowCompare}
            compareLabel={flowLabel}
            className="xl:col-span-12"
          />
        </div>
        <div className={only("social")}>
          <SocialCards
            day={day}
            compare={flowCompare}
            compareLabel={flowLabel}
            className="xl:col-span-12"
          />
        </div>
      </div>
    </div>
  );
}
