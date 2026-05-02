"use client";

import { useState, useEffect, useCallback } from "react";

const TYPE_LABELS: Record<string, string> = {
  "festival-sun": "お祭りムードメーカー",
  "everyones-home": "みんなの実家",
  "wild-charisma": "暴走カリスマ",
  "iron-mental": "鉄のメンタル番長",
  "delicate-creator": "繊細クリエイター",
  "healing-guardian": "癒しの守護神",
  "deep-dive-explorer": "沼ハマり探究者",
  "cool-maverick": "冷静マイペース",
  "explorer_leader": "探検リーダー",
};

type Stats = {
  diagnosisStarted: number;
  diagnosisCompleted: number;
  completionRate: number;
  shareCount: number;
  shareRate: number;
  friendAnswerStarted: number;
  friendAnswerCompleted: number;
  answerCompletionRate: number;
  threeAchieved: number;
  fiveAchieved: number;
  resultRevisited: number;
  revisitRate: number;
  funnel: { label: string; count: number }[];
  recentEvents: {
    event_name: string;
    session_id: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
  friendToDiagClicked: number;
  friendToDiagRate: number;
  typeDistribution: { typeId: string; count: number }[];
  friendCountDistribution: {
    total: number;
    zero: number;
    one: number;
    two: number;
    threePlus: number;
    fivePlus: number;
  };
  diagQuestionReach: Record<string, number>;
  friendQuestionReach: Record<string, number>;
  campaignStats: {
    campaign: string;
    completed: number;
    friendCompleted: number;
  }[];
  generationDistribution: { generation: number; count: number }[];
  unknownGeneration: number;
  viral: {
    friendLandingViewed: number;
    sharingUsersReached: number;
    avgLandingPerSharer: number;
    landingToStartRate: number;
    startToCompleteRate: number;
    friendToDiagClickedRate: number;
    childDiagCompleted: number;
    parentDiagCompleted: number;
    avgChildPerParent: number;
    viralCoefficient: number;
  };
};

type Preset = "today" | "7d" | "30d" | "all" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "7d", label: "7日" },
  { key: "30d", label: "30日" },
  { key: "all", label: "全期間" },
  { key: "custom", label: "カスタム" },
];

function toLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPresetRange(preset: Preset): { from: string; to: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let from: Date;
  if (preset === "today") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (preset === "7d") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function FunnelBar({
  label,
  count,
  max,
  prevCount,
}: {
  label: string;
  count: number;
  max: number;
  prevCount?: number;
}) {
  const width = max > 0 ? (count / max) * 100 : 0;
  const convRate =
    prevCount !== undefined && prevCount > 0
      ? `${((count / prevCount) * 100).toFixed(1)}%`
      : null;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-right text-sm text-gray-600 shrink-0">
        {label}
      </span>
      <div className="flex-1 h-8 bg-gray-100 rounded-md overflow-hidden relative">
        <div
          className="h-full bg-blue-500/80 rounded-md transition-all duration-500"
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-bold text-gray-800">
          {count}
        </span>
      </div>
      <span className="w-16 text-right text-xs text-gray-400 tabular-nums shrink-0">
        {convRate ?? "—"}
      </span>
    </div>
  );
}

function DistributionBar({
  label,
  count,
  max,
  color,
}: {
  label: string;
  count: number;
  max: number;
  color?: string;
}) {
  const width = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-40 text-right text-sm text-gray-600 shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden relative">
        <div
          className={`h-full rounded-md transition-all duration-500 ${color ?? "bg-purple-500/70"}`}
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-bold text-gray-800">
          {count}
        </span>
      </div>
    </div>
  );
}

