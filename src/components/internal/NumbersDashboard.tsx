"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  HEADLINES,
  MAX_COMPARISONS,
  NUMBERS_EARLIEST_DAY,
  buildComparison,
  comparisonDay,
  defaultComparisonId,
  formatNumbersClock,
  formatNumbersDay,
  formatNumbersValue,
  headlineValue,
  isNumbersCatchingUp,
  numbersDelta,
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
  COMPARISON_STYLES,
  NumbersHourlyChart,
  type NumbersChartType,
} from "./NumbersHourlyChart";
import { NumbersCostEntry } from "./NumbersCostEntry";
import { EconomicsCard } from "./NumbersEconomics";
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
      if (cached) setPayload((current) => current ?? cached);
      await load(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // 選んだ相手のうち、まだ数字を取っていない日を取りに行く。
  const selected = payload ? (selection ?? [defaultComparisonId(payload)]) : [];
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
    const current = selection ?? [defaultComparisonId(payload)];
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
    const current = selection ?? [defaultComparisonId(payload)];
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
                      ? " ・ 続きを集計しています..."
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

type SectionKey = "funnel" | "hours" | "sources" | "social";

const SECTIONS: { value: SectionKey; label: string }[] = [
  { value: "funnel", label: "ファネル" },
  { value: "hours", label: "時間別" },
  { value: "sources", label: "流入元" },
  { value: "social", label: "友達・口コミ" },
];

/** 今日 (または表示日) の状況を、比べる相手に対して 1〜2 文で言う。 */
function Summary({
  payload,
  comparison,
}: {
  payload: NumbersPayload;
  comparison: NumbersComparison | null;
}) {
  const { meta, day } = payload;
  if (!comparison) return null;
  const parts = HEADLINES.filter(
    (item) => item.key === "diagnoses" || item.key === "net",
  ).map((item) => {
    const value = headlineValue(item, day.until_cut);
    const delta = numbersDelta(
      value,
      headlineValue(item, comparison.untilCut),
      item.kind,
    );
    return { item, value, delta };
  });
  if (parts.some((part) => part.delta === null)) return null;
  // 文の途中は「多く」、文末は「多い」。
  const word = (direction: "up" | "down" | "flat", last: boolean) =>
    direction === "up"
      ? last
        ? "多い"
        : "多く"
      : direction === "down"
        ? last
          ? "少ない"
          : "少なく"
        : "";
  return (
    <p className="text-sm leading-relaxed text-[var(--nb-text-2)]">
      {comparison.label}と比べて、
      {parts.map((part, index) => {
        const last = index === parts.length - 1;
        const direction = part.delta?.direction ?? "flat";
        return (
          <span key={part.item.key}>
            {part.item.label}は{" "}
            <span
              className="font-bold tabular-nums"
              style={{
                color:
                  direction === "up"
                    ? "var(--nb-up)"
                    : direction === "down"
                      ? "var(--nb-down)"
                      : "var(--nb-text)",
              }}
            >
              {direction === "flat"
                ? "ほぼ同じ"
                : `${part.delta?.text} ${word(direction, last)}`}
            </span>
            {last ? "" : direction === "flat" ? "で、" : "、"}
          </span>
        );
      })}
      {meta.is_today ? "ペースです。" : "結果でした。"}
    </p>
  );
}

/** 比べる相手を選ぶ。最大 2 つ。いちばん左で選んでいるものが、増減と要約の基準になる。 */
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

  return (
    <div
      role="group"
      aria-label="比べる相手"
      className="flex flex-wrap items-center gap-1.5"
    >
      <span className="mr-1 text-xs font-bold text-[var(--nb-text-2)]">
        比べる相手
      </span>
      {options.map((option) => {
        const on = selected.includes(option.id);
        const ready = comparisons.findIndex((item) => item.id === option.id);
        const target = comparisonDay(payload, option.id);
        const failed = on && target !== null && failedDays[target];
        const loading = on && ready < 0 && !failed;
        const color = ready >= 0 ? COMPARISON_STYLES[ready]?.color : undefined;
        return (
          <span
            key={option.id}
            className={`inline-flex items-center rounded-full border text-xs transition-colors ${
              on
                ? "border-[var(--nb-border-strong)] bg-[var(--nb-surface-2)] text-[var(--nb-text)]"
                : "border-[var(--nb-border)] text-[var(--nb-text-2)] hover:border-[var(--nb-border-strong)] hover:text-[var(--nb-text)]"
            } ${!on && full ? "opacity-40" : ""}`}
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
              className="flex items-center gap-1.5 py-1.5 pl-3 pr-3 font-bold disabled:cursor-not-allowed"
            >
              {on && (
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${loading ? "animate-pulse" : ""}`}
                  style={{
                    background: failed
                      ? "var(--nb-down)"
                      : (color ?? "var(--nb-border-strong)"),
                  }}
                />
              )}
              {option.label}
              {loading && <span className="sr-only">（取得中）</span>}
              {failed && (
                <span className="font-normal text-[var(--nb-down)]">
                  取得できません
                </span>
              )}
            </button>
            {option.removable && (
              <button
                type="button"
                aria-label={`${option.label} を候補から外す`}
                onClick={() => onRemove(option.removable as string)}
                className="-ml-2 py-1.5 pl-1 pr-2.5 text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      <label className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--nb-border-strong)] py-1 pl-3 pr-1.5 text-xs text-[var(--nb-text-2)]">
        <span className="font-bold">日付を足す</span>
        <input
          type="date"
          value=""
          min={NUMBERS_EARLIEST_DAY}
          max={lastDay}
          onChange={(event) => {
            const value = event.target.value;
            if (value && value <= lastDay && value >= NUMBERS_EARLIEST_DAY) {
              onAdd(value);
            }
          }}
          className="h-6 w-[7.6rem] rounded-full bg-transparent px-1 text-xs tabular-nums text-[var(--nb-text)]"
        />
      </label>
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
      className={`grid gap-3 transition-opacity duration-200 xl:gap-4 ${dimmed ? "opacity-50" : ""}`}
    >
      <div className="grid gap-3">
        <Summary payload={payload} comparison={comparison} />
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
      </div>

      <KpiRow
        day={day}
        comparison={comparison}
        selected={metric.key}
        onSelect={onMetric}
        isToday={meta.is_today}
        currentHour={currentHour}
        nowHours={nowHours}
      />

      <EconomicsCard payload={payload} onOpenEntry={onOpenCostEntry} />

      <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
        <Card
          title={metric.label}
          hint={metric.hint}
          className="xl:col-span-8"
          action={
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          }
        >
          <div className="px-3 pb-2 sm:px-4">
            <NumbersHourlyChart
              metric={metric}
              mode={mode}
              type={chartType}
              hours={day.hours}
              comparisons={comparisons}
              dayLabel={dayLabel}
              currentHour={currentHour}
              nowHours={nowHours}
            />
          </div>
          {lastFull && (
            <div className="mt-auto border-t border-[var(--nb-border)] sm:flex sm:items-stretch">
              <p className="px-4 pt-3 text-xs font-bold text-[var(--nb-text-2)] sm:flex sm:w-40 sm:shrink-0 sm:items-center sm:px-5 sm:pt-0">
                直近1時間（{lastFull.h}時台）
              </p>
              <dl className="grid flex-1 grid-cols-3 sm:divide-x sm:divide-[var(--nb-border)] sm:border-l sm:border-[var(--nb-border)]">
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
                      ? formatNumbersValue(
                          lastFullBefore.purchases_full,
                          "count",
                        )
                      : null,
                  },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 px-4 py-3 sm:px-5">
                    <dt className="text-xs text-[var(--nb-text-2)]">
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 tabular-nums">
                      <span className="text-lg font-bold">{item.now}</span>
                      {item.before !== null && comparison && (
                        <span className="block truncate text-xs text-[var(--nb-text-2)] sm:ml-2 sm:inline">
                          {comparison.shortLabel} {item.before}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Card>

        <div className="xl:hidden">
          <div className="overflow-x-auto">
            <Segmented
              label="内訳"
              value={section}
              onChange={onSection}
              options={SECTIONS}
            />
          </div>
        </div>

        <div className={only("funnel")}>
          <FunnelCard
            day={day}
            compare={flowCompare}
            compareLabel={flowLabel}
            partial={isNumbersCatchingUp(payload)}
            className="xl:col-span-4"
          />
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
        <div className={only("hours")}>
          <HoursCard
            day={day}
            comparison={comparison}
            currentHour={currentHour}
            className="xl:col-span-7"
          />
        </div>
        <div className={only("sources")}>
          <SourcesCard day={day} className="xl:col-span-5" />
        </div>
      </div>

      <div className={only("social")}>
        <div className="grid gap-3 xl:grid-cols-12 xl:gap-4">
          <FriendFlowCard
            day={day}
            compare={flowCompare}
            compareLabel={flowLabel}
            className="xl:col-span-7"
          />
          <SocialCards
            day={day}
            compare={flowCompare}
            compareLabel={flowLabel}
            className="xl:col-span-5"
          />
        </div>
      </div>
    </div>
  );
}
