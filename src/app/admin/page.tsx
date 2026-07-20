"use client";

import { useCallback, useEffect, useState } from "react";

// 旧8タイプの日本語名 (フォールバック用)。現行はサーバが 32 タイプの称号を name で返す。
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

// paywall_scroll_clicked の source → 日本語ラベル (設置場所)。
// 未知の source はキーをそのまま表示する (title 属性に生キーも残す)。
const PAYWALL_SOURCE_LABELS: Record<string, string> = {
  love_payoff_card: "恋愛「好きになった人が読むトリセツ」ロック",
  love_failure_card: "恋愛「失敗する恋愛の特徴」ロック",
  career_fit_card: "キャリア「活躍できる仕事・避けたほうがいい職場」ロック",
  career_talent_card: "キャリア「仕事で評価される意外な才能」ロック",
  deepdive_card: "深掘り(キャリア/成長/相性)ロック",
  scene_caution_card: "シーン別の注意点ロック",
  friend_dislike_card: "友達「嫌われやすい性格」ロック",
  urawaza_card: "旧:裏技でロック解除カード",
  relations_card: "「周りの人が、あなたに言えずにいること」ロック",
  deepdive_panel: "旧:深掘りロックパネル",
  deepdive_tab_career: "旧:深掘りタブ(キャリア)",
  deepdive_tab_growth: "旧:深掘りタブ(成長)",
  deepdive_tab_aisho: "旧:深掘りタブ(相性)",
  sticky_bar: "追従バー(結果ページ上部)",
  friend_list: "友達一覧ロック",
  friend_individual_paywall: "友達個別結果ページの課金カード",
  aisho_scene: "相性ページ(シーン別)",
  tako_unlocked: "/tako 解放後導線",
  paywall_direct: "課金カードから直接購入",
  unknown: "不明",
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
  friendDiagnosisFunnel: {
    measurementStartedAt: string;
    cohortDefinition: string;
    ownerFunnel: {
      key: string;
      label: string;
      count: number;
      rateFromPrevious: number | null;
      rateFromDiagnosis: number;
    }[];
    friendFunnel: {
      key: string;
      label: string;
      count: number;
      rateFromPrevious: number | null;
      rateFromLanding: number;
    }[];
    attention: {
      badgeShown: number;
      badgeClicked: number;
      badgeClickRate: number;
      takoReached: number;
      takoReachRate: number;
    };
  };
  paywallFunnel: { label: string; count: number }[];
  paywallSources: { source: string; count: number }[];
  paywallAttribution: {
    source: string;
    scrollClicks: number;
    purchaseCtaClicks: number;
    stripeReached: number;
    purchases: number;
    purchaseRate: number | null;
  }[];
  purchaseCompleted: number;
  purchaseConversionRate: number;
  recentEvents: {
    event_name: string;
    session_id: string | null;
    created_at: string;
    metadata: Record<string, unknown>;
  }[];
  friendToDiagClicked: number;
  friendToDiagRate: number;
  typeDistribution: { typeId: string; name?: string; count: number }[];
  paidUsers: number;
  revenueJpy: number;
  friendCountDistribution: {
    total: number;
    zero: number;
    one: number;
    two: number;
    threePlus: number;
    fivePlus: number;
  };
  diagQuestionReach: Record<string, number>;
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

type KpiTone = "indigo" | "emerald" | "amber" | "rose" | "slate";

const KPI_TONES: Record<
  KpiTone,
  { dot: string; icon: string; value: string }
> = {
  indigo: {
    dot: "bg-indigo-500",
    icon: "bg-indigo-50 text-indigo-600",
    value: "text-indigo-700",
  },
  emerald: {
    dot: "bg-emerald-500",
    icon: "bg-emerald-50 text-emerald-600",
    value: "text-emerald-700",
  },
  amber: {
    dot: "bg-amber-500",
    icon: "bg-amber-50 text-amber-600",
    value: "text-amber-700",
  },
  rose: {
    dot: "bg-rose-500",
    icon: "bg-rose-50 text-rose-600",
    value: "text-rose-700",
  },
  slate: {
    dot: "bg-slate-400",
    icon: "bg-slate-100 text-slate-600",
    value: "text-slate-900",
  },
};

function KpiCard({
  label,
  value,
  sub,
  tone = "slate",
  featured = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: KpiTone;
  featured?: boolean;
}) {
  const colors = KPI_TONES[tone];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        featured ? "p-5 xl:p-6" : "p-4"
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${colors.dot}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </p>
          <p
            className={`font-black tracking-tight tabular-nums ${colors.value} ${
              featured ? "text-3xl xl:text-[34px]" : "text-2xl"
            }`}
          >
            {value}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colors.icon}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
          >
            <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      {sub && (
        <p className={`mt-2 text-xs leading-relaxed ${featured ? "text-slate-500" : "text-slate-400"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  side,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  side?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
          {eyebrow}
        </p>
        <h2 className="text-lg font-black tracking-tight text-slate-900">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {description}
          </p>
        )}
      </div>
      {side}
    </div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
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
      <span className="w-28 shrink-0 text-right text-xs font-semibold text-slate-600">
        {label}
      </span>
      <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-slate-100">
        <div
          className="h-full rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-black text-slate-800">
          {count}
        </span>
      </div>
      <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-slate-400">
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
      <span className="w-40 shrink-0 truncate text-right text-xs font-semibold text-slate-600">
        {label}
      </span>
      <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-slate-100">
        <div
          className={`h-full rounded-md transition-all duration-500 ${color ?? "bg-purple-500/70"}`}
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center px-3 text-sm font-black text-slate-800">
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
    <Panel className="p-5 sm:p-6">
      <h3 className="mb-4 text-xs font-black uppercase tracking-[0.08em] text-slate-500">
        {title}
      </h3>
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
        <p className="mt-3 text-right text-[11px] font-medium text-slate-400">
          Q1→Q{totalQuestions} 到達率:{" "}
          {pct(data[totalQuestions - 1].count / data[0].count)}
        </p>
      )}
    </Panel>
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
    if (!stored) return;
    const restoreTimer = window.setTimeout(() => setAdminKey(stored), 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  const fetchStats = useCallback(
    async (key: string, p: Preset, cFrom: string, cTo: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        let range: { from: string; to: string } | null;
        if (p === "custom") {
          // "YYYY-MM-DD" を new Date() に直接渡すと UTC 深夜として解釈され、
          // JST の 00:00〜09:00 が前日に漏れる。T00:00:00 付きでローカル時刻として
          // 解釈させる (プリセットと同じ挙動に揃える。2026-07-13 修正)。
          const fromDate = new Date(`${cFrom}T00:00:00`);
          const toDate = new Date(`${cTo}T00:00:00`);
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
    if (!adminKey) return;
    const fetchTimer = window.setTimeout(
      () => void fetchStats(adminKey, preset, customFrom, customTo),
      0,
    );
    return () => window.clearTimeout(fetchTimer);
  }, [adminKey, preset, customFrom, customTo, fetchStats]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim()) {
      setAdminKey(inputKey.trim());
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("torisetsu_admin_key");
    setStats(null);
    setAdminKey(null);
    setInputKey("");
  };


  if (!adminKey) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0F172A] px-4 py-12 text-slate-900">
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-500/20 blur-3xl" />
        </div>
        <div className="relative w-full max-w-[420px]">
          <div className="mb-7 flex items-center justify-center gap-3 text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-950/30">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                Analytics
              </p>
              <p className="text-lg font-black tracking-tight">ワタシのトリセツ</p>
            </div>
          </div>
          <form
            onSubmit={handleLogin}
            className="rounded-3xl border border-white/70 bg-white p-7 shadow-2xl shadow-slate-950/30 sm:p-9"
          >
            <div className="mb-7">
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">
                管理画面にログイン
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                診断・拡散・課金の状況をまとめて確認できます。
              </p>
            </div>
            <label
              htmlFor="admin-password"
              className="mb-2 block text-xs font-bold text-slate-700"
            >
              管理パスワード
            </label>
            <input
              id="admin-password"
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="パスワードを入力"
              autoFocus
              className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
            {error && (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !inputKey.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-black text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "確認中..." : "ログイン"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <p className="mt-5 text-center text-[11px] font-medium text-slate-500">
            Authorized personnel only
          </p>
        </div>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center text-white">
          <span className="mx-auto mb-4 block h-9 w-9 animate-spin rounded-full border-[3px] border-indigo-400/30 border-t-indigo-400" />
          <p className="text-sm font-bold">ダッシュボードを読み込んでいます</p>
          <p className="mt-1 text-xs text-slate-500">集計には数秒かかる場合があります</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const funnelMax = Math.max(...stats.funnel.map((f) => f.count), 1);
  const ownerFriendFunnelMax = Math.max(
    ...stats.friendDiagnosisFunnel.ownerFunnel.map((f) => f.count),
    1,
  );
  const visitorFriendFunnelMax = Math.max(
    ...stats.friendDiagnosisFunnel.friendFunnel.map((f) => f.count),
    1,
  );
  const paywallFunnelMax = Math.max(
    ...(stats.paywallFunnel ?? []).map((f) => f.count),
    1,
  );
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
    rows.push(["# 友達診断ファネル（本人コホート）"]);
    rows.push(["ステップ", "人数", "前段比", "自己診断完了比"]);
    stats.friendDiagnosisFunnel.ownerFunnel.forEach((s) =>
      rows.push([
        s.label,
        String(s.count),
        s.rateFromPrevious === null ? "" : pct(s.rateFromPrevious),
        pct(s.rateFromDiagnosis),
      ]),
    );
    rows.push([]);
    rows.push(["# 友達側ファネル"]);
    rows.push(["ステップ", "人数", "前段比", "招待ページ到達比"]);
    stats.friendDiagnosisFunnel.friendFunnel.forEach((s) =>
      rows.push([
        s.label,
        String(s.count),
        s.rateFromPrevious === null ? "" : pct(s.rateFromPrevious),
        pct(s.rateFromLanding),
      ]),
    );
    rows.push([]);
    rows.push(["# 課金ファネル"]);
    rows.push(["ステップ", "件数"]);
    (stats.paywallFunnel ?? []).forEach((s) =>
      rows.push([s.label, String(s.count)]),
    );
    rows.push([]);
    if ((stats.paywallSources ?? []).length > 0) {
      rows.push(["# 解除ボタン押下の内訳"]);
      rows.push(["source", "クリック回数"]);
      stats.paywallSources.forEach((s) =>
        rows.push([s.source, String(s.count)]),
      );
      rows.push([]);
    }
    if ((stats.paywallAttribution ?? []).length > 0) {
      rows.push(["# 導線別の決済結果（最終タッチ）"]);
      rows.push([
        "source",
        "表示名",
        "誘導クリック",
        "購入ボタン",
        "Stripe到達",
        "決済完了",
        "クリック→決済率",
      ]);
      stats.paywallAttribution.forEach((s) =>
        rows.push([
          s.source,
          PAYWALL_SOURCE_LABELS[s.source] ?? s.source,
          String(s.scrollClicks),
          String(s.purchaseCtaClicks),
          String(s.stripeReached),
          String(s.purchases),
          s.purchaseRate === null ? "" : pct(s.purchaseRate),
        ]),
      );
      rows.push([]);
    }
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
      stats.typeDistribution.forEach((t) => rows.push([t.name ?? TYPE_LABELS[t.typeId] ?? t.typeId, String(t.count)]));
      rows.push([]);
    }
    rows.push(["# 診断質問到達数"]);
    rows.push(["質問", "回答数"]);
    for (let i = 0; i < 50; i++) rows.push([`Q${i + 1}`, String(stats.diagQuestionReach[String(i)] ?? 0)]);

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

  const selectedPeriodLabel =
    PRESETS.find((item) => item.key === preset)?.label ?? "7日";

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#111827] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-950/40">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">
              Analytics
            </p>
            <p className="text-sm font-black tracking-tight">ワタシのトリセツ</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6" aria-label="管理画面メニュー">
          {[
            ["#overview", "概要", "M4 12h16m4-4m0 0 4 4m-4-4v9"],
            ["#friend-funnel", "友達診断ファネル", "M4 5h16l-6 7v5l-4 2v-7L4 5Z"],
            ["#funnel", "全体ファネル", "M4 5h16l-6 7v5l-4 2v-7L4 5Z"],
            ["#revenue", "課金分析", "M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H7"],
            ["#growth", "拡散分析", "m4 16 5-5 4 4 7-8"],
            ["#audience", "ユーザー分析", "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 10v-2a4 4 0 0 0-3-3.87m-1-7.26a4 4 0 0 1 0 7.75"],
            ["#events", "イベントログ", "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"],
          ].map(([href, label, path], index) => (
            <a
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${
                index === 0
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d={path} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {label}
            </a>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
              <p className="text-xs font-bold text-slate-200">計測システム稼働中</p>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              診断・共有・決済イベントを集計しています
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-10">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white lg:hidden">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h1 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">
                  ダッシュボード
                </h1>
                <p className="hidden text-xs text-slate-400 sm:block">
                  サービス全体の状況をひと目で確認
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-500 md:inline-flex">
                表示期間：{selectedPeriodLabel}
              </span>
            <button
              onClick={downloadCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 sm:px-4"
            >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">CSV出力</span>
            </button>
            <button
              onClick={() => fetchStats(adminKey, preset, customFrom, customTo)}
              disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 sm:px-4"
            >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  aria-hidden="true"
                >
                  <path d="M20 11a8 8 0 1 0-2.34 5.66M20 11V5m0 6h-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="hidden sm:inline">{loading ? "更新中" : "更新"}</span>
            </button>
              <button
                onClick={handleLogout}
                className="hidden rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:block"
              >
                ログアウト
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-[1500px] flex-col gap-10 px-4 py-6 sm:px-6 sm:py-8 xl:px-10 xl:py-10">
          <section id="overview" className="scroll-mt-28">
            <Panel className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-xs font-black text-slate-800">集計期間</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  期間を変更するとすべての指標が自動更新されます
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <div className="flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPreset(p.key)}
                      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-black transition sm:px-4 ${
                        preset === p.key
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
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
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs text-slate-400">〜</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>
            </Panel>
          </section>

          <section>
            <SectionHeader
              eyebrow="Overview"
              title="重要指標"
              description="まず確認したい診断・課金の主要な数字"
              side={
                loading ? (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                    更新中
                  </span>
                ) : undefined
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <KpiCard
                label="診断完了"
                value={stats.diagnosisCompleted.toLocaleString()}
                sub={`診断開始 ${stats.diagnosisStarted.toLocaleString()}件`}
                tone="indigo"
                featured
              />
              <KpiCard
                label="診断完了率"
                value={pct(stats.completionRate)}
                sub="診断開始から結果表示まで"
                tone="emerald"
                featured
              />
              <KpiCard
                label="課金ユーザー"
                value={stats.paidUsers.toLocaleString()}
                sub={`概算売上 ¥${(stats.revenueJpy ?? 0).toLocaleString()}`}
                tone="amber"
                featured
              />
              <KpiCard
                label="決済完了"
                value={stats.purchaseCompleted.toLocaleString()}
                sub={`課金カード表示→決済 ${pct(stats.purchaseConversionRate)}`}
                tone="rose"
                featured
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard label="友達共有" value={stats.shareCount} sub={`共有率 ${pct(stats.shareRate)}`} tone="indigo" />
              <KpiCard label="友達回答完了" value={stats.friendAnswerCompleted} sub={`完了率 ${pct(stats.answerCompletionRate)}`} tone="emerald" />
              <KpiCard label="3人達成" value={stats.threeAchieved} sub="第二部の解放" tone="amber" />
              <KpiCard label="5人達成" value={stats.fiveAchieved} sub="見られ方の完成" tone="rose" />
              <KpiCard label="結果再訪" value={stats.resultRevisited} sub={`再訪率 ${pct(stats.revisitRate)}`} />
              <KpiCard label="診断開始" value={stats.diagnosisStarted} sub="ユニークセッション" />
              <KpiCard label="友達回答開始" value={stats.friendAnswerStarted} sub="ユニークセッション" />
              <KpiCard label="友達共有率" value={pct(stats.shareRate)} sub="診断完了→共有" />
              <KpiCard label="回答完了率" value={pct(stats.answerCompletionRate)} sub="回答開始→完了" />
              <KpiCard label="友達→自分も作る" value={stats.friendToDiagClicked} sub={`転換率 ${pct(stats.friendToDiagRate)}`} />
            </div>
          </section>

        {/* 本人コホートと友達側を分けた友達診断ファネル */}
          <section id="friend-funnel" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Friend diagnosis"
              title="友達診断ファネル"
              description="自己診断を終えた本人が友達診断へ進み、友達の新しい診断につながるまで"
              side={
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5">
                  <p className="text-[10px] font-bold text-rose-600">自己診断→友達診断到達</p>
                  <p className="text-lg font-black tabular-nums text-rose-900">
                    {pct(stats.friendDiagnosisFunnel.attention.takoReachRate)}
                  </p>
                </div>
              }
            />
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="赤バッジ表示"
                value={stats.friendDiagnosisFunnel.attention.badgeShown}
                sub="ユニーク本人"
                tone="rose"
              />
              <KpiCard
                label="赤バッジクリック"
                value={stats.friendDiagnosisFunnel.attention.badgeClicked}
                sub={`クリック率 ${pct(stats.friendDiagnosisFunnel.attention.badgeClickRate)}`}
                tone="rose"
              />
              <KpiCard
                label="友達診断到達"
                value={stats.friendDiagnosisFunnel.attention.takoReached}
                sub="ユニーク本人"
                tone="indigo"
              />
              <KpiCard
                label="自己診断→到達率"
                value={pct(stats.friendDiagnosisFunnel.attention.takoReachRate)}
                sub="自己診断完了を分母"
                tone="emerald"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel className="p-5 sm:p-6">
                <h3 className="text-sm font-black text-slate-800">本人側（ユニーク本人）</h3>
                <p className="mt-1 text-[11px] text-slate-400">
                  選択期間に自己診断を完了した本人を、現在まで追跡
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {stats.friendDiagnosisFunnel.ownerFunnel.map((step, index) => (
                    <FunnelBar
                      key={step.key}
                      label={step.label}
                      count={step.count}
                      max={ownerFriendFunnelMax}
                      prevCount={
                        index > 0
                          ? stats.friendDiagnosisFunnel.ownerFunnel[index - 1].count
                          : undefined
                      }
                    />
                  ))}
                </div>
              </Panel>
              <Panel className="p-5 sm:p-6">
                <h3 className="text-sm font-black text-slate-800">友達側（ユニーク友達セッション）</h3>
                <p className="mt-1 text-[11px] text-slate-400">
                  同じ本人コホートの招待を受けた友達の行動
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  {stats.friendDiagnosisFunnel.friendFunnel.map((step, index) => (
                    <FunnelBar
                      key={step.key}
                      label={step.label}
                      count={step.count}
                      max={visitorFriendFunnelMax}
                      prevCount={
                        index > 0
                          ? stats.friendDiagnosisFunnel.friendFunnel[index - 1].count
                          : undefined
                      }
                    />
                  ))}
                </div>
              </Panel>
            </div>
            <p className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-indigo-700">
              {stats.friendDiagnosisFunnel.cohortDefinition}。招待実行はシェアボタン操作に加え、QR経由などで友達の到達が確認できた本人も含めます。
              計測開始: {new Date(stats.friendDiagnosisFunnel.measurementStartedAt).toLocaleString("ja-JP")}。
            </p>
          </section>

        {/* Funnel */}
          <section id="funnel" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Conversion"
              title="全体ファネル（参考）"
              description="診断開始から友達回答まで、どこで離脱しているかを確認"
            />
            <Panel className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
              <span className="w-28 text-right">ステップ</span>
              <span className="flex-1">件数</span>
              <span className="w-16 text-right">前段比</span>
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
            <p className="mt-4 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">
              診断〜友達回答はユニークセッション数、3人/5人達成は「N人目の回答が期間内に届いたオーナー数」。
              単位が異なるため前ステップ比は目安です。
            </p>
            </Panel>
        </section>

        {/* 課金ファネル (2026-07-13): ユーザーが課金導線のどこまで進んでいるか */}
          <section id="revenue" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Revenue"
              title="課金分析"
              description="¥499フルアクセスの閲覧から決済完了までを追跡"
              side={
                <div className="flex items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <div>
                    <p className="text-[10px] font-bold text-amber-700">概算売上</p>
                    <p className="text-lg font-black tabular-nums text-amber-900">
                      ¥{(stats.revenueJpy ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              }
            />
            <Panel className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
              <span className="w-28 text-right">ステップ</span>
              <span className="flex-1">件数</span>
              <span className="w-16 text-right">前段比</span>
            </div>
            <div className="flex flex-col gap-2">
              {(stats.paywallFunnel ?? []).map((step, i) => (
                <FunnelBar
                  key={step.label}
                  label={step.label}
                  count={step.count}
                  max={paywallFunnelMax}
                  prevCount={
                    i > 0 ? stats.paywallFunnel[i - 1].count : undefined
                  }
                />
              ))}
            </div>
            <p className="mt-4 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">
              前半3ステップはユニークセッション数、Stripe到達・決済完了はサーバ記録の件数。
              計測開始 (2026-07-13) 以前のデータは含まれません。
            </p>
            {/* 誘導クリックの内訳 (どのボタンが課金カードへ連れてきているか) */}
            {(stats.paywallSources ?? []).length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="mb-3 text-xs font-black text-slate-700">
                  解除ボタン押下の内訳 (どのCTAから課金カードへ飛んだか・クリック回数)
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.paywallSources.map((s) => (
                    <span
                      key={s.source}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
                      title={s.source}
                    >
                      {PAYWALL_SOURCE_LABELS[s.source] ?? s.source}:{" "}
                      <b>{s.count}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(stats.paywallAttribution ?? []).length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-1 text-sm font-black text-slate-900">
                  導線別の決済結果（最後に押したカード別）
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  どのロックカードから購入へ進んだかを、Stripe到達・決済完了まで追跡します。
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">導線</th>
                        <th className="px-3 py-2.5 text-right font-medium">誘導クリック</th>
                        <th className="px-3 py-2.5 text-right font-medium">購入ボタン</th>
                        <th className="px-3 py-2.5 text-right font-medium">Stripe到達</th>
                        <th className="px-3 py-2.5 text-right font-medium">決済完了</th>
                        <th className="px-3 py-2.5 text-right font-medium">購入率</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.paywallAttribution.map((s) => (
                        <tr key={s.source} className="transition hover:bg-slate-50/70">
                          <td className="px-3 py-3 font-semibold text-slate-700" title={s.source}>
                            {PAYWALL_SOURCE_LABELS[s.source] ?? s.source}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {s.scrollClicks}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {s.purchaseCtaClicks}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {s.stripeReached}
                          </td>
                          <td className="px-3 py-3 text-right font-black tabular-nums text-slate-900">
                            {s.purchases}
                          </td>
                          <td className="px-3 py-3 text-right font-black tabular-nums text-indigo-600">
                            {s.purchaseRate === null ? "—" : pct(s.purchaseRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[11px] text-slate-400">
                  購入率は「決済完了 ÷ 誘導クリック」。計測更新前の決済は「不明」に含まれます。
                </p>
              </div>
            )}
            </Panel>
        </section>

        {/* Campaign Stats */}
        {stats.campaignStats.length > 0 && (
          <section>
            <SectionHeader
              eyebrow="Acquisition"
              title="キャンペーン別"
              description="流入施策ごとの診断完了と友達回答（全期間）"
            />
            <Panel className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">campaign</th>
                    <th className="px-4 py-3 font-medium text-right">診断完了</th>
                    <th className="px-4 py-3 font-medium text-right">友達回答</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.campaignStats.map((c) => (
                    <tr key={c.campaign} className="border-b border-slate-50 transition hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-mono font-bold text-indigo-700">
                          {c.campaign}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.completed}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.friendCompleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        )}

        {/* Viral Metrics */}
          <section id="growth" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Growth"
              title="拡散分析"
              description="友達への共有から新しい診断が生まれる力を確認"
              side={
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5">
                  <p className="text-[10px] font-bold text-indigo-600">実測拡散係数</p>
                  <p className="text-lg font-black tabular-nums text-indigo-900">
                    {stats.viral.viralCoefficient.toFixed(3)}
                  </p>
                </div>
              }
            />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
          <p className="mt-3 text-[11px] font-medium text-slate-400">
            拡散係数 {'>'} 1.0 で自然増殖 / 0.5以上でMVPとして良好
          </p>
          {stats.viral.friendLandingViewed === 0 && stats.friendAnswerStarted > 0 && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
              ⚠ 友達ページ到達が0件：5/2デプロイ以前の回答にはこのイベントがありません。今後のアクセスから計測されます。
            </p>
          )}
        </section>

        {/* Generation Distribution */}
        {stats.generationDistribution.length > 0 && (
          <section>
            <SectionHeader
              eyebrow="Network"
              title="拡散の世代分布"
              description="共有が何世代先まで広がっているか（全期間）"
            />
            <Panel className="p-5 sm:p-6">
              <div className="mb-5 flex items-end justify-center gap-3">
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
                            <span className="text-sm font-black tabular-nums text-slate-800">{g.count}</span>
                            <div className="relative w-14" style={{ height: "96px" }}>
                              <div
                                className="absolute bottom-0 w-full rounded-t-md transition-all duration-500"
                                style={{
                                  height: `${Math.max(height, 5)}%`,
                                  backgroundColor: g.generation === 0 ? "#3b82f6" : g.generation === 1 ? "#8b5cf6" : g.generation === 2 ? "#ec4899" : "#f97316",
                                }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-500">
                              {g.generation === 0 ? "Seed" : `第${g.generation}世代`}
                            </span>
                          </div>
                        );
                      })}
                      {stats.unknownGeneration > 0 && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-black tabular-nums text-slate-400">{stats.unknownGeneration}</span>
                          <div className="relative w-14" style={{ height: "96px" }}>
                            <div
                              className="absolute bottom-0 w-full rounded-t-md bg-slate-200"
                              style={{ height: `${Math.max((stats.unknownGeneration / max) * 100, 5)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-400">不明</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <p className="border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
                Seed = campaignパラメータ付き / 第N世代 = 友達回答後に自分も診断した人
              </p>
            </Panel>
          </section>
        )}

        {/* Friend Count Distribution */}
          <section id="audience" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Audience"
              title="友達回答人数の分布"
              description="診断ユーザーが何人から回答を集められたか（全期間）"
            />
            <Panel className="p-5 sm:p-6">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-slate-800">{fc.zero}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">0人</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-slate-800">{fc.one}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">1人</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-slate-800">{fc.two}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">2人</p>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-indigo-700">{fc.threePlus}</p>
                <p className="mt-1 text-[11px] font-bold text-indigo-500">3人以上</p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-violet-700">{fc.fivePlus}</p>
                <p className="mt-1 text-[11px] font-bold text-violet-500">5人以上</p>
              </div>
            </div>
            <p className="border-t border-slate-100 pt-4 text-right text-[11px] text-slate-400">
              全診断完了者 {fc.total}人 / 1人以上回答あり {fc.total - fc.zero}人
              ({fc.total > 0 ? pct((fc.total - fc.zero) / fc.total) : "0.0%"})
            </p>
            </Panel>
        </section>

        {/* Type Distribution */}
        <section>
            <SectionHeader
              eyebrow="Segments"
              title="タイプ分布"
              description="診断結果32タイプの構成（全期間）"
            />
            <Panel className="p-5 sm:p-6">
            {stats.typeDistribution.length > 0 ? (
              <div className="flex flex-col gap-2">
                {stats.typeDistribution.map((t) => (
                  <DistributionBar
                    key={t.typeId}
                    label={t.name ?? TYPE_LABELS[t.typeId] ?? t.typeId}
                    count={t.count}
                    max={typeMax}
                  />
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400">
                データがまだありません
              </p>
            )}
            {stats.typeDistribution.length > 0 && (
              <p className="mt-4 border-t border-slate-100 pt-4 text-right text-[11px] text-slate-400">
                合計 {stats.typeDistribution.reduce((s, t) => s + t.count, 0)}人
              </p>
            )}
            </Panel>
        </section>

        {/* Question Reach */}
        <section>
            <SectionHeader
              eyebrow="Engagement"
              title="質問ごとの到達数"
              description="50問のうち、どの地点で回答が止まっているか"
            />
          <div className="grid grid-cols-1 gap-4">
            <QuestionReachChart
              title="診断（50問）"
              reach={stats.diagQuestionReach}
              totalQuestions={50}
            />
          </div>
        </section>


        {/* Recent Events */}
          <section id="events" className="scroll-mt-28">
            <SectionHeader
              eyebrow="Activity"
              title="直近イベント"
              description="システムが受信した最新50件の計測イベント"
            />
            <Panel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
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
                    className="border-b border-slate-50 transition hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-block rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-700">
                        {ev.event_name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-slate-500">
                      {new Date(ev.created_at).toLocaleString("ja-JP", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">
                      {ev.session_id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-xs text-slate-400">
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
                      className="px-4 py-8 text-center text-xs text-slate-400"
                    >
                      イベントがまだありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </Panel>
        </section>
        </main>
      </div>
    </div>
  );
}
