"use client";

// 採算 (広告費・利益・CPA)。広告費は、実績が入っている時間帯は実績、入っていない時間帯は
// 手で入れた配信計画の金額で補う。どちらの数字かを必ず表示する。
// 1 日の着地見込みは出さない (2026-11-22 本人の指定)。
import type { ReactNode } from "react";

import {
  costUntil,
  economics,
  formatNumbersDay,
  type NumbersCosts,
  type NumbersPayload,
} from "@/lib/internal-numbers";

import {
  AnimatedNumber,
  OUTLINE_BUTTON,
  Section,
  numberFormat,
} from "./numbers-ui";

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

  // 広告費に推定 (配信計画の金額) が含まれるか。含まれるときは、利益と CPA にも「推定」と出す。
  const estimated = !spent || spent.plan > 0;
  // 一部のアカウントの分しか入っていないと、広告費が少なく出る。気づけるように知らせる。
  const partialAccounts =
    costs.day.accounts_with_actual > 0 &&
    costs.day.accounts_with_actual < costs.day.accounts_recent;
  // 式に並べる金額は 1 円単位に丸めて出す。項ごとに丸めると、足し引きした結果が利益と
  // 1 円ずれることがあるので、ずれは概算の項 (サーバー・AI) に寄せて、式が必ず合うようにする。
  const shown = now
    ? {
        net: Math.round(day.until_cut.net),
        fee: Math.round(now.fee),
        cost: Math.round(now.cost),
        profit: Math.round(now.profit),
      }
    : null;
  const shownServerAi = shown
    ? shown.net - shown.fee - shown.cost - shown.profit
    : null;
  // 比較日の数字に添える言葉。比較日の広告費が無いときは、そのことを言う。
  const beforeNote = (value: string | null): ReactNode =>
    value !== null ? (
      <>
        {compareNote} <span className="text-[var(--nb-text)]">{value}</span>
      </>
    ) : now && !meta.compare_pending ? (
      `${formatNumbersDay(meta.compare_day)}は広告費が未入力`
    ) : null;

  return (
    <Section
      title="採算"
      note={
        !spent ? (
          "広告費が未入力"
        ) : spent.plan <= 0 ? (
          "広告費は実績"
        ) : (
          <>
            広告費のうち {signedYen(spent.plan)} は配信計画からの推定
            {costs.day.actual_through_hour !== null
              ? `（時間別の実績は${costs.day.actual_through_hour}時台まで）`
              : "（実績はまだ入っていません）"}
          </>
        )
      }
      action={
        <button type="button" onClick={onOpenEntry} className={OUTLINE_BUTTON}>
          広告費を入れる
        </button>
      }
    >
      {now && spent ? (
        // 利益がどう出たかを、式のまま左から右へ並べる (狭い画面では 2 列に畳む)。
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 pt-5 lg:flex lg:flex-wrap lg:items-start lg:gap-x-0">
          <Term label="純売上" value={shown?.net ?? null} format={signedYen} />
          <Operator>−</Operator>
          <Term label="手数料" value={shown?.fee ?? null} format={signedYen} />
          <Operator>−</Operator>
          <Term label="サーバー・AI" value={shownServerAi} format={signedYen} />
          <Operator>−</Operator>
          <Term
            label="広告費"
            value={shown?.cost ?? null}
            format={signedYen}
            notes={[beforeNote(before ? signedYen(before.cost) : null)]}
          />
          <Operator>=</Operator>
          <Term
            large
            label="利益"
            tag={estimated ? "推定" : null}
            value={shown?.profit ?? null}
            format={signedYen}
            // 赤字・黒字は、符号に加えて色でも分かるようにする。広告費が推定を含むときは
            // 色を付けない (推定の利益を、確かな黒字・赤字のように見せないため)。
            tone={
              estimated
                ? undefined
                : now.profit < 0
                  ? "var(--nb-down)"
                  : "var(--nb-up)"
            }
            notes={[beforeNote(before ? signedYen(before.profit) : null)]}
            className="col-span-2"
          />
          <div
            aria-hidden
            className="mx-9 hidden w-px self-stretch bg-[var(--nb-border)] lg:block"
          />
          <Term
            large
            label="CPA（広告流入の診断1件）"
            tag={estimated ? "推定" : null}
            value={now.cpaAd}
            format={unitYen}
            notes={[
              beforeNote(before ? unitYen(before.cpaAd) : null),
              now.cpaAll !== null ? (
                <>
                  診断全体では{" "}
                  <span className="text-[var(--nb-text)]">
                    {unitYen(now.cpaAll)}
                  </span>
                </>
              ) : null,
            ]}
            className="col-span-2"
          />
        </div>
      ) : (
        <p className="pt-5 text-base leading-relaxed text-[var(--nb-text-2)]">
          この日の広告費がまだ入っていません。「広告費を入れる」から、X広告マネージャーのエクスポートを置くか、金額や配信計画を入れてください。
        </p>
      )}
      {partialAccounts && (
        <p className="pt-4 text-sm font-semibold text-[var(--nb-down)]">
          実績が入っているのは {costs.day.accounts_with_actual}{" "}
          アカウントです（直近7日は {costs.day.accounts_recent}{" "}
          アカウントに実績があります）
        </p>
      )}
    </Section>
  );
}

/** 式の 1 項。名前・金額・その下の補足。large は答え (利益・CPA) で、一段大きく出す。 */
function Term({
  label,
  tag,
  value,
  format,
  tone,
  notes = [],
  large = false,
  className = "",
}: {
  label: string;
  tag?: string | null;
  value: number | null;
  format: (value: number | null) => string;
  tone?: string;
  notes?: ReactNode[];
  large?: boolean;
  className?: string;
}) {
  const shownNotes = notes.filter((note) => note !== null);
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-sm text-[var(--nb-text-2)]">{label}</p>
      <p className="mt-0.5 flex items-center gap-2">
          <span
            className={`font-semibold leading-[1.3] tracking-[-0.02em] tabular-nums ${
              large ? "text-[1.75rem] xl:text-[2rem]" : "text-[1.5rem] xl:text-[1.625rem]"
            }`}
            style={{ color: tone ?? "var(--nb-text)" }}
          >
            <AnimatedNumber value={value} format={format} />
          </span>
          {tag && (
            <span className="rounded-[5px] bg-[var(--nb-surface-2)] px-1.5 py-0.5 text-[13px] leading-none text-[var(--nb-text-2)]">
              {tag}
            </span>
          )}
      </p>
      {shownNotes.length > 0 && (
        <p className="mt-0.5 flex flex-wrap gap-x-4 text-[13px] tabular-nums text-[var(--nb-text-3)]">
          {shownNotes.map((note, index) => (
            <span key={index}>{note}</span>
          ))}
        </p>
      )}
    </div>
  );
}

/** 式の記号 (−、=)。狭い画面では項を 2 列に畳むので出さない。 */
function Operator({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="hidden px-5 pt-[1.35rem] text-2xl font-light leading-none text-[var(--nb-faint)] lg:block xl:px-6"
    >
      {children}
    </span>
  );
}
