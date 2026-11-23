"use client";

// 採算 (広告費・利益・CPA)。広告費は、実績が入っている時間帯は実績、入っていない時間帯は
// 手で入れた配信計画の金額で補う。どちらの数字かを必ず表示する。
// 1 日の着地見込みは出さない (2026-11-22 本人の指定)。
import {
  costUntil,
  economics,
  formatNumbersDay,
  type NumbersCosts,
  type NumbersPayload,
} from "@/lib/internal-numbers";

import { AnimatedNumber, Card, numberFormat } from "./numbers-ui";

const signedYen = (value: number | null) =>
  value === null
    ? "–"
    : `${value < 0 ? "−" : ""}¥${numberFormat.format(Math.abs(Math.round(value)))}`;
const unitYen = (value: number | null) =>
  value === null ? "–" : `¥${value.toFixed(2)}`;

/** その時刻までの広告費。実績も計画も無い日は null (「未入力」として扱う)。 */
function spentUntil(costs: NumbersCosts, untilHours: number) {
  const spent = costUntil(costs, untilHours);
  return costs.has_actual || spent.plan > 0 ? spent : null;
}

export function EconomicsCard({
  payload,
  onOpenEntry,
}: {
  payload: NumbersPayload;
  onOpenEntry: () => void;
}) {
  const { meta, day, compare, costs, settings } = payload;
  // 広告費の SQL がまだ入っていない環境では、この欄ごと出さない。
  if (!costs || !settings) return null;

  const untilHours = meta.is_today ? meta.elapsed_seconds / 3600 : 24;
  const spent = spentUntil(costs.day, untilHours);
  const now = spent ? economics(day.until_cut, spent.cost, settings) : null;
  const spentBefore = meta.compare_pending
    ? null
    : spentUntil(costs.compare, untilHours);
  const before = spentBefore
    ? economics(compare.until_cut, spentBefore.cost, settings)
    : null;
  const compareNote = `${formatNumbersDay(meta.compare_day)}${meta.is_today ? "の同時刻" : ""}`;

  // 実績か推定かを、色だけに頼らず言葉で出す。
  const basis = !spent
    ? { label: "未入力", tone: "var(--nb-text-2)" }
    : spent.plan <= 0
      ? { label: "実績", tone: "var(--nb-up)" }
      : spent.actual > 0 || costs.day.has_actual
        ? { label: "一部推定", tone: "var(--nb-text-2)" }
        : { label: "推定（配信計画）", tone: "var(--nb-text-2)" };
  const estimated = basis.label !== "実績";
  // 一部のアカウントの分しか入っていないと、広告費が少なく出る。気づけるように知らせる。
  const partialAccounts =
    costs.day.accounts_with_actual > 0 &&
    costs.day.accounts_with_actual < costs.day.accounts_recent;

  const cells = [
    {
      label: "広告費",
      value: now?.cost ?? null,
      format: signedYen,
      before: before ? signedYen(before.cost) : null,
      tone: undefined as string | undefined,
      extra: null as string | null,
    },
    {
      label: "利益",
      value: now?.profit ?? null,
      format: signedYen,
      before: before ? signedYen(before.profit) : null,
      // 赤字・黒字は、符号に加えて色でも分かるようにする。広告費が推定を含むときは
      // 色を付けない (推定の利益を、確かな黒字・赤字のように見せないため)。
      tone: now && estimated
        ? undefined
        : now
          ? now.profit < 0
          ? "var(--nb-down)"
          : "var(--nb-up)"
        : undefined,
      extra: null,
    },
    {
      label: "CPA（広告流入の診断1件）",
      value: now?.cpaAd ?? null,
      format: unitYen,
      before: before ? unitYen(before.cpaAd) : null,
      tone: undefined,
      extra:
        now && now.cpaAll !== null
          ? `診断全体では ${unitYen(now.cpaAll)}`
          : null,
    },
  ];

  return (
    <Card
      title="採算"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-[13px] font-semibold"
            style={{ color: basis.tone }}
          >
            広告費: {basis.label}
          </span>
          <button
            type="button"
            onClick={onOpenEntry}
            className="h-8 rounded-md border border-[var(--nb-border-strong)] px-3 text-[13px] font-semibold text-[var(--nb-text)] transition-colors hover:bg-[var(--nb-surface-2)]"
          >
            広告費を入れる
          </button>
        </div>
      }
    >
      <dl className="grid gap-px bg-[var(--nb-border)] sm:grid-cols-3">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className="min-w-0 bg-[var(--nb-surface)] px-4 py-4 sm:px-5"
          >
            <dt className="flex items-baseline gap-2 text-[13px] font-semibold text-[var(--nb-text)]">
              {cell.label}
              {estimated && cell.label !== "広告費" && now && (
                <span className="font-normal text-[var(--nb-text-3)]">推定</span>
              )}
            </dt>
            <dd className="mt-2">
              <span
                className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums"
                style={{ color: cell.tone ?? "var(--nb-text)" }}
              >
                <AnimatedNumber value={cell.value} format={cell.format} />
              </span>
              <span className="mt-2 block min-h-5 truncate text-[13px] tabular-nums text-[var(--nb-text-2)]">
                {cell.before !== null ? (
                  <>
                    {compareNote}{" "}
                    <span className="text-[var(--nb-text)]">
                      {cell.before}
                    </span>
                  </>
                ) : now && !meta.compare_pending ? (
                  `${formatNumbersDay(meta.compare_day)}は広告費が未入力`
                ) : (
                  ""
                )}
              </span>
              <span className="mt-0.5 block min-h-4 truncate text-[13px] tabular-nums text-[var(--nb-text-2)]">
                {cell.extra}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-[var(--nb-border)] px-4 py-2.5 text-[13px] leading-relaxed tabular-nums text-[var(--nb-text-2)] sm:px-5">
        {now && spent ? (
          <>
            純売上 {signedYen(day.until_cut.net)} − 手数料 {signedYen(now.fee)}{" "}
            − サーバー・AI {signedYen(now.server + now.ai)} − 広告費{" "}
            {signedYen(now.cost)}
            {spent.plan > 0 && (
              <span className="ml-2">
                ／ 広告費のうち {signedYen(spent.plan)} は配信計画からの推定です
                {costs.day.actual_through_hour !== null
                  ? `（時間別の実績は${costs.day.actual_through_hour}時台まで）`
                  : "（実績はまだ入っていません）"}
              </span>
            )}
            {partialAccounts && (
              <span className="ml-2 font-semibold text-[var(--nb-down)]">
                ※実績が入っているのは {costs.day.accounts_with_actual}
                アカウントです（直近7日は {costs.day.accounts_recent}
                アカウントに実績があります）
              </span>
            )}
          </>
        ) : (
          "この日の広告費がまだ入っていません。「広告費を入れる」から、X広告マネージャーのエクスポートを置くか、金額や配信計画を入れてください。"
        )}
      </p>
    </Card>
  );
}
