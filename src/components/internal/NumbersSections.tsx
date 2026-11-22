"use client";

// 社内向け数値画面の各ブロック。受け取った数字を並べるだけで、取得や状態は持たない。
import {
  HEADLINES,
  forecastHeadline,
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

import { NumbersSparkline } from "./NumbersHourlyChart";
import {
  AnimatedNumber,
  Card,
  DataBar,
  DeltaBadge,
  RingGauge,
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
  forecastBasis,
  selected,
  onSelect,
  isToday,
  currentHour,
  nowHours,
}: {
  day: NumbersDayBlock;
  /** 比べる相手。まだ用意できていないときは null (増減を出さない)。 */
  comparison: NumbersComparison | null;
  /** 着地見込みの元にする相手。今日の表示で、1 時間以上たってから渡す。 */
  forecastBasis: NumbersComparison | null;
  selected: HeadlineKey;
  onSelect: (key: HeadlineKey) => void;
  isToday: boolean;
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
        const previous = comparison
          ? headlineValue(item, comparison.untilCut)
          : null;
        const forecast = forecastHeadline(item, value, forecastBasis);
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
                <AnimatedNumber
                  value={value}
                  format={(shown) => formatNumbersValue(shown, item.kind)}
                />
              </span>
              <DeltaBadge delta={numbersDelta(value, previous, item.kind)} />
            </span>
            <span className="relative mt-1.5 truncate text-xs tabular-nums text-[var(--nb-text-2)]">
              {comparison
                ? `${comparison.shortLabel}${isToday ? "の同時刻" : ""} ${formatNumbersValue(previous, item.kind)}`
                : "比較する数字を用意しています..."}
            </span>
            {/* 見込みの行は、出ない指標でも高さを取っておく (カードの高さをそろえる)。 */}
            <span className="relative mt-0.5 min-h-4 truncate text-xs tabular-nums text-[var(--nb-text-2)]">
              {forecast !== null && (
                <>
                  着地見込み{" "}
                  <span className="font-bold text-[var(--nb-text)]">
                    {formatNumbersValue(forecast, item.kind)}
                  </span>
                </>
              )}
            </span>
            <span className="relative mt-2.5 block">
              <NumbersSparkline
                metric={item}
                hours={day.hours}
                compareHours={comparison?.hours ?? null}
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

/**
 * 段階の並び。主役は率 (大きな数字と棒)。件数は母数として下に小さく添える。
 * 白い線は比較日の率。
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
    <ol className="flex flex-col px-4 pb-4 sm:px-5">
      {steps.map((step) => {
        const value = step.value(day);
        if (!step.base) {
          // 流れの起点。率の母数になる数なので、件数のまま控えめに出す。
          return (
            <li
              key={step.label}
              className="flex items-baseline gap-3 border-b border-[var(--nb-border)] pb-3"
            >
              <span className="mr-auto truncate text-sm text-[var(--nb-text)]">
                {step.label}
                <span className="ml-2 text-xs text-[var(--nb-text-2)]">
                  母数
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-[var(--nb-text-2)]">
                <span className="font-bold text-[var(--nb-text)]">
                  {numberFormat.format(value)}
                </span>{" "}
                {step.unit}
                <span className="ml-2">
                  {compareLabel} {numberFormat.format(step.value(compare))}
                </span>
              </span>
            </li>
          );
        }
        const base = step.base.value(day);
        const compareBase = step.base.value(compare);
        const rate = ratio(value, base);
        const compareRate = ratio(step.value(compare), compareBase);
        const steady =
          base >= MIN_BASE_FOR_DELTA && compareBase >= MIN_BASE_FOR_DELTA;
        const overall = step.overall
          ? ratio(value, step.overall.value(day))
          : null;
        // 率が小さい段階 (数 %) は 2 桁まで出す。
        const digits = rate !== null && rate < 0.1 ? 2 : 1;
        return (
          <li key={step.label} className="mt-3.5">
            <div className="flex items-baseline gap-2">
              <span className="mr-auto min-w-0 truncate text-sm text-[var(--nb-text)]">
                {step.label}
                <span className="ml-2 text-xs text-[var(--nb-text-2)]">
                  {step.base.label}
                </span>
              </span>
              {steady && (
                <DeltaBadge
                  delta={numbersDelta(rate, compareRate, "rate")}
                  size="sm"
                />
              )}
              <span className="min-w-[4.25rem] shrink-0 text-right text-lg font-bold leading-none tabular-nums text-[var(--nb-text)]">
                <AnimatedNumber
                  value={rate}
                  format={(shown) => percent(shown, digits)}
                />
              </span>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-[var(--nb-surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--nb-accent)] transition-[width] duration-500 ease-out"
                style={{
                  width: `${Math.max(rate && rate > 0 ? 1 : 0, Math.min(1, rate ?? 0) * 100)}%`,
                }}
              />
              {compareRate !== null && (
                <span
                  aria-hidden
                  className="absolute top-[-3px] h-[14px] w-0.5 rounded-full bg-[var(--nb-text)]"
                  style={{
                    left: `calc(${Math.min(1, compareRate) * 100}% - 1px)`,
                  }}
                />
              )}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs tabular-nums text-[var(--nb-text-2)]">
              <span>
                {compareLabel} {percent(compareRate, digits)}
              </span>
              {step.overall && (
                <span>
                  {step.overall.label} {percent(overall, 2)}
                </span>
              )}
              <span className="ml-auto">
                {numberFormat.format(value)} {step.unit}
              </span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

const FLOW_HINT = "大きな数字と棒は割合、白い線は比較日の割合";

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
      hint={partial ? "集計の途中です。数え終わるまで少なく出ます" : FLOW_HINT}
      className={className}
    >
      <Flow
        steps={PURCHASE_FLOW}
        day={day}
        compare={compare}
        compareLabel={compareLabel}
      />
      <p className="mt-auto border-t border-[var(--nb-border)] px-4 py-3 text-xs leading-relaxed text-[var(--nb-text-2)] sm:px-5">
        セッション数で数えています（その日の同じ訪問は1回）。上の「課金率」は診断した人数で割るので、ここの率とは一致しません。
      </p>
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
      hint={`${FLOW_HINT}。イベントの回数で数えています`}
      className={className}
    >
      <div className="grid flex-1 gap-px bg-[var(--nb-border)] md:grid-cols-2">
        {[
          { title: "招待する本人", steps: INVITER_FLOW },
          { title: "招待された友達", steps: FRIEND_FLOW },
        ].map((flow) => (
          <div key={flow.title} className="bg-[var(--nb-surface)] pt-3">
            <h3 className="px-4 text-xs font-bold text-[var(--nb-text-2)] sm:px-5">
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
  comparison,
  currentHour,
  className,
}: {
  day: NumbersDayBlock;
  comparison: NumbersComparison | null;
  currentHour: number | null;
  className?: string;
}) {
  const last = currentHour ?? 23;
  // 新しい時間帯を上に (開いてすぐ直近が見えるように)。
  const rows = day.hours.filter((hour) => hour.h <= last).reverse();
  const peak = Math.max(1, ...rows.map((hour) => hour.diagnoses));
  const head = [
    "時",
    "診断数",
    comparison ? `${comparison.label}比` : "比較",
    "広告",
    "非広告",
    "純売上",
    "買い切り",
    "課金率",
    "アップグレード",
  ];
  const cell =
    "whitespace-nowrap border-b border-[var(--nb-border)] px-4 py-2.5 text-right tabular-nums";
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
            {/* PC では最後の行が下端のぼかしに隠れないよう、下に余白を取る。 */}
            <tbody className="xl:[&>tr:last-child>*]:pb-9">
              {rows.map((hour) => {
                const before = comparison?.hours[hour.h];
                const live = hour.h === currentHour;
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
                      {live || !before ? (
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
            className="bg-[var(--nb-accent)] transition-[width] duration-500 ease-out"
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
                  className={`whitespace-nowrap border-y border-[var(--nb-border)] bg-[var(--nb-surface-2)] px-4 py-2.5 text-xs font-normal text-[var(--nb-text-2)] ${
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
      title="口コミ"
      hint="友達診断率とシェア率は、診断のあと日がたつほど増えます"
      className={className}
    >
      <div className="grid flex-1 gap-px bg-[var(--nb-border)] sm:grid-cols-3">
        {items.map((item) => {
          const now = item.pick(day);
          const before = item.pick(compare);
          return (
            <div
              key={item.label}
              className="flex flex-col items-center bg-[var(--nb-surface)] px-4 py-5 text-center"
            >
              <p className="text-xs font-bold text-[var(--nb-text-2)]">
                {item.label}
              </p>
              <span className="mt-3">
                <RingGauge share={now.value} size={104}>
                  <span className="text-xl font-bold tabular-nums text-[var(--nb-text)]">
                    {percent(now.value)}
                  </span>
                </RingGauge>
              </span>
              <p className="mt-3 text-xs tabular-nums text-[var(--nb-text-2)]">
                {item.note}
                <br />
                {numberFormat.format(now.part)} ÷{" "}
                {numberFormat.format(now.whole)}
              </p>
              <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-xs tabular-nums text-[var(--nb-text-2)]">
                {item.comparable ? (
                  <>
                    {compareLabel} {percent(before.value)}
                    <DeltaBadge
                      delta={numbersDelta(now.value, before.value, "rate")}
                      size="sm"
                    />
                  </>
                ) : (
                  <>
                    {compareLabel}に診断した人は {percent(before.value)}
                    <span className="basis-full text-[var(--nb-text-3)]">
                      ※日数が違うため参考
                    </span>
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
