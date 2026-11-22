"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import {
  HEADLINES,
  NUMBERS_EARLIEST_DAY,
  formatNumbersClock,
  formatNumbersDay,
  formatNumbersDelta,
  formatNumbersValue,
  isNumbersCatchingUp,
  ratio,
  shiftNumbersDay,
  sumEvents,
  sumHours,
  todayInJst,
  type HeadlineKey,
  type NumbersDayBlock,
  type NumbersHourEvents,
  type NumbersPayload,
} from "@/lib/internal-numbers";

import { NumbersHourlyChart } from "./NumbersHourlyChart";

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

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
type TabKey = "hours" | "sources" | "funnel" | "social";

const TABS: { key: TabKey; label: string }[] = [
  { key: "hours", label: "時間別" },
  { key: "sources", label: "流入元" },
  { key: "funnel", label: "ファネル" },
  { key: "social", label: "口コミ" },
];

const count = new Intl.NumberFormat("ja-JP");
const yen = (value: number) => `¥${count.format(Math.round(value))}`;
const percent = (value: number | null, digits = 1) =>
  value === null ? "–" : `${(value * 100).toFixed(digits)}%`;

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
  const [tab, setTab] = useState<TabKey>("hours");
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

  return (
    <main
      className="min-h-dvh flex-1 bg-black pb-10 text-[#e7e9ea]"
      style={{ colorScheme: "dark" }}
    >
      <div className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-6 sm:pt-6">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-base font-bold">数値</h1>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="前の日"
              disabled={shownDay <= NUMBERS_EARLIEST_DAY}
              onClick={() => show(shiftNumbersDay(shownDay, -1))}
              className="h-9 w-9 rounded-lg border border-[#2a2d31] text-[#e7e9ea] disabled:opacity-30"
            >
              ‹
            </button>
            <label className="relative">
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
                className="h-9 rounded-lg border border-[#2a2d31] bg-transparent px-2 text-sm text-[#e7e9ea]"
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
              className="h-9 w-9 rounded-lg border border-[#2a2d31] text-[#e7e9ea] disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <button
            type="button"
            onClick={() => show(day)}
            disabled={busy}
            aria-busy={busy}
            className="flex h-9 min-w-[5.5rem] items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-black disabled:opacity-70"
          >
            {busy && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black"
              />
            )}
            {busy ? "更新中..." : "更新"}
          </button>
        </header>

        <p className="mt-2 min-h-5 text-xs text-[#8b8f94]" aria-live="polite">
          {payload ? (
            <>
              {formatNumbersDay(payload.meta.day)}
              {payload.meta.is_today
                ? ` ${formatNumbersClock(payload.meta.generated_at)} 時点`
                : " の1日分"}
              {" ・ 比較: "}
              {formatNumbersDay(payload.meta.compare_day)}
              {payload.meta.is_today ? " の同じ時刻まで" : ""}
              {stale ? " ・ 取り直しています..." : ""}
              {status === "catching_up" ? " ・ ファネルを集計しています..." : ""}
            </>
          ) : loading ? (
            "読み込んでいます..."
          ) : null}
        </p>

        {status === "error" && (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#5c2b2e] bg-[#1d0f10] px-4 py-3 text-sm"
          >
            <span className="mr-auto">
              数字を取得できませんでした。
              {payload ? "表示しているのは前回の数字です。" : ""}
            </span>
            <button
              type="button"
              onClick={() => show(day)}
              className="rounded-lg border border-[#5c2b2e] px-3 py-1.5 font-bold"
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
            tab={tab}
            onTab={setTab}
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
  return (
    <div aria-hidden className="mt-4 space-y-4">
      <div className="h-[23rem] animate-pulse rounded-2xl border border-[#1f2226] bg-[#0a0a0b]" />
      <div className="h-64 animate-pulse rounded-2xl border border-[#1f2226] bg-[#0a0a0b]" />
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[#1f2226] bg-[#0a0a0b]">
      {children}
    </section>
  );
}

function Body({
  payload,
  metricKey,
  onMetric,
  tab,
  onTab,
  dimmed,
}: {
  payload: NumbersPayload;
  metricKey: HeadlineKey;
  onMetric: (key: HeadlineKey) => void;
  tab: TabKey;
  onTab: (key: TabKey) => void;
  dimmed: boolean;
}) {
  const { meta, day, compare } = payload;
  const metric = HEADLINES.find((item) => item.key === metricKey) ?? HEADLINES[0];
  const currentHour = meta.is_today
    ? Math.min(23, Math.floor(meta.elapsed_seconds / 3600))
    : null;
  const dayLabel = formatNumbersDay(meta.day);
  const compareLabel = formatNumbersDay(meta.compare_day);
  const lastFullHour = currentHour === null ? null : currentHour - 1;
  const lastFull =
    lastFullHour !== null && lastFullHour >= 0 ? day.hours[lastFullHour] : null;

  return (
    <div className={dimmed ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <Panel>
        <div
          role="tablist"
          aria-label="グラフに出す指標"
          className="flex overflow-x-auto border-b border-[#1f2226]"
        >
          {HEADLINES.map((item) => {
            const value = item.fromSubtotal(day.until_cut);
            const previous = item.fromSubtotal(compare.until_cut);
            const delta = formatNumbersDelta(value, previous, item.kind);
            const selected = item.key === metric.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onMetric(item.key)}
                className={`min-w-[8.5rem] shrink-0 border-b-2 px-4 pb-3 pt-4 text-left ${
                  selected ? "border-white" : "border-transparent"
                }`}
              >
                <span
                  className={`block text-xs ${selected ? "text-[#e7e9ea]" : "text-[#8b8f94]"}`}
                >
                  {item.label}
                </span>
                <span className="mt-1 block text-xl font-bold tabular-nums">
                  {formatNumbersValue(value, item.kind)}
                </span>
                <span className="mt-0.5 block text-xs tabular-nums text-[#8b8f94]">
                  {formatNumbersValue(previous, item.kind)}
                  {delta ? `（${delta}）` : ""}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-3 pt-4 sm:px-5">
          <NumbersHourlyChart
            metric={metric}
            hours={day.hours}
            compareHours={compare.hours}
            dayLabel={dayLabel}
            compareLabel={compareLabel}
            currentHour={currentHour}
          />
        </div>

        {lastFull && (
          <p className="border-t border-[#1f2226] px-4 py-3 text-xs text-[#8b8f94]">
            直近1時間（{lastFull.h}時台）
            <span className="ml-3 text-[#e7e9ea]">診断 {count.format(lastFull.diagnoses)}</span>
            <span className="ml-3 text-[#e7e9ea]">純売上 {yen(lastFull.net)}</span>
            <span className="ml-3 text-[#e7e9ea]">買い切り {count.format(lastFull.purchases_full)}</span>
          </p>
        )}
      </Panel>

      <Panel>
        <div
          role="tablist"
          aria-label="内訳"
          className="flex overflow-x-auto border-b border-[#1f2226] px-2"
        >
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => onTab(item.key)}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm font-bold ${
                tab === item.key
                  ? "border-white text-[#e7e9ea]"
                  : "border-transparent text-[#8b8f94]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "hours" && (
          <HoursTable day={day} compare={compare} currentHour={currentHour} compareLabel={compareLabel} />
        )}
        {tab === "sources" && <SourcesTable day={day} />}
        {tab === "funnel" && (
          <FunnelTable
            day={day}
            compare={compare}
            compareLabel={compareLabel}
            partial={isNumbersCatchingUp(payload)}
          />
        )}
        {tab === "social" && (
          <SocialTable day={day} compare={compare} dayLabel={dayLabel} compareLabel={compareLabel} />
        )}
      </Panel>
    </div>
  );
}

function Table({
  head,
  rows,
  note,
  empty,
}: {
  head: string[];
  rows: (string | number)[][];
  note?: string;
  empty?: string;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-[#111315] text-xs text-[#8b8f94]">
              {head.map((label, index) => (
                <th
                  // 見出しは同じ文言が並ぶことがある (「内訳」など) ので、位置で区別する。
                  key={index}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-2.5 font-normal ${index === 0 ? "sticky left-0 bg-[#111315] text-left" : "text-right"}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-[#1f2226]">
                {row.map((cell, index) => (
                  <td
                    key={index}
                    // 横に送っても、どの行かが分かるように先頭の列は固定する。
                    className={`whitespace-nowrap px-4 py-2.5 tabular-nums ${index === 0 ? "sticky left-0 bg-[#0a0a0b] text-left" : "text-right"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-[#6e767d]">
          {empty ?? "この日のデータはまだありません"}
        </p>
      )}
      {note && (
        <p className="border-t border-[#1f2226] px-4 py-3 text-xs leading-relaxed text-[#8b8f94]">
          {note}
        </p>
      )}
    </>
  );
}

function HoursTable({
  day,
  compare,
  currentHour,
  compareLabel,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  currentHour: number | null;
  compareLabel: string;
}) {
  const last = currentHour ?? 23;
  // 新しい時間帯を上に (スマホで開いてすぐ直近が見えるように)。
  const rows = day.hours
    .filter((hour) => hour.h <= last)
    .reverse()
    .map((hour) => {
      const before = compare.hours[hour.h];
      return [
        `${hour.h}時台${hour.h === currentHour ? "（途中）" : ""}`,
        count.format(hour.diagnoses),
        count.format(hour.ad_diagnoses),
        count.format(hour.diagnoses - hour.ad_diagnoses),
        yen(hour.net),
        count.format(hour.purchases_full),
        percent(ratio(hour.purchases_full, hour.diagnoses), 2),
        count.format(hour.purchases_upgrade),
        count.format(before.diagnoses),
        yen(before.net),
      ];
    });
  return (
    <Table
      head={[
        "時",
        "診断数",
        "広告",
        "非広告",
        "純売上",
        "買い切り",
        "課金率",
        "アップグレード",
        `${compareLabel} 診断数`,
        `${compareLabel} 純売上`,
      ]}
      rows={rows}
      note="診断数は診断を完了した人数。純売上は購入時刻で計上し、返金を引いています。広告は流入元が X・TikTok の人です。"
    />
  );
}

function SourcesTable({ day }: { day: NumbersDayBlock }) {
  const total = day.sources.reduce((sum, source) => sum + source.diagnoses, 0);
  const TOP = 12;
  const shown = day.sources.slice(0, TOP);
  const rest = day.sources.slice(TOP);
  const rows = shown.map((source) => [
    source.source || "（なし）",
    source.is_ad ? "広告" : "非広告",
    count.format(source.diagnoses),
    percent(ratio(source.diagnoses, total)),
    count.format(source.purchasers),
    yen(source.net),
    source.diagnoses > 0 ? `¥${(source.net / source.diagnoses).toFixed(2)}` : "–",
  ]);
  if (rest.length > 0) {
    const diagnoses = rest.reduce((sum, source) => sum + source.diagnoses, 0);
    const net = rest.reduce((sum, source) => sum + source.net, 0);
    rows.push([
      `その他（${rest.length}件）`,
      rest.some((source) => source.is_ad) ? "–" : "非広告",
      count.format(diagnoses),
      percent(ratio(diagnoses, total)),
      count.format(rest.reduce((sum, source) => sum + source.purchasers, 0)),
      yen(net),
      diagnoses > 0 ? `¥${(net / diagnoses).toFixed(2)}` : "–",
    ]);
  }
  return (
    <Table
      head={["流入元", "区分", "診断数", "構成比", "購入者", "診断起点の純売上", "診断あたり"]}
      rows={rows}
      note="その日に診断した人が、今までに買った金額を流入元ごとに足しています（購入が遅れても診断した日に付きます）。"
    />
  );
}

interface FunnelStep {
  label: string;
  value: (block: NumbersDayBlock) => number;
  /** 率の分母。無い段は率を出さない。 */
  base?: (block: NumbersDayBlock) => number;
  baseLabel?: string;
  session?: string;
}

const event = (key: keyof NumbersHourEvents) => (block: NumbersDayBlock) =>
  sumEvents(block.hours, key);

const FUNNEL: FunnelStep[] = [
  { label: "診断開始", value: event("started"), session: "diagnosis_started" },
  {
    label: "診断完了",
    value: event("completed"),
    base: event("started"),
    baseLabel: "開始",
    session: "diagnosis_completed",
  },
  {
    label: "課金表示（カード）",
    value: event("paywall_card"),
    base: event("completed"),
    baseLabel: "完了",
  },
  {
    label: "課金表示（モーダル）",
    value: event("paywall_modal"),
    base: event("completed"),
    baseLabel: "完了",
  },
  {
    label: "購入ボタン",
    value: event("cta"),
    base: (block) => event("paywall_card")(block) + event("paywall_modal")(block),
    baseLabel: "課金表示",
    session: "purchase_cta_clicked",
  },
  {
    label: "決済画面",
    value: event("checkout"),
    base: event("completed"),
    baseLabel: "完了",
    session: "checkout_session_created",
  },
  {
    label: "購入完了",
    value: event("paid"),
    base: event("checkout"),
    baseLabel: "決済画面",
    session: "purchase_completed",
  },
  {
    label: "友達診断ページ表示",
    value: event("tako_viewed"),
    base: event("completed"),
    baseLabel: "完了",
  },
  {
    label: "招待クリック",
    value: event("invite_clicked"),
    base: event("tako_viewed"),
    baseLabel: "ページ表示",
  },
  { label: "友達がリンクを開いた", value: event("friend_landing") },
  {
    label: "友達の回答完了",
    value: event("friend_completed"),
    base: event("friend_landing"),
    baseLabel: "リンクを開いた",
  },
  {
    label: "友達が自己診断へ",
    value: event("friend_to_self"),
    base: event("friend_completed"),
    baseLabel: "回答完了",
  },
  {
    label: "友達診断ページの課金表示",
    value: event("tako_paywall"),
    base: event("tako_viewed"),
    baseLabel: "ページ表示",
  },
  {
    label: "友達診断ページからの購入",
    value: event("tako_paid"),
    base: event("tako_viewed"),
    baseLabel: "ページ表示",
  },
];

function FunnelTable({
  day,
  compare,
  compareLabel,
  partial,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  compareLabel: string;
  partial: boolean;
}) {
  const rows = FUNNEL.map((step) => {
    const rate = step.base ? ratio(step.value(day), step.base(day)) : null;
    const before = step.base ? ratio(step.value(compare), step.base(compare)) : null;
    return [
      step.label,
      count.format(step.value(day)),
      step.session && day.sessions[step.session] !== undefined
        ? count.format(day.sessions[step.session])
        : "–",
      step.base ? `${percent(rate, 2)}（÷${step.baseLabel}）` : "–",
      step.base ? percent(before, 2) : "–",
    ];
  });
  return (
    <Table
      head={["段階", "回数", "セッション数", "率", `${compareLabel} の率`]}
      rows={rows}
      note={`${partial ? "【集計の途中です。数え終わるまで、回数と率は少なく出ます】" : ""}ファネルはイベントの回数です（同じ人が2回見れば2回）。上の「診断数」は人数なので、診断完了の回数とは少し違います。比較日の率は1日分です。`}
    />
  );
}

function SocialTable({
  day,
  compare,
  dayLabel,
  compareLabel,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  dayLabel: string;
  compareLabel: string;
}) {
  const nonAd = (block: NumbersDayBlock) => {
    const diagnoses = sumHours(block.hours, (hour) => hour.diagnoses);
    const ads = sumHours(block.hours, (hour) => hour.ad_diagnoses);
    return { value: ratio(diagnoses - ads, diagnoses), detail: `${count.format(diagnoses - ads)} ÷ ${count.format(diagnoses)}` };
  };
  const cohort = (block: NumbersDayBlock, key: "friend_owners" | "sharers") => ({
    value: ratio(block.cohort[key], block.cohort.diagnosers),
    detail: `${count.format(block.cohort[key])} ÷ ${count.format(block.cohort.diagnosers)}`,
  });
  const line = (
    label: string,
    pick: (block: NumbersDayBlock) => { value: number | null; detail: string },
  ) => {
    const now = pick(day);
    const before = pick(compare);
    return [label, percent(now.value), now.detail, percent(before.value), before.detail];
  };
  return (
    <Table
      head={["指標", dayLabel, "内訳", compareLabel, "内訳"]}
      rows={[
        line("非広告流入比率", nonAd),
        line("友達診断率", (block) => cohort(block, "friend_owners")),
        line("シェア率", (block) => cohort(block, "sharers")),
      ]}
      note="友達診断率とシェア率は、その日に診断した人のうち、今までに友達の回答をもらった人・シェア操作をした人の割合です。日がたつと増えるので、新しい日ほど低く出ます。"
    />
  );
}
