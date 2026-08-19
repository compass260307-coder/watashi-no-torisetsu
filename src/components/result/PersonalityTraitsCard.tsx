"use client";

// /me 結果トップの「性格特性」カード (2026-08-19)。
// 16personalities の結果トップを参考にした無彩色ベースのカード:
//   - ヘッダー「性格特性」＋右上のビュー切替 (バー / パーセント)
//   - 5 軸それぞれ「軸名: 82% ◯◯寄り (?)」＋発散バー＋両極ラベル
//   - "?" は軸の意味を説明するヘルプ吹き出し (既存 JohariHelpTip を再利用)
//   - フッターに受験日＋シェアピル
//
// 軸データ (色/両極/ヘルプ文) は lib/big-five-axes に集約。バーの見た目は
// 既存 BigFiveDivergingBars と揃える (発散フィル＋白丸マーカー)。

import { useState } from "react";
import { JohariHelpTip } from "./JohariHelpTip";
import { ShareModalOpenButton } from "./ShareModalOpenButton";
import { axesForLocale, toPercent, leanLabel } from "@/lib/big-five-axes";
import type { BigFiveDimension } from "@/lib/types";
import type { ResultLocale } from "@/i18n/result";

export function PersonalityTraitsCard({
  scores,
  takenAt,
  showShare = false,
  locale = "ja",
}: {
  /** 0-10 スケールの 5 軸スコア (user.scores)。欠損軸は中央 50% 扱い。 */
  scores: Partial<Record<BigFiveDimension, number>>;
  /** 受験日 (ISO 文字列)。null/未指定なら日付行を出さない (プレビュー等)。 */
  takenAt?: string | null;
  /** true でフッターにシェアピルを出す (獲得モード/公開プレビューでは false)。 */
  showShare?: boolean;
  locale?: ResultLocale;
}) {
  const isKo = locale === "ko";
  const axes = axesForLocale(locale);
  const [view, setView] = useState<"bars" | "percent">("bars");

  const title = isKo ? "성격 특성" : "性格特性";
  // タイムゾーン差でのハイドレーションずれを避けるため ISO 文字列から日付部分だけ取り出す。
  const dateText = takenAt ? takenAt.slice(0, 10).replaceAll("-", "/") : null;

  return (
    <section aria-label={title} className="mb-10 md:mb-0 md:h-full">
      {/* md:flex-col + md:h-full: PC の2カラムで左(性格タイプ)カードと高さを揃える。
          フッター(受験日/シェア)は md:mt-auto でカード下端に固定する。 */}
      <div className="flex h-full flex-col rounded-3xl border border-[#E7E7EF] bg-white p-5 shadow-[0_6px_20px_rgba(46,46,92,0.05)] md:p-7">
        {/* ヘッダー: タイトル + ビュー切替トグル */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[21px] font-black leading-tight text-[#2E2E5C] md:text-[26px]">
            {title}
          </h2>
          <div
            role="tablist"
            aria-label={isKo ? "표시 전환" : "表示の切り替え"}
            className="flex items-center gap-1 rounded-full bg-[#F1F2F7] p-1"
          >
            <ViewToggleButton
              active={view === "bars"}
              onClick={() => setView("bars")}
              label={isKo ? "막대 그래프" : "バー表示"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 8h11M4 16h7" />
                <circle cx="18" cy="8" r="2.2" fill="currentColor" stroke="none" />
                <circle cx="14" cy="16" r="2.2" fill="currentColor" stroke="none" />
              </svg>
            </ViewToggleButton>
            <ViewToggleButton
              active={view === "percent"}
              onClick={() => setView("percent")}
              label={isKo ? "퍼센트" : "パーセント表示"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 3.5V12l6 4.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ViewToggleButton>
          </div>
        </div>

        {view === "bars" ? (
          <div className="space-y-6">
            {axes.map((axis) => {
              const value = toPercent(scores[axis.dim]);
              const lean = leanLabel(value, axis.left, axis.right, locale);
              // 表示%は「寄っている極の強さ」。value は左→右の位置(バー用)なので、
              // 低い側に寄る時は 100-value にして「◯◯寄り」の語と数値を一致させる。
              const leanPercent = value >= 50 ? value : 100 - value;
              const fillLeft = value >= 50 ? 50 : value;
              const fillWidth = value >= 50 ? value - 50 : 50 - value;
              return (
                <div key={axis.dim}>
                  <span className="sr-only">{`${axis.title}：${lean} ${leanPercent}%`}</span>
                  {/* 上段: 軸名 + %(軸色) + 寄り + ? ヘルプ */}
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className="text-[15px] font-bold text-[#2E2E5C]">
                      {axis.title}:
                    </span>
                    <span
                      className="text-[15px] font-black tabular-nums"
                      style={{ color: axis.color }}
                    >
                      {leanPercent}%
                    </span>
                    <span className="text-[15px] font-bold text-[#2E2E5C]">
                      {lean}
                    </span>
                    <JohariHelpTip text={axis.help} locale={locale} />
                  </div>
                  {/* 中段: 発散バー (中央起点 → スコア側へ塗り、白丸マーカー) */}
                  <div aria-hidden="true" className="relative h-4 w-full">
                    <div
                      className="absolute inset-0 overflow-hidden rounded-full"
                      style={{ background: `${axis.color}2E` }}
                    >
                      <div
                        className="absolute top-0 h-full transition-all duration-500"
                        style={{
                          left: `${fillLeft}%`,
                          width: `${fillWidth}%`,
                          minWidth: value === 50 ? "2px" : undefined,
                          background: axis.color,
                        }}
                      />
                    </div>
                    <div className="absolute left-1/2 top-1/2 h-5 w-px -translate-x-1/2 -translate-y-1/2 bg-[#2E2E5C]/25" />
                    <div
                      className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-500"
                      style={{ left: `${value}%`, border: `4px solid ${axis.color}` }}
                    />
                  </div>
                  {/* 下段: 両極ラベル */}
                  <div
                    aria-hidden="true"
                    className="mt-1.5 flex items-center justify-between text-[12px] font-bold leading-tight text-[#2E2E5C]/55"
                  >
                    <span>{axis.left}</span>
                    <span>{axis.right}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {axes.map((axis) => {
              const value = toPercent(scores[axis.dim]);
              const lean = leanLabel(value, axis.left, axis.right, locale);
              // バー表示と同じく「寄っている極の強さ」を表示する。
              const leanPercent = value >= 50 ? value : 100 - value;
              return (
                <div
                  key={axis.dim}
                  className="flex items-center gap-3 rounded-2xl border border-[#EDEEF4] bg-[#FAFAFD] px-4 py-3"
                >
                  {/* ドーナツ風の % リング */}
                  <div
                    aria-hidden="true"
                    className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(${axis.color} ${leanPercent * 3.6}deg, ${axis.color}22 0deg)`,
                    }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                      <span
                        className="text-[12px] font-black tabular-nums"
                        style={{ color: axis.color }}
                      >
                        {leanPercent}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[14px] font-black text-[#2E2E5C]">
                      {axis.title}
                      <JohariHelpTip text={axis.help} locale={locale} />
                    </p>
                    <p className="text-[12px] font-bold text-[#2E2E5C]/60">
                      {lean}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* フッター: 受験日 + シェアピル (PC は mt-auto でカード下端へ) */}
        {(dateText || showShare) && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#EDEEF4] pt-4 md:mt-auto md:pt-5">
            {dateText ? (
              <p className="text-[12px] font-bold text-[#9A9AAD]">
                {isKo ? `검사일: ${dateText}` : `受験日: ${dateText}`}
              </p>
            ) : (
              <span />
            )}
            {showShare && (
              <ShareModalOpenButton
                source="traits_card"
                label={isKo ? "공유" : "結果をシェア"}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-white text-[#2E2E5C] shadow-[0_1px_4px_rgba(46,46,92,0.14)]"
          : "text-[#9A9AAD] hover:text-[#2E2E5C]"
      }`}
    >
      {children}
    </button>
  );
}
