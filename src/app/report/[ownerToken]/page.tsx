"use client";

import { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { ReportData } from "@/lib/report-data";
import {
  DEEP_DIVE_SECTION_ORDER,
  REPORT_FRIEND_THRESHOLD,
  TYPE_DEEP_DIVE,
  TYPE_CATCH_COPY,
  generateConclusionText,
} from "@/lib/report-data";
import { torisetsuTypes } from "@/lib/torisetsu-data";

const AXIS_LABELS: Record<string, string> = {
  E: "外向性",
  A: "協調性",
  O: "開放性",
  C: "誠実性",
  N: "神経症傾向",
};

function buildRadarData(report: ReportData) {
  return (["E", "A", "O", "C", "N"] as const).map((dim) => ({
    axis: AXIS_LABELS[dim],
    self: report.selfBigFive[dim] ?? 0,
    friend: report.friendBigFive[dim] ?? 0,
  }));
}

export default function ReportPage({
  params,
}: {
  params: Promise<{ ownerToken: string }>;
}) {
  const { ownerToken } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <p className="text-sm text-muted">読み込み中...</p>
        </div>
      }
    >
      <ReportContent ownerToken={ownerToken} />
    </Suspense>
  );
}

function ReportContent({ ownerToken }: { ownerToken: string }) {
  const searchParams = useSearchParams();
  const dev = searchParams.get("dev") === "true";
  const adminKey = searchParams.get("adminKey");
  const forceType = searchParams.get("forceType");

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ token: ownerToken });
    if (dev && adminKey) {
      params.set("dev", "true");
      params.set("adminKey", adminKey);
      if (forceType) params.set("forceType", forceType);
    }
    fetch(`/api/report?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ReportData | null) => {
        if (data) setReport(data);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [ownerToken, dev, adminKey, forceType]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <p className="text-sm text-muted">レポートを読み込み中...</p>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5">
        <p className="text-muted text-sm mb-6">レポートが見つかりません</p>
        <Link
          href="/"
          className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white"
        >
          トップに戻る
        </Link>
      </div>
    );
  }

  if (!report.meetsThreshold && !report.isDev) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10 max-w-lg mx-auto w-full text-center">
        <Image
          src="/mascot/step3-complete.png"
          alt=""
          width={224}
          height={224}
          priority
          className="w-56 h-auto object-contain mb-6"
        />
        <h1 className="text-2xl font-bold mb-3">
          詳細レポートはまだ準備中です
        </h1>
        <p className="text-sm text-muted leading-relaxed mb-6">
          友達{REPORT_FRIEND_THRESHOLD}人の回答が集まると、
          <br />
          詳細レポートが解放されます
        </p>
        <p className="text-sm font-bold mb-6">
          現在 <span className="text-primary">{report.friendCount}</span> /{" "}
          {REPORT_FRIEND_THRESHOLD} 人
        </p>
        <Link
          href={`/result/${ownerToken}`}
          className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white"
        >
          結果ページに戻る
        </Link>
      </div>
    );
  }

  const radarData = buildRadarData(report);

  return (
    <div className="flex flex-col flex-1">
      {report.isDev && (
        <div className="w-full bg-red-500 text-white text-center py-2 px-3 text-xs font-bold sticky top-0 z-20">
          ⚠️ 開発モード（テストデータで補完中）
        </div>
      )}
      <main className="flex flex-col px-5 py-6 max-w-lg mx-auto w-full">
        {/* 1. ヘッダー */}
        <header className="text-center mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            DETAIL REPORT
          </p>
          <h1 className="text-2xl font-extrabold mb-2">
            ワタシのトリセツ
            <br />
            詳細レポート
          </h1>
          <p className="text-xs text-muted leading-relaxed">
            友達{report.friendCount}人の回答から、
            <br />
            あなたの本当の姿を分析しました
          </p>
        </header>

        {/* 2. タイプ表示 */}
        <section
          className="w-full rounded-2xl border bg-card-bg overflow-hidden mb-5 animate-scale-in"
          style={{ borderColor: `${report.typeColor}40` }}
        >
          <div
            className="h-1.5"
            style={{ backgroundColor: report.typeColor }}
          />
          <div className="flex flex-col items-center text-center px-5 pt-6 pb-5">
            <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
              YOUR TYPE
            </p>
            {report.typeImageUrl ? (
              <div className="relative mx-auto mb-3 w-full max-w-[280px] aspect-square">
                <Image
                  src={report.typeImageUrl}
                  alt={`${report.typeName}のキャラクター`}
                  width={280}
                  height={280}
                  className="relative z-10 w-full h-full object-contain"
                  priority
                />
                <div
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 z-0 h-3 w-[55%] -translate-x-1/2 rounded-[50%] blur-md"
                  style={{ backgroundColor: "rgba(0, 0, 0, 0.12)" }}
                />
              </div>
            ) : (
              <div
                className="text-5xl mb-3 w-20 h-20 flex items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${report.typeColor}15` }}
              >
                {report.typeEmoji}
              </div>
            )}
            <h2
              className="text-2xl font-extrabold mb-1"
              style={{ color: report.typeColor }}
            >
              {report.typeName}
            </h2>
            <p className="text-sm text-muted">{report.typeCatchCopy}</p>
          </div>
        </section>

        {/* 2.5 結論一文 */}
        {(() => {
          if (report.gaps.length === 0) return null;
          const conclusionText = generateConclusionText(
            report.selfBigFive,
            report.friendBigFive,
            report.gaps,
          );
          const conclusionLines = conclusionText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          if (conclusionLines.length === 0) return null;

          return (
            <section
              className="w-full rounded-2xl border-2 p-6 mb-5"
              style={{
                borderColor: report.typeColor,
                background: `linear-gradient(to bottom, #ffffff, ${report.typeColor}0D)`,
                boxShadow: `0 4px 16px ${report.typeColor}1A`,
              }}
            >
              <p className="text-sm font-medium text-muted text-center mb-2">
                友達の回答から見えた、あなた
              </p>
              <div
                className="h-0.5 w-12 mx-auto mb-4 rounded-full"
                style={{ backgroundColor: report.typeColor }}
              />
              <div className="space-y-4">
                {conclusionLines.map((line, i) => (
                  <p
                    key={i}
                    className="text-base leading-relaxed font-bold text-left"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </section>
          );
        })()}

        {/* 3. レーダーチャート: 自己 vs 友達 */}
        <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
          <p className="text-[10px] font-bold tracking-wider text-muted text-center mb-3">
            自己評価 vs 友達評価
          </p>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#e8e0d8" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fontSize: 12, fill: "#1a1a1a" }}
                />
                <PolarRadiusAxis
                  domain={[0, 4]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="自己評価"
                  dataKey="self"
                  stroke={report.typeColor}
                  fill={report.typeColor}
                  fillOpacity={0.3}
                />
                <Radar
                  name="友達評価"
                  dataKey="friend"
                  stroke="#9a8a8a"
                  fill="#9a8a8a"
                  fillOpacity={0.2}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : String(v)
                  }
                  contentStyle={{
                    fontSize: 11,
                    borderRadius: 8,
                    border: "1px solid #e8e0d8",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted text-center mt-2 leading-relaxed">
            友達評価は10問の回答から推定しています
          </p>
        </section>

        {/* 4. ギャップ分析 (全5軸) */}
        {report.gaps.length > 0 && (
          <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
            <p className="text-[10px] font-bold tracking-wider text-muted text-center mb-3">
              友達から見たあなた
            </p>
            <p className="text-sm text-center text-muted mb-4">
              ギャップが大きい順
            </p>
            {(() => {
              const sortedGaps = [...report.gaps].sort(
                (a, b) => Math.abs(b.gap) - Math.abs(a.gap),
              );
              const topGaps = sortedGaps.slice(0, 3);
              const restGaps = sortedGaps.slice(3);

              return (
                <>
                  <ul className="flex flex-col gap-3">
                    {topGaps.map((g) => {
                      const arrow = g.gap > 0 ? "↑" : "↓";
                      return (
                        <li
                          key={g.dimension}
                          className="rounded-xl border border-card-border p-3"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold">
                              {g.emoji} {g.label}
                            </span>
                            <span
                              className="text-xs font-mono tabular-nums"
                              style={{ color: report.typeColor }}
                            >
                              {arrow} {Math.abs(g.gap).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-muted leading-relaxed">
                            自分: {g.selfLabel}（{g.selfScore.toFixed(1)}）
                            <br />
                            友達: {g.friendLabel}（{g.friendScore.toFixed(1)}）
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {restGaps.length > 0 && (
                    <>
                      <p className="text-[11px] text-muted text-center mt-5 mb-2">
                        ▼ 自己認識との一致度（残り{restGaps.length}軸）
                      </p>
                      <ul className="flex flex-col gap-2">
                        {restGaps.map((g) => {
                          const arrow = g.gap > 0 ? "↑" : "↓";
                          return (
                            <li
                              key={g.dimension}
                              className="rounded-xl border border-card-border/60 bg-background/40 p-2.5 opacity-70"
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-bold">
                                  {g.emoji} {g.label}
                                </span>
                                <span
                                  className="text-[11px] font-mono tabular-nums"
                                  style={{ color: report.typeColor }}
                                >
                                  {arrow} {Math.abs(g.gap).toFixed(2)}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted leading-relaxed">
                                自分: {g.selfLabel}（{g.selfScore.toFixed(1)}）／
                                友達: {g.friendLabel}（{g.friendScore.toFixed(1)}）
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              );
            })()}
          </section>
        )}

        {/* 4.5 友達から見たあなたの印象 (choice 集計) */}
        {report.friendChoices.length > 0 && (
          <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
            <p className="text-[10px] font-bold tracking-wider text-muted text-center mb-1">
              友達から見たあなたの印象
            </p>
            <p className="text-xs text-center text-muted mb-5">
              友達{report.friendCount}人の回答から集計しました
            </p>

            <div className="flex flex-col gap-5">
              {report.friendChoices.map((q) => {
                const visible = q.choices.filter((c) => c.count > 0);
                if (visible.length === 0) return null;
                const max = Math.max(...visible.map((c) => c.count));

                return (
                  <div key={q.questionId}>
                    <p className="text-sm font-bold mb-3">{q.questionLabel}</p>
                    <ul className="flex flex-col gap-2">
                      {visible
                        .sort((a, b) => b.count - a.count)
                        .map((c) => {
                          const widthPct = max > 0 ? (c.count / max) * 100 : 0;
                          return (
                            <li
                              key={c.label}
                              className="flex items-center gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[13px] truncate">
                                    {c.label}
                                  </span>
                                  <span className="text-xs font-mono tabular-nums text-muted ml-2 shrink-0">
                                    {c.count}人
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${widthPct}%`,
                                      backgroundColor: report.typeColor,
                                    }}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. タイプ深掘り */}
        <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-1">
            タイプ深掘り
          </p>
          <h3 className="text-base font-bold mb-4">
            {report.typeName}について
          </h3>
          {(() => {
            const dive = TYPE_DEEP_DIVE[report.typeId];
            if (!dive) {
              return (
                <p className="text-xs text-muted leading-relaxed">
                  「{report.typeName}」タイプの詳細解説は準備中です。
                  <br />
                  （次のフェーズで本コンテンツを追加予定）
                </p>
              );
            }
            return (
              <div className="flex flex-col gap-4">
                {DEEP_DIVE_SECTION_ORDER.map((key) => {
                  const sec = dive[key];
                  return (
                    <div
                      key={key}
                      className="border-t border-card-border pt-3 first:border-t-0 first:pt-0"
                    >
                      <p
                        className="text-sm font-bold mb-2"
                        style={{ color: report.typeColor }}
                      >
                        {sec.title}
                      </p>
                      <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-line">
                        {sec.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* 6. ベスト相棒 */}
        {(() => {
          const partner = torisetsuTypes[report.bestPartner.partnerTypeId];
          const partnerCatch =
            TYPE_CATCH_COPY[report.bestPartner.partnerTypeId] ??
            partner.subtitle;
          return (
            <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
              <p className="text-[10px] font-bold tracking-wider text-muted text-center mb-4">
                あなたのベスト相棒
              </p>

              <div
                className="rounded-2xl border-2 p-5 mb-5"
                style={{
                  borderColor: partner.color,
                  background: `linear-gradient(to bottom, #ffffff, ${partner.color}0D)`,
                }}
              >
                <div className="flex flex-col items-center text-center">
                  {partner.imageUrl ? (
                    <div className="relative mx-auto mb-3 w-full max-w-[240px] aspect-square">
                      <Image
                        src={partner.imageUrl}
                        alt={`${partner.name}のキャラクター`}
                        width={240}
                        height={240}
                        className="relative z-10 w-full h-full object-contain"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute bottom-1 left-1/2 z-0 h-3 w-[55%] -translate-x-1/2 rounded-[50%] blur-md"
                        style={{ backgroundColor: "rgba(0, 0, 0, 0.12)" }}
                      />
                    </div>
                  ) : (
                    <div
                      className="text-5xl mb-3 w-20 h-20 flex items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${partner.color}15` }}
                    >
                      {partner.emoji}
                    </div>
                  )}
                  <p
                    className="text-xl font-extrabold mb-1"
                    style={{ color: partner.color }}
                  >
                    {partner.emoji} {partner.name}
                  </p>
                  <p className="text-xs text-muted">{partnerCatch}</p>
                </div>
              </div>

              <div className="mb-5">
                <p
                  className="text-sm font-bold mb-2"
                  style={{ color: partner.color }}
                >
                  💎 なぜ相性がいいか
                </p>
                <p className="text-[13px] leading-relaxed whitespace-pre-line">
                  {report.bestPartner.whyCompatible}
                </p>
              </div>

              <div className="mb-5">
                <p
                  className="text-sm font-bold mb-2"
                  style={{ color: partner.color }}
                >
                  ✨ 一緒にいると起きること
                </p>
                <ul className="flex flex-col gap-2">
                  {report.bestPartner.whatHappens.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className="text-xs mt-1"
                        style={{ color: partner.color }}
                      >
                        ●
                      </span>
                      <span className="text-[13px] leading-relaxed">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p
                  className="text-sm font-bold mb-2"
                  style={{ color: partner.color }}
                >
                  💭 関係を長く続けるために
                </p>
                <p className="text-[13px] leading-relaxed whitespace-pre-line">
                  {report.bestPartner.warning}
                </p>
              </div>
            </section>
          );
        })()}

        {/* 7. フッター */}
        <footer className="flex flex-col items-center mb-10">
          <Link
            href={`/result/${ownerToken}`}
            className="inline-block w-full max-w-xs rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-lg shadow-primary/25 transition-all active:scale-[0.98] text-center mb-3"
          >
            友達に教える
          </Link>
          <Link
            href="/"
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            トップに戻る
          </Link>
        </footer>
      </main>
    </div>
  );
}

