"use client";

// 社内向け数値画面の各ブロック。受け取った数字を並べるだけで、取得や状態は持たない。
import {
  HEADLINES,
  formatNumbersValue,
  headlineValue,
  numbersDelta,
  ratio,
  sumEvents,
  sumHours,
  type HeadlineKey,
  type NumbersDayBlock,
  type NumbersHourEvents,
} from "@/lib/internal-numbers";

import { NumbersSparkline } from "./NumbersHourlyChart";
import {
  Card,
  DataBar,
  DeltaBadge,
  numberFormat,
  percent,
  yen,
} from "./numbers-ui";

/* ------------------------------------------------------------------ 指標 */

export function KpiRow({
  day,
  compare,
  selected,
  onSelect,
  compareNote,
  currentHour,
  nowHours,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  selected: HeadlineKey;
  onSelect: (key: HeadlineKey) => void;
  /** 比較相手の説明。「昨日の同時刻」など。 */
  compareNote: string;
  currentHour: number | null;
  nowHours: number | null;
}) {
  return (
    <div
      role="tablist"
      aria-label="グラフに出す指標"
      className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:gap-4"
    >
      {HEADLINES.map((item, index) => {
        const value = headlineValue(item, day.until_cut);
        const previous = headlineValue(item, compare.until_cut);
        const active = item.key === selected;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.key)}
            className={`group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-[var(--nb-surface)] px-4 pb-3 pt-4 text-left transition-colors xl:px-5 xl:pt-5 ${
              index === 0 ? "col-span-2 md:col-span-1" : ""
            } ${
              active
                ? "border-[var(--nb-accent)]"
                : "border-[var(--nb-border)] hover:border-[var(--nb-border-strong)]"
            }`}
          >
            {active && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.16]"
                style={{
                  background:
                    "radial-gradient(120% 100% at 50% 0%, var(--nb-accent), transparent 70%)",
                }}
              />
            )}
            <span className="relative flex items-center gap-2 text-xs font-bold text-[var(--nb-text-2)]">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: active
                    ? "var(--nb-accent)"
                    : "var(--nb-border-strong)",
                }}
              />
              {item.label}
            </span>
            <span className="relative mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[1.7rem] font-bold leading-none tracking-tight tabular-nums text-[var(--nb-text)] xl:text-[2.1rem]">
                {formatNumbersValue(value, item.kind)}
              </span>
              <DeltaBadge delta={numbersDelta(value, previous, item.kind)} />
            </span>
            <span className="relative mt-1.5 truncate text-xs tabular-nums text-[var(--nb-text-2)]">
              {compareNote} {formatNumbersValue(previous, item.kind)}
            </span>
            <span className="relative mt-3 block">
              <NumbersSparkline
                metric={item}
                hours={day.hours}
                compareHours={compare.hours}
                currentHour={currentHour}
                nowHours={nowHours}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- ファネル */

interface FlowStep {
  label: string;
  value: (block: NumbersDayBlock) => number;
  /** 前の段階からの率を出すかどうか。流れの先頭や、別の流れの始まりでは出さない。 */
  fromPrevious?: boolean;
  session?: string;
}

const event = (key: keyof NumbersHourEvents) => (block: NumbersDayBlock) =>
  sumEvents(block.hours, key);

const PURCHASE_FLOW: FlowStep[] = [
  { label: "診断開始", value: event("started"), session: "diagnosis_started" },
  {
    label: "診断完了",
    value: event("completed"),
    fromPrevious: true,
    session: "diagnosis_completed",
  },
  {
    label: "課金表示",
    value: (block) =>
      event("paywall_card")(block) + event("paywall_modal")(block),
    fromPrevious: true,
    session: "paywall_viewed",
  },
  {
    label: "購入ボタン",
    value: event("cta"),
    fromPrevious: true,
    session: "purchase_cta_clicked",
  },
  {
    label: "決済画面",
    value: event("checkout"),
    fromPrevious: true,
    session: "checkout_session_created",
  },
  {
    label: "購入完了",
    value: event("paid"),
    fromPrevious: true,
    session: "purchase_completed",
  },
];

// 友達診断は、招待する本人の流れと、招待された友達の流れに分かれる (別々の人の行動)。
const INVITER_FLOW: FlowStep[] = [
  { label: "友達診断ページ表示", value: event("tako_viewed") },
  { label: "招待クリック", value: event("invite_clicked"), fromPrevious: true },
  { label: "課金表示", value: event("tako_paywall"), fromPrevious: false },
  { label: "購入", value: event("tako_paid"), fromPrevious: true },
];
const FRIEND_FLOW: FlowStep[] = [
  { label: "リンクを開いた", value: event("friend_landing") },
  { label: "回答完了", value: event("friend_completed"), fromPrevious: true },
  { label: "自己診断へ", value: event("friend_to_self"), fromPrevious: true },
];

