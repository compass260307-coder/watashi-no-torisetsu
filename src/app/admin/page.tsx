"use client";

import { useState, useEffect, useCallback } from "react";

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold">ワタシのトリセツ</h1>
            <p className="text-xs text-gray-400">MVP定点観測</p>
          </div>
          <button
            onClick={() => fetchStats(adminKey, preset, customFrom, customTo)}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-40"
          >
            {loading ? "更新中..." : "↻ 更新"}
          </button>
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
            <KpiCard label="診断開始数" value={stats.diagnosisStarted} />
            <KpiCard label="診断完了数" value={stats.diagnosisCompleted} />
            <KpiCard
              label="診断完了率"
              value={pct(stats.completionRate)}
              sub="開始→完了"
            />
            <KpiCard
              label="友達共有数"
              value={stats.shareCount}
              sub="ユニークセッション"
            />
            <KpiCard
              label="友達共有率"
              value={pct(stats.shareRate)}
              sub="完了者のうち共有した人"
            />
            <KpiCard label="友達回答開始数" value={stats.friendAnswerStarted} />
            <KpiCard label="友達回答完了数" value={stats.friendAnswerCompleted} />
            <KpiCard
              label="友達回答完了率"
              value={pct(stats.answerCompletionRate)}
              sub="開始→完了"
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
              label="結果再訪数"
              value={stats.resultRevisited}
              sub="ユニークセッション"
            />
            <KpiCard
              label="結果再訪率"
              value={pct(stats.revisitRate)}
              sub="初回閲覧者のうち再訪した人"
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
