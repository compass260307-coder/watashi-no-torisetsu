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
  type NumbersComparison,
  type NumbersDayBlock,
  type NumbersHourEvents,
} from "@/lib/internal-numbers";

import {
  AnimatedNumber,
  Card,
  DataBar,
  DeltaBadge,
  DeltaText,
  numberFormat,
  percent,
  yen,
} from "./numbers-ui";

// 率の増減に色を付けるのは、分母がこの数以上あるときだけ。
// 分母が小さい率は 1〜2 件の差で大きく動き、偶然の揺れを変化に見せてしまう。
const MIN_BASE_FOR_DELTA = 100;

/* ------------------------------------------------------------------ 指標 */

export function KpiRow({
  day,
  comparison,
  selected,
  onSelect,
  isToday,
}: {
  day: NumbersDayBlock;
  /** 比べる相手。まだ用意できていないときは null (増減を出さない)。 */
  comparison: NumbersComparison | null;
  selected: HeadlineKey;
  onSelect: (key: HeadlineKey) => void;
  isToday: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="グラフに出す指標"
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--nb-border)] bg-[var(--nb-border)] [gap:1px] md:grid-cols-5"
    >
      {HEADLINES.map((item, index) => {
        const value = headlineValue(item, day.until_cut);
        const previous = comparison
          ? headlineValue(item, comparison.untilCut)
          : null;
        const active = item.key === selected;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.key)}
            className={`relative flex min-w-0 flex-col px-4 pb-4 pt-3.5 text-left transition-colors xl:px-5 ${
              index === 0 ? "col-span-2 md:col-span-1" : ""
            } ${
              active
                ? "bg-[var(--nb-surface)]"
                : "bg-[var(--nb-surface-2)] hover:bg-[var(--nb-surface)]"
            }`}
          >
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{
                background: active ? "var(--nb-accent)" : "transparent",
              }}
            />
            <span
              className={`text-[13px] font-semibold ${active ? "text-[var(--nb-text)]" : "text-[var(--nb-text-2)]"}`}
            >
              {item.label}
            </span>
            <span className="mt-1.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--nb-text)] xl:text-[2rem]">
              <AnimatedNumber
                value={value}
                format={(shown) => formatNumbersValue(shown, item.kind)}
              />
            </span>
            <span className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13px] tabular-nums text-[var(--nb-text-2)]">
              {comparison ? (
                <>
                  <DeltaBadge
                    size="sm"
                    delta={numbersDelta(value, previous, item.kind)}
                  />
                  <span className="truncate">
                    {comparison.shortLabel}
                    {isToday ? "同時刻" : ""}{" "}
                    {formatNumbersValue(previous, item.kind)}
                  </span>
                </>
              ) : (
                "比較を用意しています..."
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- ファネル */

type Count = (block: NumbersDayBlock) => number;

interface FlowStep {
  label: string;
  /** この段階の数 (セッション数かイベントの回数)。率の分子で、母数として小さく添える。 */
  value: Count;
  /** 数の単位。"セッション" か "回"。 */
  unit: string;
  /**
   * 主役として出す率の分母。件数は診断数が増えれば一緒に増えて良し悪しが読めないので、
   * どの段階も「何に対する割合か」で見せる。流れの起点 (母数そのもの) には無い。
   */
  base?: { label: string; value: Count };
  /** 補足として出す、流れ全体での割合 (例: 診断完了のうち何 % が購入まで来たか)。 */
  overall?: { label: string; value: Count };
}

const event =
  (key: keyof NumbersHourEvents): Count =>
  (block) =>
    sumEvents(block.hours, key);
const sessions =
  (name: string): Count =>
  (block) =>
    block.sessions[name] ?? 0;

// 課金ファネルはセッション数 (その日の同じ訪問は 1 回) で数える。イベントの回数だと、
// 同じ人が課金表示を何度も見るため「診断完了から 104%」のように 100% を超えてしまう
// (2026-11-22 の実データで確認)。
const started = sessions("diagnosis_started");
const completed = sessions("diagnosis_completed");
const paywall = sessions("paywall_viewed");
const cta = sessions("purchase_cta_clicked");
const checkout = sessions("checkout_session_created");
const fromCompleted = { label: "診断完了の", value: completed };

const PURCHASE_FLOW: FlowStep[] = [
  { label: "診断開始", value: started, unit: "セッション" },
  {
    label: "診断完了",
    value: completed,
    unit: "セッション",
    base: { label: "診断開始から", value: started },
  },
  {
    label: "課金表示",
    value: paywall,
    unit: "セッション",
    base: { label: "診断完了から", value: completed },
  },
  {
    label: "購入ボタン",
    value: cta,
    unit: "セッション",
    base: { label: "課金表示から", value: paywall },
    overall: fromCompleted,
  },
  {
    label: "決済画面",
    value: checkout,
    unit: "セッション",
    base: { label: "購入ボタンから", value: cta },
    overall: fromCompleted,
  },
  {
    label: "購入完了",
    value: sessions("purchase_completed"),
    unit: "セッション",
    base: { label: "決済画面から", value: checkout },
    overall: fromCompleted,
  },
];

// 友達診断は、招待する本人の流れと、招待された友達の流れに分かれる (別々の人の行動)。
// こちらはイベントの回数。起点の段階は、その日の診断完了の回数に対する割合で見せる。
const completedEvents = event("completed");
const takoViewed = event("tako_viewed");
const takoPaywall = event("tako_paywall");
const friendLanding = event("friend_landing");
const friendCompleted = event("friend_completed");

const INVITER_FLOW: FlowStep[] = [
  {
    label: "友達診断ページ表示",
    value: takoViewed,
    unit: "回",
    base: { label: "診断完了に対して", value: completedEvents },
  },
  {
    label: "招待クリック",
    value: event("invite_clicked"),
    unit: "回",
    base: { label: "ページ表示から", value: takoViewed },
  },
  {
    label: "課金表示",
    value: takoPaywall,
    unit: "回",
    base: { label: "ページ表示から", value: takoViewed },
  },
  {
    label: "購入",
    value: event("tako_paid"),
    unit: "回",
    base: { label: "課金表示から", value: takoPaywall },
    overall: { label: "ページ表示の", value: takoViewed },
  },
];
const FRIEND_FLOW: FlowStep[] = [
  {
    label: "リンクを開いた",
    value: friendLanding,
    unit: "回",
    base: { label: "診断完了に対して", value: completedEvents },
  },
  {
    label: "回答完了",
    value: friendCompleted,
    unit: "回",
    base: { label: "リンクを開いたから", value: friendLanding },
  },
  {
    label: "自己診断へ",
    value: event("friend_to_self"),
    unit: "回",
    base: { label: "回答完了から", value: friendCompleted },
  },
];

// 段階の数ごとの、広い画面での列数。
const FLOW_COLUMNS: Record<number, string> = {
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  6: "lg:grid-cols-6",
};

/**
 * 段階を左から右へ並べる (狭い画面では 2 列)。1 つの段階が 1 つの箱で、主役は率の大きな数字。
 * 率は「その段階の数 ÷ 基準の段階の数」。棒は率の長さ、棒の上の線は比較日の率。
 * 件数は診断数が増えれば一緒に増えて良し悪しが読めないので、小さく添えるだけにする。
 */
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
  return (
    <ol
      className={`grid grid-cols-2 gap-px bg-[var(--nb-border)] ${FLOW_COLUMNS[steps.length] ?? "lg:grid-cols-4"}`}
    >
      {steps.map((step, index) => {
        const value = step.value(day);
        const compareValue = step.value(compare);
        const base = step.base ? step.base.value(day) : null;
        const compareBase = step.base ? step.base.value(compare) : null;
        const rate = base === null ? null : ratio(value, base);
        const compareRate =
          compareBase === null ? null : ratio(compareValue, compareBase);
        // 分母が小さい率は 1〜2 件の差で大きく動くので、増減を出さない。
        const steady =
          base !== null &&
          compareBase !== null &&
          base >= MIN_BASE_FOR_DELTA &&
          compareBase >= MIN_BASE_FOR_DELTA;
        const overall = step.overall
          ? ratio(value, step.overall.value(day))
          : null;
        // 率が小さい段階 (数 %) は 2 桁まで出す。
        const digits = rate !== null && rate < 0.1 ? 2 : 1;
        return (
          <li
            key={step.label}
            className={`relative flex min-w-0 flex-col bg-[var(--nb-surface)] px-4 py-4 2xl:px-5 ${
              steps.length % 2 === 1 && index === steps.length - 1
                ? "col-span-2 lg:col-span-1"
                : ""
            }`}
          >
            <p className="flex min-w-0 flex-col">
              <span className="text-[13px] font-semibold text-[var(--nb-text)]">
                {step.label}
              </span>
              <span className="min-h-[1.25rem] text-[13px] text-[var(--nb-text-3)]">
                {step.base?.label ?? ""}
              </span>
            </p>
            <p className="mt-2 flex items-baseline gap-1.5 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--nb-text)]">
              {step.base ? (
                <AnimatedNumber
                  value={rate}
                  format={(shown) => percent(shown, digits)}
                />
              ) : (
                <>
                  <AnimatedNumber
                    value={value}
                    format={(shown) =>
                      shown === null
                        ? "–"
                        : numberFormat.format(Math.round(shown))
                    }
                  />
                  <span className="text-sm font-medium tracking-normal text-[var(--nb-text-2)]">
                    {step.unit}
                  </span>
                </>
              )}
            </p>
            {/* 起点には率が無い。ほかの箱と高さをそろえるため、棒の場所だけ空けておく。 */}
            <div
              className="relative mt-3 h-1"
              style={{
                background: step.base ? "var(--nb-surface-2)" : "transparent",
              }}
            >
              {step.base && (
                <div
                  className="h-full bg-[var(--nb-accent)] transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.max(rate && rate > 0 ? 1.5 : 0, Math.min(1, rate ?? 0) * 100)}%`,
                  }}
                />
              )}
              {step.base && compareRate !== null && (
                <span
                  aria-hidden
                  className="absolute top-[-3px] h-[10px] w-px bg-[var(--nb-text)]"
                  style={{
                    left: `calc(${Math.min(1, compareRate) * 100}% - 1px)`,
                  }}
                />
              )}
            </div>
            <div className="mt-3 grid gap-0.5 text-[13px] tabular-nums text-[var(--nb-text-2)]">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span>{compareLabel}</span>
                <span className="text-[var(--nb-text)]">
                  {step.base
                    ? percent(compareRate, digits)
                    : numberFormat.format(compareValue)}
                </span>
                {step.base && steady && (
                  <DeltaText delta={numbersDelta(rate, compareRate, "rate")} />
                )}
              </p>
              {step.base && (
                <p>
                  <span className="font-semibold text-[var(--nb-text)]">
                    {numberFormat.format(value)}
                  </span>{" "}
                  {step.unit}
                </p>
              )}
              {step.overall && (
                <p>
                  {step.overall.label}{" "}
                  <span className="font-semibold text-[var(--nb-text)]">
                    {percent(overall, 2)}
                  </span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const FLOW_HINT = "大きな数字は、前の段階から進んだ割合。棒の上の線は比較日";

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
      hint={`${FLOW_HINT}。セッション数で集計（同じ訪問は1回）。上の「課金率」は人数で割るため、一致しません`}
      action={
        partial ? (
          <span className="text-[13px] text-[var(--nb-text-2)]">
            集計の途中（数え終わるまで少なく出ます）
          </span>
        ) : null
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
      hint="大きな数字は、基準の段階から進んだ割合。回数で集計"
      className={className}
    >
      {/* 招待する本人 (4 段階) と、招待された友達 (3 段階)。広い画面では横に並べる。 */}
      <div className="grid flex-1 gap-px bg-[var(--nb-border)] xl:grid-cols-7">
        {[
          { title: "招待する本人", steps: INVITER_FLOW, span: "xl:col-span-4" },
          {
            title: "招待された友達",
            steps: FRIEND_FLOW,
            span: "xl:col-span-3",
          },
        ].map((flow) => (
          <div
            key={flow.title}
            className={`flex flex-col bg-[var(--nb-surface)] ${flow.span}`}
          >
            <h3 className="border-b border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-4 py-2 text-[13px] font-semibold text-[var(--nb-text-2)] 2xl:px-5">
              {flow.title}
            </h3>
            <div className="flex-1 bg-[var(--nb-surface)]">
              <Flow
                steps={flow.steps}
                day={day}
                compare={compare}
                compareLabel={compareLabel}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- 時間別 */

/** 0 の値は薄くする (表の中で、意味のある数字だけが目に入るように)。 */
const quiet = (value: number) => (value === 0 ? "text-[var(--nb-text-3)]" : "");

export function HoursCard({
  day,
  previous,
  currentHour,
  className,
}: {
  day: NumbersDayBlock;
  /** 前日。同じ時間帯の数字を、そのまま隣に並べる。まだ用意できていないときは null。 */
  previous: NumbersComparison | null;
  currentHour: number | null;
  className?: string;
}) {
  const last = currentHour ?? 23;
  // 新しい時間帯を上に (開いてすぐ直近が見えるように)。
  const rows = day.hours.filter((hour) => hour.h <= last).reverse();
  const peak = Math.max(1, ...rows.map((hour) => hour.diagnoses));
  const head: { label: string; beside?: boolean }[] = [
    { label: "時" },
    { label: "診断数" },
    { label: "前日", beside: true },
    { label: "広告" },
    { label: "非広告" },
    { label: "純売上" },
    { label: "前日", beside: true },
    { label: "買い切り" },
    { label: "課金率" },
    { label: "アップグレード" },
  ];
  const cell =
    "whitespace-nowrap border-b border-[var(--nb-border)] px-3.5 py-2.5 text-right tabular-nums";
  // 前日の数字は、すぐ左の数字の続きとして読めるよう左の余白を詰め、今日の数字より
  // 一段控えめにする (主役は今日)。
  const besideCell = `${cell} pl-0 text-[var(--nb-text-2)]`;
  return (
    <Card
      title="時間帯別"
      hint={
        previous
          ? `「前日」は ${previous.label.replace(/^前日\s*/, "")} の同じ時間帯の数字。広告 ＝ 流入元が X・TikTok`
          : "広告 ＝ 流入元が X・TikTok"
      }
      className={className}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="overflow-auto xl:min-h-[22rem] xl:flex-1 xl:basis-0">
          <table className="w-full min-w-max border-separate border-spacing-0 text-base">
            <thead>
              <tr>
                {head.map((column, index) => (
                  <th
                    key={index}
                    scope="col"
                    className={`sticky top-0 z-[1] whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-3.5 py-2 text-[13px] font-semibold text-[var(--nb-text-2)] ${
                      index === 0 ? "left-0 z-[2] text-left" : "text-right"
                    } ${column.beside ? "pl-0" : ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            {/* PC では最後の行が下端のぼかしに隠れないよう、下に余白を取る。 */}
            <tbody className="xl:[&>tr:last-child>*]:pb-9">
              {rows.map((hour) => {
                const live = hour.h === currentHour;
                // 前日の同じ時間帯 (丸 1 時間ぶん)。途中の時間帯でも、目安としてそのまま出す。
                const before = previous?.hours[hour.h] ?? null;
                const rate = ratio(hour.purchases_full, hour.diagnoses);
                return (
                  <tr key={hour.h} className="hover:bg-[var(--nb-surface-2)]">
                    <th
                      scope="row"
                      // 横に送っても、どの行かが分かるように先頭の列は固定する。
                      className="sticky left-0 whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface)] px-3.5 py-2.5 text-left font-semibold tabular-nums"
                    >
                      {hour.h}時台
                      {live && (
                        <span className="ml-2 rounded-sm border border-[var(--nb-border-strong)] px-1 py-px text-[13px] leading-none font-normal text-[var(--nb-text-2)]">
                          途中
                        </span>
                      )}
                    </th>
                    <td className={`${cell} font-semibold`}>
                      <DataBar share={hour.diagnoses / peak}>
                        {numberFormat.format(hour.diagnoses)}
                      </DataBar>
                    </td>
                    <td className={besideCell}>
                      {before ? numberFormat.format(before.diagnoses) : "–"}
                    </td>
                    <td className={`${cell} ${quiet(hour.ad_diagnoses)}`}>
                      {numberFormat.format(hour.ad_diagnoses)}
                    </td>
                    <td
                      className={`${cell} ${quiet(hour.diagnoses - hour.ad_diagnoses)}`}
                    >
                      {numberFormat.format(hour.diagnoses - hour.ad_diagnoses)}
                    </td>
                    <td className={`${cell} font-semibold ${quiet(hour.net)}`}>
                      {yen(hour.net)}
                    </td>
                    <td className={besideCell}>
                      {before ? yen(before.net) : "–"}
                    </td>
                    <td className={`${cell} ${quiet(hour.purchases_full)}`}>
                      {numberFormat.format(hour.purchases_full)}
                    </td>
                    <td className={`${cell} ${quiet(hour.purchases_full)}`}>
                      {percent(rate, 2)}
                    </td>
                    <td className={`${cell} ${quiet(hour.purchases_upgrade)}`}>
                      {numberFormat.format(hour.purchases_upgrade)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-10 text-center text-base text-[var(--nb-text-2)]">
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
    "whitespace-nowrap border-b border-[var(--nb-border)] px-3.5 py-2.5 text-right tabular-nums";
  return (
    <Card
      title="流入経路"
      hint="売上は、その日に診断した人の購入額"
      className={className}
    >
      <div className="px-4 py-3.5 sm:px-5">
        <div className="flex h-1.5 gap-px overflow-hidden">
          <div
            className="bg-[var(--nb-accent)] transition-[width] duration-500 ease-out"
            style={{ width: `${(adShare ?? 0) * 100}%` }}
          />
          <div className="flex-1 bg-[var(--nb-compare)] opacity-60" />
        </div>
        <div className="mt-2 flex justify-between text-[13px] tabular-nums text-[var(--nb-text-2)]">
          <span>
            <span
              aria-hidden
              className="mr-1.5 inline-block h-2 w-2 rounded-[2px] bg-[var(--nb-accent)]"
            />
            広告{" "}
            <span className="font-semibold text-[var(--nb-text)]">
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
            <span className="font-semibold text-[var(--nb-text)]">
              {percent(adShare === null ? null : 1 - adShare)}
            </span>{" "}
            ({numberFormat.format(total - ads)})
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate border-spacing-0 text-base">
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
                  className={`whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-3.5 py-2 text-[13px] font-semibold text-[var(--nb-text-2)] ${
                    index === 0 ? "sticky left-0 z-[1] text-left" : "text-right"
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
                  className="sticky left-0 max-w-[11rem] truncate whitespace-nowrap border-b border-[var(--nb-border)] bg-[var(--nb-surface)] px-3.5 py-2.5 text-left font-semibold"
                >
                  {row.name}
                  {row.tag && (
                    <span className="ml-2 rounded-sm border border-[var(--nb-accent)] px-1 py-px text-[13px] leading-none text-[var(--nb-accent)]">
                      {row.tag}
                    </span>
                  )}
                </th>
                <td className={`${cell} font-semibold`}>
                  <DataBar share={row.diagnoses / peak}>
                    {numberFormat.format(row.diagnoses)}
                  </DataBar>
                </td>
                <td className={cell}>{percent(ratio(row.diagnoses, total))}</td>
                <td className={`${cell} ${quiet(row.purchasers)}`}>
                  {numberFormat.format(row.purchasers)}
                </td>
                <td className={`${cell} font-semibold ${quiet(row.net)}`}>
                  {yen(row.net)}
                </td>
                <td className={`${cell} ${quiet(row.net)}`}>
                  {row.diagnoses > 0
                    ? `¥${(row.net / row.diagnoses).toFixed(2)}`
                    : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-base text-[var(--nb-text-2)]">
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
    {
      label: "非広告流入比率",
      note: "X・TikTok 以外から来た人",
      pick: nonAd,
      // その日のうちに決まる数字なので、比較日とそのまま比べられる。
      comparable: true,
    },
    {
      label: "友達診断率",
      note: "友達の回答をもらった人",
      pick: cohort("friend_owners"),
      // 診断のあと日がたつほど増える数字。比較日は 1 日多くたっているので、増減は出さない。
      comparable: false,
    },
    {
      label: "シェア率",
      note: "シェア操作をした人",
      pick: cohort("sharers"),
      comparable: false,
    },
  ];
  return (
    <Card
      title="口コミ・シェア"
      hint="友達診断率とシェア率は、診断のあと日がたつほど増えます"
      className={className}
    >
      {/* ファネルの箱と同じ形: 名前、何の割合か、大きな数字、棒、比較と内訳。 */}
      <div className="grid flex-1 gap-px bg-[var(--nb-border)] sm:grid-cols-3">
        {items.map((item) => {
          const now = item.pick(day);
          const before = item.pick(compare);
          return (
            <div
              key={item.label}
              className="flex min-w-0 flex-col bg-[var(--nb-surface)] px-4 py-4 2xl:px-5"
            >
              <p className="flex min-w-0 flex-col">
                <span className="text-[13px] font-semibold text-[var(--nb-text)]">
                  {item.label}
                </span>
                <span className="text-[13px] text-[var(--nb-text-3)]">
                  {item.note}
                </span>
              </p>
              <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--nb-text)]">
                <AnimatedNumber
                  value={now.value}
                  format={(shown) => percent(shown)}
                />
              </p>
              <div className="relative mt-3 h-1 bg-[var(--nb-surface-2)]">
                <div
                  className="h-full bg-[var(--nb-accent)] transition-[width] duration-500 ease-out"
                  style={{
                    width: `${Math.min(1, now.value ?? 0) * 100}%`,
                  }}
                />
                {before.value !== null && (
                  <span
                    aria-hidden
                    className="absolute top-[-3px] h-[10px] w-px bg-[var(--nb-text)]"
                    style={{
                      left: `calc(${Math.min(1, before.value) * 100}% - 1px)`,
                    }}
                  />
                )}
              </div>
              <div className="mt-3 grid gap-0.5 text-[13px] tabular-nums text-[var(--nb-text-2)]">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span>
                    {compareLabel}
                    {item.comparable ? "" : "に診断した人"}
                  </span>
                  <span className="font-semibold text-[var(--nb-text)]">
                    {percent(before.value)}
                  </span>
                  {item.comparable && (
                    <DeltaText
                      delta={numbersDelta(now.value, before.value, "rate")}
                    />
                  )}
                </p>
                <p>
                  <span className="font-semibold text-[var(--nb-text)]">
                    {numberFormat.format(now.part)}
                  </span>{" "}
                  ÷ {numberFormat.format(now.whole)} 人
                </p>
                {!item.comparable && (
                  <p className="text-[13px] text-[var(--nb-text-3)]">
                    日数が違うため、比較は参考
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