function Flow({
  steps,
  day,
  compare,
  compareLabel,
}: {
  steps: FlowStep[];
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  compareLabel: string;
}) {
  const top = Math.max(1, ...steps.map((step) => step.value(day)));
  return (
    <ol className="flex flex-col px-4 pb-4 sm:px-5">
      {steps.map((step, index) => {
        const value = step.value(day);
        const before = index > 0 ? steps[index - 1] : null;
        const rate =
          step.fromPrevious && before ? ratio(value, before.value(day)) : null;
        const compareRate =
          step.fromPrevious && before
            ? ratio(step.value(compare), before.value(compare))
            : null;
        const sessions = step.session ? day.sessions[step.session] : undefined;
        return (
          <li key={step.label} className="mt-3 first:mt-0">
            <div className="flex items-baseline gap-3">
              <span className="mr-auto truncate text-sm text-[var(--nb-text)]">
                {step.label}
              </span>
              {sessions !== undefined && (
                <span className="shrink-0 text-xs tabular-nums text-[var(--nb-text-2)]">
                  {numberFormat.format(sessions)} セッション
                </span>
              )}
              <span className="min-w-[3.5rem] shrink-0 text-right text-base font-bold tabular-nums text-[var(--nb-text)]">
                {numberFormat.format(value)}
              </span>
            </div>
            {/* 棒の長さは、この流れの最大の段階を 100% とした割合。 */}
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--nb-surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--nb-accent)]"
                style={{
                  width: `${Math.max(value > 0 ? 1 : 0, (value / top) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-[var(--nb-text-2)]">
              {step.fromPrevious && before ? (
                <>
                  <span>
                    {before.label}から{" "}
                    <span className="font-bold text-[var(--nb-text)]">
                      {percent(rate, 1)}
                    </span>
                  </span>
                  <DeltaBadge
                    delta={numbersDelta(rate, compareRate, "rate")}
                    size="sm"
                  />
                  <span>
                    {compareLabel} {percent(compareRate, 1)}
                  </span>
                </>
              ) : (
                <span>
                  {compareLabel} {numberFormat.format(step.value(compare))}
                  （1日分）
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function FunnelCard({
  day,
  compare,
  compareLabel,
  partial,
  className,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  compareLabel: string;
  partial: boolean;
  className?: string;
}) {
  return (
    <Card
      title="課金ファネル"
      hint={
        partial
          ? "集計の途中です。数え終わるまで少なく出ます"
          : "イベントの回数。率は1つ前の段階から"
      }
      className={className}
    >
      <Flow
        steps={PURCHASE_FLOW}
        day={day}
        compare={compare}
        compareLabel={compareLabel}
      />
    </Card>
  );
}

export function FriendFlowCard({
  day,
  compare,
  compareLabel,
  className,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  compareLabel: string;
  className?: string;
}) {
  return (
    <Card
      title="友達診断の流れ"
      hint="イベントの回数。率は1つ前の段階から"
      className={className}
    >
      <div className="grid flex-1 gap-px bg-[var(--nb-border)] md:grid-cols-2">
        {[
          { title: "招待する本人", steps: INVITER_FLOW },
          { title: "招待された友達", steps: FRIEND_FLOW },
        ].map((flow) => (
          <div key={flow.title} className="bg-[var(--nb-surface)] pt-3">
            <h3 className="px-4 pb-3 text-xs font-bold text-[var(--nb-text-2)] sm:px-5">
              {flow.title}
            </h3>
            <Flow
              steps={flow.steps}
              day={day}
              compare={compare}
              compareLabel={compareLabel}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- 時間別 */

export function HoursCard({
  day,
  compare,
  currentHour,
  compareLabel,
  className,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  currentHour: number | null;
  compareLabel: string;
  className?: string;
}) {
  const last = currentHour ?? 23;
  // 新しい時間帯を上に (開いてすぐ直近が見えるように)。
  const rows = day.hours.filter((hour) => hour.h <= last).reverse();
  const peak = Math.max(1, ...rows.map((hour) => hour.diagnoses));
  const head = [
    "時",
    "診断数",
    `${compareLabel}比`,
    "広告",
    "非広告",
    "純売上",
    "買い切り",
    "課金率",
    "アップグレード",
  ];
  return (
    <Card
      title="時間別"
      hint="診断数は完了した人数。広告は流入元が X・TikTok の人"
      className={className}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="overflow-auto xl:min-h-[22rem] xl:flex-1 xl:basis-0">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {head.map((label, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={`sticky top-0 z-[1] whitespace-nowrap border-y border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-4 py-2.5 text-xs font-normal text-[var(--nb-text-2)] ${
                      index === 0 ? "left-0 z-[2] text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="xl:[&>tr:last-child>*]:pb-9">
              {rows.map((hour) => {
                const before = compare.hours[hour.h];
                const live = hour.h === currentHour;
                const cell =
                  "whitespace-nowrap border-b border-[var(--nb-border)] px-4 py-2.5 text-right tabular-nums";
                return (
                  <tr key={hour.h} className="hover:bg-[var(--nb-surface-2)]">
                    <th
                      scope="row"
                      // 横に送っても、どの行かが分かるように先頭の列は固定する。
                      className="sticky left-0 whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface)] px-4 py-2.5 text-left font-normal tabular-nums"
                    >
                      {hour.h}時台
                      {live && (
                        <span className="ml-2 rounded-full border border-[var(--nb-border-strong)] px-1.5 py-px text-[10px] text-[var(--nb-text-2)]">
                          途中
                        </span>
                      )}
                    </th>
                    <td className={`${cell} font-bold`}>
                      <DataBar share={hour.diagnoses / peak}>
                        {numberFormat.format(hour.diagnoses)}
                      </DataBar>
                    </td>
                    <td className={cell}>
                      {live ? (
                        <span className="text-[var(--nb-text-3)]">–</span>
                      ) : (
                        <DeltaBadge
                          delta={numbersDelta(
                            hour.diagnoses,
                            before.diagnoses,
                            "count",
                          )}
                          size="sm"
                        />
                      )}
                    </td>
                    <td className={cell}>
                      {numberFormat.format(hour.ad_diagnoses)}
                    </td>
                    <td className={cell}>
                      {numberFormat.format(hour.diagnoses - hour.ad_diagnoses)}
                    </td>
                    <td className={cell}>{yen(hour.net)}</td>
                    <td className={cell}>
                      {numberFormat.format(hour.purchases_full)}
                    </td>
                    <td className={cell}>
                      {percent(ratio(hour.purchases_full, hour.diagnoses), 2)}
                    </td>
                    <td className={cell}>
                      {numberFormat.format(hour.purchases_upgrade)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-[var(--nb-text-2)]">
              この日のデータはまだありません
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-10 bg-gradient-to-t from-[var(--nb-surface)] to-transparent xl:block"
        />
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- 流入元 */

export function SourcesCard({
  day,
  className,
}: {
  day: NumbersDayBlock;
  className?: string;
}) {
  const total = day.sources.reduce((sum, source) => sum + source.diagnoses, 0);
  const ads = day.sources
    .filter((s) => s.is_ad)
    .reduce((sum, s) => sum + s.diagnoses, 0);
  const adShare = ratio(ads, total);
  const TOP = 9;
  const shown = day.sources.slice(0, TOP);
  const rest = day.sources.slice(TOP);
  const rows = shown.map((source) => ({
    name: source.source || "（なし）",
    tag: source.is_ad ? "広告" : null,
    diagnoses: source.diagnoses,
    purchasers: source.purchasers,
    net: source.net,
  }));
  if (rest.length > 0) {
    rows.push({
      name: `その他（${rest.length}件）`,
      tag: null,
      diagnoses: rest.reduce((sum, s) => sum + s.diagnoses, 0),
      purchasers: rest.reduce((sum, s) => sum + s.purchasers, 0),
      net: rest.reduce((sum, s) => sum + s.net, 0),
    });
  }
  const peak = Math.max(1, ...rows.map((row) => row.diagnoses));
  const cell =
    "whitespace-nowrap border-b border-[var(--nb-border)] px-4 py-2.5 text-right tabular-nums";
  return (
    <Card
      title="流入元"
      hint="売上は、その日に診断した人が今までに買った金額"
      className={className}
    >
      <div className="px-4 pb-4 sm:px-5">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          <div
            className="bg-[var(--nb-accent)]"
            style={{ width: `${(adShare ?? 0) * 100}%` }}
          />
          <div className="flex-1 bg-[var(--nb-compare)] opacity-60" />
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-[var(--nb-text-2)]">
          <span>
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[var(--nb-accent)]"
            />
            広告{" "}
            <span className="font-bold text-[var(--nb-text)]">
              {percent(adShare)}
            </span>{" "}
            ({numberFormat.format(ads)})
          </span>
          <span>
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[var(--nb-compare)] opacity-60"
            />
            非広告{" "}
            <span className="font-bold text-[var(--nb-text)]">
              {percent(adShare === null ? null : 1 - adShare)}
            </span>{" "}
            ({numberFormat.format(total - ads)})
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {[
                "流入元",
                "診断数",
                "構成比",
                "購入者",
                "純売上",
                "診断あたり",
              ].map((label, index) => (
                <th
                  key={index}
                  scope="col"
                  className={`sticky top-0 z-[1] whitespace-nowrap border-y border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-4 py-2.5 text-xs font-normal text-[var(--nb-text-2)] ${
                    index === 0 ? "left-0 z-[2] text-left" : "text-right"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="hover:bg-[var(--nb-surface-2)]">
                <th
                  scope="row"
                  className="sticky left-0 max-w-[11rem] truncate whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface)] px-4 py-2.5 text-left font-normal"
                >
                  {row.name}
                  {row.tag && (
                    <span className="ml-2 rounded-full border border-[var(--nb-accent)] px-1.5 py-px text-[10px] text-[var(--nb-accent)]">
                      {row.tag}
                    </span>
                  )}
                </th>
                <td className={`${cell} font-bold`}>
                  <DataBar share={row.diagnoses / peak}>
                    {numberFormat.format(row.diagnoses)}
                  </DataBar>
                </td>
                <td className={cell}>{percent(ratio(row.diagnoses, total))}</td>
                <td className={cell}>{numberFormat.format(row.purchasers)}</td>
                <td className={cell}>{yen(row.net)}</td>
                <td className={cell}>
                  {row.diagnoses > 0
                    ? `¥${(row.net / row.diagnoses).toFixed(2)}`
                    : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-[var(--nb-text-2)]">
            この日のデータはまだありません
          </p>
        )}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- 口コミ */

export function SocialCards({
  day,
  compare,
  compareLabel,
  className,
}: {
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
  compareLabel: string;
  className?: string;
}) {
  const nonAd = (block: NumbersDayBlock) => {
    const diagnoses = sumHours(block.hours, (hour) => hour.diagnoses);
    const ads = sumHours(block.hours, (hour) => hour.ad_diagnoses);
    return {
      value: ratio(diagnoses - ads, diagnoses),
      part: diagnoses - ads,
      whole: diagnoses,
    };
  };
  const cohort =
    (key: "friend_owners" | "sharers") => (block: NumbersDayBlock) => ({
      value: ratio(block.cohort[key], block.cohort.diagnosers),
      part: block.cohort[key],
      whole: block.cohort.diagnosers,
    });
  const items = [
    { label: "非広告流入比率", note: "X・TikTok 以外から来た人", pick: nonAd },
    {
      label: "友達診断率",
      note: "友達の回答をもらった人",
      pick: cohort("friend_owners"),
    },
    { label: "シェア率", note: "シェア操作をした人", pick: cohort("sharers") },
  ];
  return (
    <Card
      title="口コミ"
      hint="友達診断率とシェア率は、日がたつと増えます（新しい日ほど低く出ます）"
      className={className}
    >
      <div className="grid flex-1 gap-px bg-[var(--nb-border)] sm:grid-cols-3 xl:grid-cols-1">
        {items.map((item) => {
          const now = item.pick(day);
          const before = item.pick(compare);
          const share = Math.max(0, Math.min(1, now.value ?? 0));
          return (
            <div
              key={item.label}
              className="bg-[var(--nb-surface)] px-4 py-4 sm:px-5"
            >
              <p className="text-xs font-bold text-[var(--nb-text-2)]">
                {item.label}
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-2xl font-bold leading-none tabular-nums text-[var(--nb-text)]">
                  {percent(now.value)}
                </span>
                <DeltaBadge
                  delta={numbersDelta(now.value, before.value, "rate")}
                  size="sm"
                />
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--nb-surface-2)]">
                <div
                  className="h-full rounded-full bg-[var(--nb-accent)]"
                  style={{ width: `${share * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs tabular-nums text-[var(--nb-text-2)]">
                {item.note} {numberFormat.format(now.part)} ÷{" "}
                {numberFormat.format(now.whole)}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-[var(--nb-text-2)]">
                {compareLabel} {percent(before.value)}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