function QuestionReachChart({
  title,
  reach,
  totalQuestions,
}: {
  title: string;
  reach: Record<string, number>;
  totalQuestions: number;
}) {
  const data = Array.from({ length: totalQuestions }, (_, i) => ({
    index: i,
    count: reach[String(i)] ?? 0,
  }));
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-xs font-bold text-gray-500 mb-4">{title}</h3>
      <div className="flex items-end gap-1 h-32">
        {data.map((d) => {
          const height = max > 0 ? (d.count / max) * 100 : 0;
          return (
            <div
              key={d.index}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <span className="text-[10px] text-gray-500 tabular-nums">
                {d.count || ""}
              </span>
              <div className="w-full relative" style={{ height: "100px" }}>
                <div
                  className="absolute bottom-0 w-full bg-emerald-500/70 rounded-t-sm transition-all duration-500"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400">
                Q{d.index + 1}
              </span>
            </div>
          );
        })}
      </div>
      {data.length > 1 && data[0].count > 0 && (
        <p className="text-[11px] text-gray-400 mt-3 text-right">
          Q1→Q{totalQuestions} 到達率:{" "}
          {pct(data[totalQuestions - 1].count / data[0].count)}
        </p>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [inputKey, setInputKey] = useState("");
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(() => toLocalDate(new Date()));
  const [customTo, setCustomTo] = useState(() => toLocalDate(new Date()));

  useEffect(() => {
    const stored = sessionStorage.getItem("torisetsu_admin_key");
    if (stored) setAdminKey(stored);
  }, []);

  const fetchStats = useCallback(
    async (key: string, p: Preset, cFrom: string, cTo: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        let range: { from: string; to: string } | null;
        if (p === "custom") {
          const fromDate = new Date(cFrom);
          const toDate = new Date(cTo);
          toDate.setHours(23, 59, 59, 999);
          range = { from: fromDate.toISOString(), to: toDate.toISOString() };
        } else {
          range = getPresetRange(p);
        }
        if (range) {
          params.set("from", range.from);
          params.set("to", range.to);
        }
        const qs = params.toString();
        const res = await fetch(`/api/admin/stats${qs ? `?${qs}` : ""}`, {
          headers: { "x-admin-key": key },
        });
        if (res.status === 401) {
          setError("パスワードが正しくありません");
          setAdminKey(null);
          sessionStorage.removeItem("torisetsu_admin_key");
          return;
        }
        if (!res.ok) throw new Error();
        setStats(await res.json());
        setAdminKey(key);
        sessionStorage.setItem("torisetsu_admin_key", key);
      } catch {
        setError("データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (adminKey) fetchStats(adminKey, preset, customFrom, customTo);
  }, [adminKey, preset, customFrom, customTo, fetchStats]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim()) {
      setAdminKey(inputKey.trim());
    }
  };

  if (!adminKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8"
        >
          <h1 className="text-lg font-bold mb-1">管理画面</h1>
          <p className="text-sm text-gray-500 mb-6">
            ワタシのトリセツ MVP定点観測
          </p>
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="管理パスワード"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 transition-colors mb-3"
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !inputKey.trim()}
            className="w-full rounded-lg bg-gray-900 py-3 text-sm font-bold text-white transition-all disabled:opacity-40 hover:bg-gray-800"
          >
            {loading ? "確認中..." : "ログイン"}
          </button>
        </form>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  if (!stats) return null;

  const funnelMax = Math.max(...stats.funnel.map((f) => f.count), 1);
  const fc = stats.friendCountDistribution;
  const typeMax = Math.max(...stats.typeDistribution.map((t) => t.count), 1);

  const downloadCsv = () => {
    const rows: string[][] = [];
    rows.push(["# KPI（すべてユニークセッション単位）"]);
    rows.push(["指標", "値", "計算式"]);
    rows.push(["診断開始", String(stats.diagnosisStarted), ""]);
    rows.push(["診断完了", String(stats.diagnosisCompleted), ""]);
    rows.push(["診断完了率", pct(stats.completionRate), "診断完了÷診断開始"]);
    rows.push(["友達共有", String(stats.shareCount), ""]);
    rows.push(["友達共有率", pct(stats.shareRate), "友達共有÷診断完了"]);
    rows.push(["友達回答開始", String(stats.friendAnswerStarted), ""]);
    rows.push(["友達回答完了", String(stats.friendAnswerCompleted), ""]);
    rows.push(["友達回答完了率", pct(stats.answerCompletionRate), "回答完了÷回答開始"]);
    rows.push(["3人達成", String(stats.threeAchieved), ""]);
    rows.push(["5人達成", String(stats.fiveAchieved), ""]);
    rows.push(["結果再訪", String(stats.resultRevisited), ""]);
    rows.push(["結果再訪率", pct(stats.revisitRate), "再訪÷初回閲覧"]);
    rows.push(["友達→自分も作る", String(stats.friendToDiagClicked), ""]);
    rows.push(["友達→自分も作る率", pct(stats.friendToDiagRate), "クリック÷友達回答完了"]);
    rows.push([]);
    rows.push(["# 拡散指標"]);
    rows.push(["指標", "値", "計算式"]);
    rows.push(["友達ページ到達数", String(stats.viral.friendLandingViewed), "ユニークセッション"]);
    rows.push(["共有者あたり平均到達", stats.viral.avgLandingPerSharer.toFixed(2), "到達数÷ユニーク共有者"]);
    rows.push(["到達→回答開始率", pct(stats.viral.landingToStartRate), "回答開始÷到達"]);
    rows.push(["回答開始→完了率", pct(stats.viral.startToCompleteRate), "回答完了÷回答開始"]);
    rows.push(["自分も作る転換率", pct(stats.viral.friendToDiagClickedRate), "クリック÷友達回答完了"]);
    rows.push(["子診断完了数", String(stats.viral.childDiagCompleted), "source_user_idあり"]);
    rows.push(["親あたり子診断数", stats.viral.avgChildPerParent.toFixed(2), "子完了÷ユニーク親"]);
    rows.push(["実測拡散係数", stats.viral.viralCoefficient.toFixed(3), "子診断完了÷全診断完了"]);
    rows.push([]);
    rows.push(["# ファネル"]);
    rows.push(["ステップ", "件数"]);
    stats.funnel.forEach((s) => rows.push([s.label, String(s.count)]));
    rows.push([]);
    if (stats.campaignStats.length > 0) {
      rows.push(["# キャンペーン別"]);
      rows.push(["campaign", "診断完了", "友達回答"]);
      stats.campaignStats.forEach((c) => rows.push([c.campaign, String(c.completed), String(c.friendCompleted)]));
      rows.push([]);
    }
    if (stats.generationDistribution.length > 0) {
      rows.push(["# 世代分布"]);
      rows.push(["世代", "人数"]);
      stats.generationDistribution.forEach((g) => rows.push([g.generation === 0 ? "Seed" : `第${g.generation}世代`, String(g.count)]));
      if (stats.unknownGeneration > 0) rows.push(["不明", String(stats.unknownGeneration)]);
      rows.push([]);
    }
    rows.push(["# 友達回答人数の分布"]);
    rows.push(["人数", "件数"]);
    rows.push(["0人", String(fc.zero)]);
    rows.push(["1人", String(fc.one)]);
    rows.push(["2人", String(fc.two)]);
    rows.push(["3人以上", String(fc.threePlus)]);
    rows.push(["5人以上", String(fc.fivePlus)]);
    rows.push([]);
    if (stats.typeDistribution.length > 0) {
      rows.push(["# タイプ分布"]);
      rows.push(["タイプ", "人数"]);
      stats.typeDistribution.forEach((t) => rows.push([TYPE_LABELS[t.typeId] ?? t.typeId, String(t.count)]));
      rows.push([]);
    }
    rows.push(["# 診断質問到達数"]);
    rows.push(["質問", "回答数"]);
    for (let i = 0; i < 15; i++) rows.push([`Q${i + 1}`, String(stats.diagQuestionReach[String(i)] ?? 0)]);
    rows.push([]);
    rows.push(["# 友達質問到達数"]);
    rows.push(["質問", "回答数"]);
    for (let i = 0; i < 5; i++) rows.push([`Q${i + 1}`, String(stats.friendQuestionReach[String(i)] ?? 0)]);

    const bom = "﻿";
    const csv = bom + rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torisetsu_stats_${preset}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">ワタシのトリセツ</h1>
            <p className="text-xs text-gray-400">MVP定点観測</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50"
            >
              CSV
            </button>
            <button
              onClick={() => fetchStats(adminKey, preset, customFrom, customTo)}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-40"
            >
              {loading ? "更新中..." : "↻ 更新"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Period Filter */}
        <section className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-4 py-2 text-xs font-bold transition-colors ${
                  preset === p.key
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
              <span className="text-xs text-gray-400">〜</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
              />
            </div>
          )}

          {loading && (
            <span className="text-xs text-gray-400">読み込み中...</span>
          )}
        </section>

        {/* KPI Cards */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">KPI</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard label="診断開始" value={stats.diagnosisStarted} sub="ユニークセッション" />
            <KpiCard label="診断完了" value={stats.diagnosisCompleted} sub="ユニークセッション" />
            <KpiCard
              label="診断完了率"
              value={pct(stats.completionRate)}
              sub="診断開始→診断完了"
            />
            <KpiCard
              label="友達共有"
              value={stats.shareCount}
              sub="ユニークセッション"
            />
            <KpiCard
              label="友達共有率"
              value={pct(stats.shareRate)}
              sub="診断完了→共有クリック"
            />
            <KpiCard label="友達回答開始" value={stats.friendAnswerStarted} sub="ユニークセッション" />
            <KpiCard label="友達回答完了" value={stats.friendAnswerCompleted} sub="ユニークセッション" />
            <KpiCard
              label="友達回答完了率"
              value={pct(stats.answerCompletionRate)}
              sub="回答開始→回答完了"
            />
            <KpiCard
              label="3人達成"
              value={stats.threeAchieved}
              sub="トリセツ完成"
            />
            <KpiCard
              label="5人達成"
              value={stats.fiveAchieved}
              sub="深掘りレポート解放"
            />
            <KpiCard
              label="結果再訪"
              value={stats.resultRevisited}
              sub="ユニークセッション"
            />
            <KpiCard
              label="結果再訪率"
              value={pct(stats.revisitRate)}
              sub="結果閲覧→再訪"
            />
            <KpiCard
              label="友達→自分も作る"
              value={stats.friendToDiagClicked}
              sub={`転換率 ${pct(stats.friendToDiagRate)}`}
            />
          </div>
        </section>

        {/* Funnel */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">ファネル</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-3 mb-4 text-xs text-gray-400">
              <span className="w-28 text-right">ステップ</span>
              <span className="flex-1">件数</span>
              <span className="w-16 text-right">前ステップ比</span>
            </div>
            <div className="flex flex-col gap-2">
              {stats.funnel.map((step, i) => (
                <FunnelBar
                  key={step.label}
                  label={step.label}
                  count={step.count}
                  max={funnelMax}
                  prevCount={
                    i > 0 ? stats.funnel[i - 1].count : undefined
                  }
                />
              ))}
            </div>
          </div>
        </section>

        {/* Campaign Stats */}
        {stats.campaignStats.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              キャンペーン別
              <span className="text-xs font-normal text-gray-400 ml-2">全期間</span>
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                    <th className="px-4 py-3 font-medium">campaign</th>
                    <th className="px-4 py-3 font-medium text-right">診断完了</th>
                    <th className="px-4 py-3 font-medium text-right">友達回答</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.campaignStats.map((c) => (
                    <tr key={c.campaign} className="border-b border-gray-50">
                      <td className="px-4 py-2.5">
                        <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-700">
                          {c.campaign}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.completed}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.friendCompleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Viral Metrics */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            拡散指標
            <span className="text-xs font-normal text-gray-400 ml-2">自然拡散の強さを測る</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <KpiCard
              label="友達ページ到達"
              value={stats.viral.friendLandingViewed}
              sub="ユニークセッション"
            />
            <KpiCard
              label="平均到達人数"
              value={stats.viral.avgLandingPerSharer.toFixed(1)}
              sub="到達数÷ユニーク共有者"
            />
            <KpiCard
              label="到達→回答開始率"
              value={pct(stats.viral.landingToStartRate)}
              sub="友達ページ到達→回答開始"
            />
            <KpiCard
              label="回答開始→完了率"
              value={pct(stats.viral.startToCompleteRate)}
              sub="友達回答開始→完了"
            />
            <KpiCard
              label="自分も作る転換率"
              value={pct(stats.viral.friendToDiagClickedRate)}
              sub="友達回答完了→クリック"
            />
            <KpiCard
              label="子診断完了"
              value={stats.viral.childDiagCompleted}
              sub={`親${stats.viral.parentDiagCompleted}人から発生`}
            />
            <KpiCard
              label="親あたり子診断数"
              value={stats.viral.avgChildPerParent.toFixed(1)}
              sub="子完了÷ユニーク親"
            />
            <KpiCard
              label="実測拡散係数"
              value={stats.viral.viralCoefficient.toFixed(3)}
              sub="子診断完了÷全診断完了"
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            拡散係数 {'>'} 1.0 で自然増殖 / 0.5以上でMVPとして良好
          </p>
          {stats.viral.friendLandingViewed === 0 && stats.friendAnswerStarted > 0 && (
            <p className="text-[11px] text-orange-500 mt-1">
              ⚠ 友達ページ到達が0件：5/2デプロイ以前の回答にはこのイベントがありません。今後のアクセスから計測されます。
            </p>
          )}
        </section>

        {/* Generation Distribution */}
        {stats.generationDistribution.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              拡散の世代分布
              <span className="text-xs font-normal text-gray-400 ml-2">全期間</span>
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-end gap-3 justify-center mb-4">
                {(() => {
                  const allCounts = [
                    ...stats.generationDistribution.map((d) => d.count),
                    stats.unknownGeneration,
                  ];
                  const max = Math.max(...allCounts, 1);
                  return (
                    <>
                      {stats.generationDistribution.map((g) => {
                        const height = (g.count / max) * 100;
                        return (
                          <div key={g.generation} className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold tabular-nums">{g.count}</span>
                            <div className="w-14 relative" style={{ height: "80px" }}>
                              <div
                                className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                                style={{
                                  height: `${Math.max(height, 5)}%`,
                                  backgroundColor: g.generation === 0 ? "#3b82f6" : g.generation === 1 ? "#8b5cf6" : g.generation === 2 ? "#ec4899" : "#f97316",
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">
                              {g.generation === 0 ? "Seed" : `第${g.generation}世代`}
                            </span>
                          </div>
                        );
                      })}
                      {stats.unknownGeneration > 0 && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold tabular-nums text-gray-400">{stats.unknownGeneration}</span>
                          <div className="w-14 relative" style={{ height: "80px" }}>
                            <div
                              className="absolute bottom-0 w-full bg-gray-200 rounded-t-md"
                              style={{ height: `${Math.max((stats.unknownGeneration / max) * 100, 5)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400">不明</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                Seed = campaignパラメータ付き / 第N世代 = 友達回答後に自分も診断した人
              </p>
            </div>
          </section>
        )}

        {/* Friend Count Distribution */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            友達回答人数の分布
            <span className="text-xs font-normal text-gray-400 ml-2">全期間</span>
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold tabular-nums">{fc.zero}</p>
                <p className="text-[11px] text-gray-500 mt-1">0人</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold tabular-nums">{fc.one}</p>
                <p className="text-[11px] text-gray-500 mt-1">1人</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold tabular-nums">{fc.two}</p>
                <p className="text-[11px] text-gray-500 mt-1">2人</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-50">
                <p className="text-2xl font-bold tabular-nums text-blue-600">{fc.threePlus}</p>
                <p className="text-[11px] text-blue-500 mt-1">3人以上</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-50">
                <p className="text-2xl font-bold tabular-nums text-purple-600">{fc.fivePlus}</p>
                <p className="text-[11px] text-purple-500 mt-1">5人以上</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 text-right">
              全診断完了者 {fc.total}人 / 1人以上回答あり {fc.total - fc.zero}人
              ({fc.total > 0 ? pct((fc.total - fc.zero) / fc.total) : "0.0%"})
            </p>
          </div>
        </section>

        {/* Type Distribution */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            タイプ分布
            <span className="text-xs font-normal text-gray-400 ml-2">全期間</span>
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            {stats.typeDistribution.length > 0 ? (
              <div className="flex flex-col gap-2">
                {stats.typeDistribution.map((t) => (
                  <DistributionBar
                    key={t.typeId}
                    label={TYPE_LABELS[t.typeId] ?? t.typeId}
                    count={t.count}
                    max={typeMax}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-xs py-4">
                データがまだありません
              </p>
            )}
            {stats.typeDistribution.length > 0 && (
              <p className="text-[11px] text-gray-400 text-right mt-3">
                合計 {stats.typeDistribution.reduce((s, t) => s + t.count, 0)}人
              </p>
            )}
          </div>
        </section>

        {/* Question Reach */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">質問ごとの到達数</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <QuestionReachChart
              title="診断（15問）"
              reach={stats.diagQuestionReach}
              totalQuestions={15}
            />
            <QuestionReachChart
              title="友達回答（10問）"
              reach={stats.friendQuestionReach}
              totalQuestions={10}
            />
          </div>
        </section>

        {/* Recent Events */}
        <section>
          <h2 className="text-sm font-bold text-gray-700 mb-3">
            直近イベント（最新50件）
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">event_name</th>
                  <th className="px-4 py-3 font-medium">created_at</th>
                  <th className="px-4 py-3 font-medium">session_id</th>
                  <th className="px-4 py-3 font-medium">metadata</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentEvents.map((ev, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">
                        {ev.event_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString("ja-JP", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                      {ev.session_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono max-w-[200px] truncate">
                      {Object.keys(ev.metadata ?? {}).length > 0
                        ? JSON.stringify(ev.metadata)
                        : "—"}
                    </td>
                  </tr>
                ))}
                {stats.recentEvents.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-400 text-xs"
                    >
                      イベントがまだありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
