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
  love_failure_card: "恋愛「恋人が密かに我慢していること」ロック",
  career_fit_card: "キャリア「合った働き方・避けたほうがいい職場」ロック",
  career_avoid_card: "旧:キャリア「避けたほうがいい職場」ロック",
  career_relations_card: "キャリア「職場の人間関係」ロック",
  career_talent_card: "旧:キャリア「仕事で評価される意外な才能」ロック (KO は継続)",
  deepdive_card: "旧:深掘り(キャリア/成長/相性)ロック",
  scene_caution_card: "シーン別の注意点ロック",
  moshimo_card: "「もしもの時のアナタ」ロック",
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
  tako_lock: "旧:/tako 共通ロック (カード別計測前)",
  tako_mote_card: "友達診断「モテ理由」ロック",
  tako_hints_card: "友達診断「好かれるヒント」ロック",
  tako_kotsu_card: "友達診断「関係を深めるヒント」ロック",
  tako_wana_card: "友達診断「関係を壊すワナ」ロック",
  tako_unlocked: "/tako 解放後導線",
  tako_promo_card: "/tako 購入カード (直接購入)",
  paywall_direct: "課金カードから直接購入",
  unknown: "不明",
};

// payment_history.payment_kind → 日本語ラベル (商品別の売上内訳)。
const PAYMENT_KIND_LABELS: Record<string, string> = {
  full_access: "完全版レポート (¥499)",
  tako_unlock: "友達診断の全解放 (¥799 / 全解放者¥300)",
  perception_unlock: "友達個別の解放",
  integrated_trisetsu: "旧:統合トリセツ",
  unknown: "不明 (kind未記録)",
};

type Stats = {
  coreKpis: {
    cohort: {
      from: string | null;
      to: string | null;
      diagnosisUsers: number;
      paidUsers: number;
      definition: string;
    };
    diagnosisTrend: {
      granularity: "day";
      timezone: "Asia/Tokyo";
      current: number;
      previous: number | null;
      change: number | null;
      changeRate: number | null;
      previousFrom: string | null;
      previousTo: string | null;
      points: { date: string; count: number }[];
    };
    diagnosisToPaid: {
      numerator: number;
      denominator: number;
      rate: number;
    };
    diagnosisToFriend: {
      numerator: number;
      denominator: number;
      rate: number;
    };
    paidToFriend: {
      numerator: number;
      denominator: number;
      rate: number;
    };
    arpu: {
      denominator: number;
      basis: string;
      currencies: {
        currency: string;
        grossRevenueMinor: number;
        refundedMinor: number;
        netRevenueMinor: number;
        arpuMinor: number;
        purchases: number;
        payers: number;
      }[];
    };
    periodRevenue: {
      basis: string;
      currencies: {
        currency: string;
        grossRevenueMinor: number;
        refundedMinor: number;
        netRevenueMinor: number;
        purchases: number;
        payers: number;
      }[];
    };
    viralCoefficient: {
      children: number;
      denominator: number;
      parentsWithChild: number;
      value: number;
    };
    dataQuality: {
      diagnosedUsers: number;
      totalUsers: number;
      diagnosisTimestampCoverage: number;
      matchedPayments: number;
      unmatchedPayments: number;
      paymentUserMatchRate: number;
      ready: boolean;
      issues: string[];
    };
  };
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
  takoFunnel: { label: string; count: number }[];
  paywallSources: { source: string; count: number }[];
  paywallAttribution: {
    source: string;
    scrollClicks: number;
    purchaseCtaClicks: number;
    stripeReached: number;
    purchases: number;
    purchaseRate: number | null;
  }[];
  takoAttribution: {
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
  revenueByKind: {
    kind: string;
    currency: string;
    purchases: number;
    grossRevenueMinor: number;
    refundedMinor: number;
    netRevenueMinor: number;
  }[];
  revenueDaily: {
    date: string;
    purchases: number;
    currencies: {
      currency: string;
      netRevenueMinor: number;
      refundedMinor: number;
    }[];
  }[];
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

const ADMIN_NAV_ITEMS = [
  {
    href: "#overview",
    id: "overview",
    label: "エグゼクティブ概要",
    shortLabel: "概要",
    path: "M4 13h5V4H4v9Zm0 7h5v-4H4v4Zm8 0h8v-9h-8v9Zm0-16v4h8V4h-8Z",
  },
  {
    href: "#revenue",
    id: "revenue",
    label: "課金分析",
    shortLabel: "課金",
    path: "M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H7",
  },
  {
    href: "#friend-funnel",
    id: "friend-funnel",
    label: "友達診断ファネル",
    shortLabel: "友達診断",
    path: "M4 5h16l-6 7v5l-4 2v-7L4 5Z",
  },
  {
    href: "#funnel",
    id: "funnel",
    label: "全体ファネル",
    shortLabel: "全体ファネル",
    path: "M4 5h16l-6 7v5l-4 2v-7L4 5Z",
  },
  {
    href: "#growth",
    id: "growth",
    label: "拡散分析",
    shortLabel: "拡散",
    path: "m4 16 5-5 4 4 7-8m-6 0h6v6",
  },
  {
    href: "#audience",
    id: "audience",
    label: "ユーザー分析",
    shortLabel: "ユーザー",
    path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 10v-2a4 4 0 0 0-3-3.87m-1-7.26a4 4 0 0 1 0 7.75",
  },
  {
    href: "#events",
    id: "events",
    label: "イベントログ",
    shortLabel: "ログ",
    path: "M4 4h16v16H4zM8 8h8M8 12h8M8 16h5",
  },
] as const;

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

// 前期間比較のレンジ: 今日→昨日 / 7日→前の7日 / 30日→前の30日。
// all/custom は比較なし (基準となる「直前の同じ長さ」が定義できないため)。
function getPrevPresetRange(
  preset: Preset,
): { from: string; to: string; label: string } | null {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let days: number;
  let label: string;
  if (preset === "today") {
    days = 1;
    label = "昨日";
  } else if (preset === "7d") {
    days = 7;
    label = "前の7日";
  } else if (preset === "30d") {
    days = 30;
    label = "前の30日";
  } else {
    return null;
  }
  const from = new Date(base);
  from.setDate(from.getDate() - days * 2 + 1);
  const to = new Date(base);
  to.setDate(to.getDate() - days);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString(), label };
}

// 比較期間の選択を実レンジに解決する。
//   auto   = 直前の同じ長さの期間 (getPrevPresetRange。all/カスタムは比較不能で null)
//   custom = ユーザー指定の日付範囲 ("YYYY-MM-DD"。ローカル時刻で丸一日に展開)
//   none   = 比較しない
function resolveCompareRange(
  preset: Preset,
  comparePreset: "auto" | "custom" | "none",
  compareFrom: string,
  compareTo: string,
): { from: string; to: string; label: string } | null {
  if (comparePreset === "none") return null;
  if (comparePreset === "custom") {
    if (!compareFrom || !compareTo) return null;
    const fromDate = new Date(`${compareFrom}T00:00:00`);
    const toDate = new Date(`${compareTo}T00:00:00`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return null;
    }
    toDate.setHours(23, 59, 59, 999);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const label =
      compareFrom === compareTo
        ? fmt(fromDate)
        : `${fmt(fromDate)}〜${fmt(toDate)}`;
    return { from: fromDate.toISOString(), to: toDate.toISOString(), label };
  }
  return getPrevPresetRange(preset);
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const pctOrDash = (v: number, denominator: number) =>
  denominator > 0 ? pct(v) : "—";

const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw"]);

function formatMoney(minor: number, currency: string): string {
  const normalized = currency.toLowerCase();
  const amount = ZERO_DECIMAL_CURRENCIES.has(normalized)
    ? minor
    : minor / 100;
  try {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: normalized.toUpperCase(),
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 1,
    }).format(amount);
  } catch {
    return `${normalized.toUpperCase()} ${amount.toFixed(1)}`;
  }
}

function formatArpu(currencies: Stats["coreKpis"]["arpu"]["currencies"]): string {
  if (currencies.length === 0) return "—";
  return currencies
    .map((row) => formatMoney(row.arpuMinor, row.currency))
    .join(" / ");
}

function formatNetRevenue(
  currencies: { currency: string; netRevenueMinor: number }[],
): string {
  if (currencies.length === 0) return "—";
  return currencies
    .map((row) => formatMoney(row.netRevenueMinor, row.currency))
    .join(" / ");
}

// 期間比較で使う3つの見出し数値 (診断人数/課金額/友達診断率) を Stats から導出。
// 本体カードと前期間側で同じロジックを使い、比較のズレを防ぐ。
function computeHeadlines(stats: Stats) {
  const coreReady = stats.coreKpis.dataQuality.ready;
  const ownerDiagnosisStep = stats.friendDiagnosisFunnel.ownerFunnel.find(
    (step) => step.key === "diagnosis",
  );
  const ownerFriendCompletedStep = stats.friendDiagnosisFunnel.ownerFunnel.find(
    (step) => step.key === "friend_answer",
  );
  const hasTrustedCoreDiagnosis =
    coreReady &&
    (stats.coreKpis.cohort.diagnosisUsers > 0 ||
      stats.diagnosisCompleted === 0);
  const diagnosisUsers = hasTrustedCoreDiagnosis
    ? stats.coreKpis.cohort.diagnosisUsers
    : stats.diagnosisCompleted;
  const friendNumerator = hasTrustedCoreDiagnosis
    ? stats.coreKpis.diagnosisToFriend.numerator
    : (ownerFriendCompletedStep?.count ?? 0);
  const friendDenominator = hasTrustedCoreDiagnosis
    ? stats.coreKpis.diagnosisToFriend.denominator
    : (ownerDiagnosisStep?.count ?? diagnosisUsers);
  const friendRate =
    friendDenominator > 0 ? friendNumerator / friendDenominator : 0;
  const currencies = stats.coreKpis.periodRevenue.currencies;
  const purchases = currencies.reduce((sum, row) => sum + row.purchases, 0);
  const revenueLabel =
    currencies.length > 0 ? formatNetRevenue(currencies) : formatMoney(0, "jpy");
  return {
    hasTrustedCoreDiagnosis,
    diagnosisUsers,
    friendNumerator,
    friendDenominator,
    friendRate,
    currencies,
    purchases,
    revenueLabel,
  };
}

type MetricTrend = "up" | "down" | "flat";

function trendOf(diff: number): MetricTrend {
  return diff > 0 ? "up" : diff < 0 ? "down" : "flat";
}

const TREND_STYLES: Record<MetricTrend, { chip: string; arrow: string }> = {
  up: {
    chip: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    arrow: "▲",
  },
  down: {
    chip: "border-rose-300/25 bg-rose-300/10 text-rose-200",
    arrow: "▼",
  },
  flat: {
    chip: "border-white/10 bg-white/[0.06] text-slate-300",
    arrow: "―",
  },
};

// 数値セル: 0 は薄く沈め、値がある所だけ目に入るようにする。
function AttributionNum({ value, strong }: { value: number; strong?: boolean }) {
  if (value === 0) {
    return <span className="tabular-nums text-slate-300">0</span>;
  }
  return (
    <span
      className={`tabular-nums ${
        strong ? "font-black text-emerald-600" : "font-bold text-slate-700"
      }`}
    >
      {value}
    </span>
  );
}

// 導線別の決済結果テーブル (¥499 / ¥799 の両商品で共用)。
function AttributionTable({
  rows,
}: {
  rows: {
    source: string;
    scrollClicks: number;
    purchaseCtaClicks: number;
    stripeReached: number;
    purchases: number;
    purchaseRate: number | null;
  }[];
}) {
  const maxClicks = Math.max(1, ...rows.map((s) => s.scrollClicks));
  return (
    <div className="overflow-x-auto rounded-[18px] border border-slate-200/80">
      <table className="w-full min-w-[760px] text-xs">
        <thead className="bg-slate-50/90 text-slate-500">
          <tr>
            <th className="px-3 py-2.5 text-left font-medium">導線</th>
            <th className="px-3 py-2.5 text-right font-medium">誘導クリック</th>
            <th className="px-2 py-2.5 text-center font-medium text-slate-300">→</th>
            <th className="px-3 py-2.5 text-right font-medium">購入ボタン</th>
            <th className="px-2 py-2.5 text-center font-medium text-slate-300">→</th>
            <th className="px-3 py-2.5 text-right font-medium">Stripe到達</th>
            <th className="px-2 py-2.5 text-center font-medium text-slate-300">→</th>
            <th className="px-3 py-2.5 text-right font-medium">決済完了</th>
            <th className="px-3 py-2.5 text-right font-medium">購入率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100/80">
          {rows.map((s) => {
            const label = PAYWALL_SOURCE_LABELS[s.source] ?? s.source;
            const isLegacy = label.startsWith("旧");
            return (
              <tr
                key={s.source}
                className={`transition hover:bg-indigo-50/35 ${
                  s.purchases > 0 ? "bg-emerald-50/50" : ""
                }`}
              >
                <td className="px-3 py-3" title={s.source}>
                  <p
                    className={`flex items-center gap-2 font-semibold ${
                      isLegacy ? "text-slate-400" : "text-slate-700"
                    }`}
                  >
                    {label}
                    {s.purchases > 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                        購入あり
                      </span>
                    )}
                  </p>
                  {/* 誘導クリック量のミニバー (最大行=100%) */}
                  <span className="mt-1.5 block h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 ${
                        isLegacy ? "opacity-30" : ""
                      }`}
                      style={{
                        width: `${Math.max(
                          s.scrollClicks > 0 ? 2 : 0,
                          (s.scrollClicks / maxClicks) * 100,
                        )}%`,
                      }}
                    />
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <AttributionNum value={s.scrollClicks} />
                </td>
                <td aria-hidden="true" className="px-2 py-3 text-center text-slate-200">
                  →
                </td>
                <td className="px-3 py-3 text-right">
                  <AttributionNum value={s.purchaseCtaClicks} />
                </td>
                <td aria-hidden="true" className="px-2 py-3 text-center text-slate-200">
                  →
                </td>
                <td className="px-3 py-3 text-right">
                  <AttributionNum value={s.stripeReached} />
                </td>
                <td aria-hidden="true" className="px-2 py-3 text-center text-slate-200">
                  →
                </td>
                <td className="px-3 py-3 text-right">
                  <AttributionNum value={s.purchases} strong />
                </td>
                <td className="px-3 py-3 text-right">
                  {s.purchaseRate === null ? (
                    <span className="text-slate-300">—</span>
                  ) : s.purchaseRate > 0 ? (
                    <span className="rounded-full bg-indigo-600 px-2 py-1 text-[11px] font-black tabular-nums text-white">
                      {pct(s.purchaseRate)}
                    </span>
                  ) : (
                    <span className="tabular-nums text-slate-300">0.0%</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ExecutiveMetricTone = "indigo" | "emerald" | "cyan";

const EXECUTIVE_METRIC_TONES: Record<
  ExecutiveMetricTone,
  { accent: string; glow: string; badge: string; icon: string }
> = {
  indigo: {
    accent: "from-indigo-400 via-violet-400 to-fuchsia-400",
    glow: "bg-indigo-500/25",
    badge: "border-indigo-300/20 bg-indigo-300/10 text-indigo-100",
    icon: "bg-indigo-400/15 text-indigo-200 ring-indigo-300/20",
  },
  emerald: {
    accent: "from-emerald-400 via-teal-300 to-cyan-300",
    glow: "bg-emerald-400/20",
    badge: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    icon: "bg-emerald-400/15 text-emerald-200 ring-emerald-300/20",
  },
  cyan: {
    accent: "from-cyan-300 via-sky-400 to-indigo-400",
    glow: "bg-cyan-400/20",
    badge: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    icon: "bg-cyan-400/15 text-cyan-100 ring-cyan-300/20",
  },
};

function ExecutiveMetricCard({
  index,
  label,
  value,
  unit,
  detail,
  badge,
  tone,
  compactValue = false,
  compare,
}: {
  index: string;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  badge: string;
  tone: ExecutiveMetricTone;
  compactValue?: boolean;
  /** 前期間比較チップ (昨日/前の7日 など)。null/undefined なら非表示。 */
  compare?: { label: string; trend: MetricTrend } | null;
}) {
  const colors = EXECUTIVE_METRIC_TONES[tone];
  return (
    <article className="group relative min-h-[220px] overflow-hidden rounded-[24px] border border-white/[0.11] bg-white/[0.055] p-5 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.75)] backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.075] sm:p-6">
      <span
        aria-hidden="true"
        className={`absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl ${colors.glow}`}
      />
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${colors.accent}`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <span className={`inline-flex rounded-full border px-3 py-1.5 text-[9px] font-black tracking-[0.08em] ${colors.badge}`}>
          {badge}
        </span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-[10px] font-black ring-1 ${colors.icon}`}>
          {index}
        </span>
      </div>
      <p className="relative mt-5 text-[12px] font-black tracking-[0.02em] text-slate-300">
        {label}
      </p>
      <div className="relative mt-2 flex min-w-0 items-end gap-2">
        <p
          className={`min-w-0 font-black leading-none tracking-[-0.065em] tabular-nums text-white ${
            compactValue
              ? "text-[clamp(2.25rem,3.3vw,3.9rem)]"
              : "text-[clamp(3.25rem,4.8vw,5.25rem)]"
          }`}
        >
          {value}
        </p>
        {unit ? (
          <span className="mb-1.5 shrink-0 text-lg font-black text-slate-200 sm:mb-2 sm:text-xl">
            {unit}
          </span>
        ) : null}
      </div>
      {compare ? (
        <p
          className={`relative mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tabular-nums ${TREND_STYLES[compare.trend].chip}`}
        >
          <span aria-hidden="true">{TREND_STYLES[compare.trend].arrow}</span>
          {compare.label}
        </p>
      ) : null}
      <p className="relative mt-4 border-t border-white/[0.08] pt-3 text-[11px] font-medium leading-relaxed text-slate-400">
        {detail}
      </p>
    </article>
  );
}

type KpiTone = "indigo" | "emerald" | "amber" | "rose" | "slate";

const KPI_TONES: Record<
  KpiTone,
  { accent: string; icon: string; value: string; glow: string; number: string }
> = {
  indigo: {
    accent: "from-indigo-600 via-violet-500 to-fuchsia-400",
    icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    value: "text-indigo-700",
    glow: "bg-indigo-400/12",
    number: "text-indigo-200",
  },
  emerald: {
    accent: "from-emerald-600 via-teal-500 to-cyan-400",
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    value: "text-emerald-700",
    glow: "bg-emerald-400/12",
    number: "text-emerald-200",
  },
  amber: {
    accent: "from-amber-500 via-orange-500 to-rose-400",
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
    value: "text-amber-700",
    glow: "bg-amber-400/12",
    number: "text-amber-200",
  },
  rose: {
    accent: "from-rose-600 via-pink-500 to-fuchsia-400",
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    value: "text-rose-700",
    glow: "bg-rose-400/12",
    number: "text-rose-200",
  },
  slate: {
    accent: "from-slate-700 via-slate-500 to-slate-300",
    icon: "bg-slate-100 text-slate-600 ring-slate-200",
    value: "text-slate-900",
    glow: "bg-slate-400/10",
    number: "text-slate-200",
  },
};

function KpiCard({
  label,
  value,
  sub,
  tone = "slate",
  featured = false,
  index,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: KpiTone;
  featured?: boolean;
  index?: string;
}) {
  const colors = KPI_TONES[tone];
  return (
    <div
      className={`group relative overflow-hidden border border-slate-200/75 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-[0_18px_42px_-24px_rgba(15,23,42,0.35)] ${
        featured
          ? "min-h-[190px] rounded-[24px] p-5 shadow-[0_12px_36px_-24px_rgba(15,23,42,0.38)] xl:p-6"
          : "min-h-[142px] rounded-[20px] p-4 shadow-[0_8px_28px_-24px_rgba(15,23,42,0.32)]"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute -right-12 -top-16 h-36 w-36 rounded-full blur-3xl ${colors.glow}`}
      />
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${colors.accent}`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="relative min-w-0">
          <p className="mb-3 text-[11px] font-bold leading-relaxed tracking-[0.01em] text-slate-500">
            {label}
          </p>
          <p
            className={`font-black leading-none tracking-[-0.045em] tabular-nums ${colors.value} ${
              featured
                ? "text-[clamp(1.7rem,2.25vw,2.35rem)]"
                : "text-[1.65rem]"
            }`}
          >
            {value}
          </p>
        </div>
        {index ? (
          <span
            aria-hidden="true"
            className={`text-sm font-black tracking-[0.08em] ${colors.number}`}
          >
            {index}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${colors.icon}`}
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
        )}
      </div>
      {sub && (
        <p
          className={`relative mt-4 border-t border-slate-100 pt-3 text-[11px] font-medium leading-relaxed ${
            featured ? "text-slate-500" : "text-slate-400"
          }`}
        >
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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
          <span className="h-px w-5 bg-indigo-500" aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 className="text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-[22px]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
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
      className={`rounded-[24px] border border-slate-200/75 bg-white shadow-[0_16px_44px_-32px_rgba(15,23,42,0.38)] ${className}`}
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
    <div className="grid grid-cols-[6.25rem_minmax(0,1fr)_3.25rem] items-center gap-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_4rem] sm:gap-3">
      <span className="truncate text-right text-[11px] font-bold text-slate-600 sm:text-xs" title={label}>
        {label}
      </span>
      <div className="relative h-9 overflow-hidden rounded-xl bg-slate-100/90 ring-1 ring-inset ring-slate-200/50">
        <div
          className="h-full rounded-xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-500 transition-all duration-500"
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-end px-3 text-xs font-black tabular-nums text-slate-800">
          {count.toLocaleString()}
        </span>
      </div>
      <span className="text-right text-[11px] font-black tabular-nums text-slate-400 sm:text-xs">
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
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <span className="truncate text-right text-[11px] font-bold text-slate-600 sm:text-xs" title={label}>
        {label}
      </span>
      <div className="relative h-8 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-inset ring-slate-200/50">
        <div
          className={`h-full rounded-xl transition-all duration-500 ${color ?? "bg-violet-500/75"}`}
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-end px-3 text-xs font-black tabular-nums text-slate-800">
          {count.toLocaleString()}
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
              <span className="text-[10px] font-bold tabular-nums text-slate-500">
                {d.count || ""}
              </span>
              <div className="w-full relative" style={{ height: "100px" }}>
                <div
                  className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-500"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-400">
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
  // 比較期間の統計。見出しカードの比較チップ用。rangeKey は「このデータが
  // どの期間のものか」の照合用 (切替直後に古いデータへ新ラベルが付くのを防ぐ)。
  const [prevStats, setPrevStats] = useState<{
    stats: Stats;
    rangeKey: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState(() => toLocalDate(new Date()));
  const [customTo, setCustomTo] = useState(() => toLocalDate(new Date()));
  // 比較期間の選択: auto = 直前の同じ長さの期間 / custom = 日付指定 / none = 比較なし
  const [comparePreset, setComparePreset] = useState<"auto" | "custom" | "none">(
    "auto",
  );
  const [compareFrom, setCompareFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDate(d);
  });
  const [compareTo, setCompareTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toLocalDate(d);
  });

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
        const nextStats = (await res.json()) as Stats;
        setStats(nextStats);
        setLastUpdatedAt(new Date().toISOString());
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

  // 比較期間の統計を追加取得 (見出しカードの比較チップ用)。
  // 本体とは独立して取得し、失敗時はチップ非表示のみ (本体表示は影響なし)。
  useEffect(() => {
    if (!adminKey) return;
    const range = resolveCompareRange(
      preset,
      comparePreset,
      compareFrom,
      compareTo,
    );
    let cancelled = false;
    (async () => {
      if (!range) {
        if (!cancelled) setPrevStats(null);
        return;
      }
      try {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        const res = await fetch(`/api/admin/stats?${params.toString()}`, {
          headers: { "x-admin-key": adminKey },
        });
        if (!cancelled) {
          setPrevStats(
            res.ok
              ? {
                  stats: (await res.json()) as Stats,
                  rangeKey: `${range.from}|${range.to}`,
                }
              : null,
          );
        }
      } catch {
        if (!cancelled) setPrevStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminKey, preset, comparePreset, compareFrom, compareTo]);

  useEffect(() => {
    if (!stats) return;
    const sections = ADMIN_NAV_ITEMS.map((item) =>
      document.getElementById(item.id),
    ).filter((section): section is HTMLElement => section !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-18% 0px -64% 0px", threshold: [0, 0.15, 0.4] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [stats]);

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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090e1c] px-4 py-8 text-slate-900 sm:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-48 right-[-5%] h-[38rem] w-[38rem] rounded-full bg-violet-500/15 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>
        <div className="relative grid w-full max-w-[980px] overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.035] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.75)] backdrop-blur md:grid-cols-[1.08fr_0.92fr]">
          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] p-10 text-white md:flex lg:p-12">
            <div
              aria-hidden="true"
              className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-500/25 blur-3xl"
            />
            <div className="relative flex items-center gap-3.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-950/40 ring-1 ring-white/20">
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
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-indigo-300">Intelligence</p>
                <p className="mt-0.5 text-base font-black tracking-[-0.025em]">ワタシのトリセツ</p>
              </div>
            </div>

            <div className="relative my-16">
              <span className="mb-5 inline-flex rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-200">
                Private workspace
              </span>
              <h1 className="text-[38px] font-black leading-[1.14] tracking-[-0.055em]">
                数字から、次の一手を
                <br />
                もっと明確に。
              </h1>
              <p className="mt-5 max-w-sm text-sm font-medium leading-7 text-slate-400">
                診断・課金・友達回答・拡散をひとつのコホートで追跡する、運営専用の分析ワークスペースです。
              </p>
            </div>

            <p className="relative text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Secure analytics console
            </p>
          </div>

          <div className="bg-white p-7 sm:p-10 lg:p-12">
            <div className="mb-8 flex items-center gap-3 md:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
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
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-indigo-600">
                Intelligence
              </p>
              <p className="text-base font-black tracking-tight text-slate-950">ワタシのトリセツ</p>
            </div>
          </div>
          <form
            onSubmit={handleLogin}
            className="flex min-h-full flex-col justify-center"
          >
            <div className="mb-8">
              <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-slate-950 text-white shadow-lg shadow-slate-950/15">
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
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600">
                Welcome back
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">
                管理画面へログイン
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                管理パスワードを入力して、分析画面を開きます。
              </p>
            </div>
            <label
              htmlFor="admin-password"
              className="mb-2.5 block text-xs font-black text-slate-700"
            >
              管理パスワード
            </label>
            <input
              id="admin-password"
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="パスワードを入力"
              autoComplete="current-password"
              autoFocus
              className="mb-3 w-full rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
            {error && (
              <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !inputKey.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[14px] bg-slate-950 py-4 text-sm font-black text-white shadow-xl shadow-slate-950/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "確認中..." : "ログイン"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
            <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
              Authorized personnel only
            </p>
          </form>
          </div>
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
  const takoFunnelMax = Math.max(
    1,
    ...(stats.takoFunnel ?? []).map((f) => f.count),
  );
  const paywallFunnelMax = Math.max(
    ...(stats.paywallFunnel ?? []).map((f) => f.count),
    1,
  );
  const fc = stats.friendCountDistribution;
  const typeMax = Math.max(...stats.typeDistribution.map((t) => t.count), 1);
  const coreReady = stats.coreKpis.dataQuality.ready;

  const downloadCsv = () => {
    const rows: string[][] = [];
    rows.push(["# 経営KPI（サーバー正本・コホート追跡）"]);
    rows.push(["集計準備状態", coreReady ? "ready" : "migration_required"]);
    rows.push(["指標", "値", "分子", "分母", "定義"]);
    rows.push([
      "自己診断完了人数",
      String(stats.coreKpis.cohort.diagnosisUsers),
      "",
      "",
      stats.coreKpis.cohort.definition,
    ]);
    rows.push([
      "前期間の自己診断完了人数",
      stats.coreKpis.diagnosisTrend.previous === null
        ? ""
        : String(stats.coreKpis.diagnosisTrend.previous),
      "",
      "",
      "選択期間と同じ長さの直前期間",
    ]);
    rows.push([
      "自己診断完了→課金率",
      pct(stats.coreKpis.diagnosisToPaid.rate),
      String(stats.coreKpis.diagnosisToPaid.numerator),
      String(stats.coreKpis.diagnosisToPaid.denominator),
      "選択期間の自己診断完了者のうち、その後に実決済した人",
    ]);
    rows.push([
      "自己診断完了→友達診断1人完了率",
      pct(stats.coreKpis.diagnosisToFriend.rate),
      String(stats.coreKpis.diagnosisToFriend.numerator),
      String(stats.coreKpis.diagnosisToFriend.denominator),
      "選択期間の自己診断完了者のうち、その後に友達回答が1件以上届いた人",
    ]);
    rows.push([
      "課金→友達診断1人完了率",
      pct(stats.coreKpis.paidToFriend.rate),
      String(stats.coreKpis.paidToFriend.numerator),
      String(stats.coreKpis.paidToFriend.denominator),
      "選択期間の初回課金者のうち、課金後に友達回答が1件以上届いた人",
    ]);
    stats.coreKpis.arpu.currencies.forEach((currency) =>
      rows.push([
        `ARPU (${currency.currency.toUpperCase()})`,
        String(currency.arpuMinor),
        String(currency.netRevenueMinor),
        String(stats.coreKpis.arpu.denominator),
        stats.coreKpis.arpu.basis,
      ]),
    );
    rows.push([
      "拡散係数",
      stats.coreKpis.viralCoefficient.value.toFixed(3),
      String(stats.coreKpis.viralCoefficient.children),
      String(stats.coreKpis.viralCoefficient.denominator),
      "招待経由の新規診断完了者÷選択期間の自己診断完了者",
    ]);
    rows.push([]);
    rows.push(["# 自己診断完了の日別推移（確定ユーザー・JST）"]);
    rows.push(["日付", "人数"]);
    stats.coreKpis.diagnosisTrend.points.forEach((point) =>
      rows.push([point.date, String(point.count)]),
    );
    rows.push([]);
    rows.push(["# イベント参考値（すべてユニークセッション単位）"]);
    rows.push(["指標", "値", "計算式"]);
    rows.push(["診断開始イベント", String(stats.diagnosisStarted), ""]);
    rows.push(["診断完了イベント", String(stats.diagnosisCompleted), ""]);
    rows.push(["イベント完了率", pct(stats.completionRate), "診断完了イベント÷診断開始イベント"]);
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
    rows.push(["# 友達診断ファネル（計測開始後の参考コホート）"]);
    rows.push(["ステップ", "人数", "前段比", "計測対象比"]);
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
    rows.push(["# 課金ファネル (自己診断・完全版 ¥499)"]);
    rows.push(["ステップ", "件数"]);
    (stats.paywallFunnel ?? []).forEach((s) =>
      rows.push([s.label, String(s.count)]),
    );
    rows.push([]);
    rows.push(["# 課金ファネル (友達診断・全解放 ¥799)"]);
    rows.push(["ステップ", "件数"]);
    (stats.takoFunnel ?? []).forEach((s) =>
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
      [...stats.paywallAttribution, ...(stats.takoAttribution ?? [])].forEach(
        (s) =>
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
    PRESETS.find((item) => item.key === preset)?.label ?? "今日";
  const headlines = computeHeadlines(stats);
  const hasTrustedCoreDiagnosis = headlines.hasTrustedCoreDiagnosis;
  const headlineDiagnosisUsers = headlines.diagnosisUsers;
  const headlineFriendNumerator = headlines.friendNumerator;
  const headlineFriendDenominator = headlines.friendDenominator;
  const headlineFriendRate = headlines.friendRate;
  const periodRevenuePurchases = headlines.purchases;
  const headlineRevenue = headlines.revenueLabel;

  // ===== 前期間比較チップ (auto=直前の同期間 / custom=日付指定 / none=なし) =====
  const prevRangeInfo = resolveCompareRange(
    preset,
    comparePreset,
    compareFrom,
    compareTo,
  );
  const prevHeadlines =
    prevRangeInfo &&
    prevStats &&
    prevStats.rangeKey === `${prevRangeInfo.from}|${prevRangeInfo.to}`
      ? computeHeadlines(prevStats.stats)
      : null;
  const diagCompare = prevHeadlines
    ? (() => {
        const diff = headlineDiagnosisUsers - prevHeadlines.diagnosisUsers;
        return {
          label: `${prevRangeInfo!.label} ${prevHeadlines.diagnosisUsers.toLocaleString()}人 (${diff > 0 ? "+" : ""}${diff.toLocaleString()})`,
          trend: trendOf(diff),
        };
      })()
    : null;
  const revenueCompare = prevHeadlines
    ? (() => {
        // 通貨が単一かつ同一のときだけ金額差を出す (混在時は前期間の額のみ表示)。
        const cur = headlines.currencies;
        const prevCur = prevHeadlines.currencies;
        const comparable =
          cur.length <= 1 &&
          prevCur.length <= 1 &&
          (cur.length === 0 ||
            prevCur.length === 0 ||
            cur[0].currency === prevCur[0].currency);
        if (comparable) {
          const currency =
            cur[0]?.currency ?? prevCur[0]?.currency ?? "jpy";
          const nowMinor = cur[0]?.netRevenueMinor ?? 0;
          const prevMinor = prevCur[0]?.netRevenueMinor ?? 0;
          const diff = nowMinor - prevMinor;
          return {
            label: `${prevRangeInfo!.label} ${formatMoney(prevMinor, currency)} (${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${formatMoney(Math.abs(diff), currency)})`,
            trend: trendOf(diff),
          };
        }
        return {
          label: `${prevRangeInfo!.label} ${prevHeadlines.revenueLabel}`,
          trend: "flat" as MetricTrend,
        };
      })()
    : null;
  const friendRateCompare = prevHeadlines
    ? (() => {
        if (prevHeadlines.friendDenominator === 0) {
          return {
            label: `${prevRangeInfo!.label} —`,
            trend: "flat" as MetricTrend,
          };
        }
        const diffPt =
          (headlineFriendRate - prevHeadlines.friendRate) * 100;
        return {
          label: `${prevRangeInfo!.label} ${pct(prevHeadlines.friendRate)} (${diffPt > 0 ? "+" : ""}${diffPt.toFixed(1)}pt)`,
          trend: trendOf(diffPt),
        };
      })()
    : null;

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#f5f7fb] text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(99,102,241,0.08),transparent_24%),radial-gradient(circle_at_18%_88%,rgba(14,165,233,0.05),transparent_28%)]"
      />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col overflow-hidden bg-[#0b1020] text-white shadow-[20px_0_60px_-42px_rgba(15,23,42,0.8)] lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <div className="relative flex h-[84px] items-center gap-3.5 border-b border-white/[0.07] px-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/50 ring-1 ring-white/20">
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
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-indigo-300">
              Intelligence
            </p>
            <p className="mt-0.5 text-[15px] font-black tracking-[-0.025em]">
              ワタシのトリセツ
            </p>
          </div>
        </div>

        <nav className="relative flex-1 px-4 py-7" aria-label="管理画面メニュー">
          <p className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.22em] text-slate-600">
            Workspace
          </p>
          <div className="space-y-1.5">
          {ADMIN_NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setActiveSection(item.id)}
              className={`group relative flex items-center gap-3 rounded-[14px] px-3.5 py-3 text-[13px] font-bold transition ${
                activeSection === item.id
                  ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-200"
              }`}
              aria-current={activeSection === item.id ? "location" : undefined}
            >
              {activeSection === item.id && (
                <span className="absolute -left-1 h-6 w-1 rounded-full bg-indigo-400 shadow-[0_0_14px_rgba(129,140,248,0.8)]" />
              )}
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] transition ${
                  activeSection === item.id
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-white/[0.035] text-slate-500 group-hover:text-slate-300"
                }`}
              >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-[15px] w-[15px]"
                aria-hidden="true"
              >
                <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              </span>
              {item.label}
            </a>
          ))}
          </div>
        </nav>

        <div className="relative border-t border-white/[0.07] p-4">
          <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.04] px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    coreReady
                      ? "bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]"
                      : "bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.12)]"
                  }`}
                />
                <p className="text-[11px] font-bold text-slate-200">
                  {coreReady ? "データ基盤 正常" : "DB更新が必要"}
                </p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                Status
              </span>
            </div>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-slate-500">
              最終更新 {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "—"}
            </p>
          </div>
        </div>
      </aside>

      <div className="relative lg:pl-[280px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
          <div className="flex min-h-[72px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-10">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 lg:hidden">
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
                <h1 className="text-[15px] font-black tracking-[-0.025em] text-slate-950 sm:text-lg">
                  経営ダッシュボード
                </h1>
                <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
                  Diagnosis · Revenue · Virality
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-[10px] font-bold text-indigo-700 shadow-sm sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span className="hidden xl:inline">{selectedPeriodLabel}の</span>
                <span className="font-black tabular-nums text-slate-950">
                  診断完了 {headlineDiagnosisUsers.toLocaleString()}人
                </span>
              </span>
              <button
                onClick={downloadCsv}
                aria-label="CSVをエクスポート"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:px-3.5"
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
                <span className="hidden sm:inline">エクスポート</span>
              </button>
              <button
                onClick={() => fetchStats(adminKey, preset, customFrom, customTo)}
                disabled={loading}
                aria-label={loading ? "データを同期中" : "データを同期"}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white shadow-lg shadow-slate-950/15 transition hover:bg-indigo-700 disabled:opacity-50 sm:px-3.5"
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
                <span className="hidden sm:inline">{loading ? "同期中" : "データ同期"}</span>
              </button>
              <button
                onClick={handleLogout}
                className="hidden h-10 rounded-xl px-3 text-xs font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 xl:block"
              >
                ログアウト
              </button>
            </div>
          </div>
        </header>

        <nav
          className="sticky top-[72px] z-10 flex gap-1 overflow-x-auto border-b border-slate-200/70 bg-[#f5f7fb]/95 px-4 py-2 backdrop-blur lg:hidden"
          aria-label="セクションメニュー"
        >
          {ADMIN_NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setActiveSection(item.id)}
              aria-current={activeSection === item.id ? "location" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                activeSection === item.id
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-800"
              }`}
            >
              {item.shortLabel}
            </a>
          ))}
        </nav>

        <main className="relative mx-auto flex max-w-[1540px] flex-col gap-12 px-4 py-5 sm:px-6 sm:py-7 xl:px-10 xl:py-9">
          <section id="overview" className="scroll-mt-36 lg:scroll-mt-28">
            <div className="relative overflow-hidden rounded-[28px] bg-[#11182d] text-white shadow-[0_26px_70px_-38px_rgba(15,23,42,0.72)] ring-1 ring-white/10">
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-40 h-[30rem] w-[30rem] rounded-full bg-indigo-500/30 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
              />
              <svg
                aria-hidden="true"
                className="absolute right-0 top-0 h-full w-1/2 opacity-[0.08]"
                viewBox="0 0 400 300"
                fill="none"
              >
                <path d="M20 255C92 219 106 242 160 180s82-34 124-94 72-54 110-64" stroke="white" strokeWidth="2" />
                <path d="M20 276c76-34 98-14 148-58s81-31 125-76 68-50 102-55" stroke="white" strokeWidth="1" />
                <circle cx="160" cy="180" r="5" fill="white" />
                <circle cx="284" cy="86" r="5" fill="white" />
              </svg>

              <div className="relative p-6 sm:p-8 xl:p-10">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-indigo-300/20 bg-indigo-300/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-indigo-200">
                        Executive pulse
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[9px] font-black ${coreReady ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-amber-300/20 bg-amber-300/10 text-amber-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${coreReady ? "bg-emerald-300" : "bg-amber-300"}`} />
                        {coreReady ? "確定データ" : "イベント値で補完中"}
                      </span>
                    </div>
                    <h2 className="text-[clamp(1.7rem,3vw,2.65rem)] font-black leading-tight tracking-[-0.055em] text-white">
                      {selectedPeriodLabel}の重要指標
                    </h2>
                    <p className="mt-2 text-xs font-medium leading-6 text-slate-400 sm:text-sm">
                      診断・売上・友達診断への転換を、最初に確認できます。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,0.7)]" />
                    最終同期 {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                </div>

                <div className="mt-7 grid gap-4 lg:grid-cols-3">
                  <ExecutiveMetricCard
                    index="01"
                    label="診断人数"
                    value={headlineDiagnosisUsers.toLocaleString()}
                    unit="人"
                    badge={`${selectedPeriodLabel}の最重要数値`}
                    detail={hasTrustedCoreDiagnosis ? "診断完了済みのユニークユーザー" : "診断完了イベントのユニークセッション"}
                    tone="indigo"
                    compare={diagCompare}
                  />
                  <ExecutiveMetricCard
                    index="02"
                    label="課金額"
                    value={headlineRevenue}
                    badge={`${selectedPeriodLabel}の純売上`}
                    detail={`全商品の決済 ${periodRevenuePurchases.toLocaleString()}件・返金控除後 (完全版+友達診断ほか)`}
                    tone="emerald"
                    compactValue
                    compare={revenueCompare}
                  />
                  <ExecutiveMetricCard
                    index="03"
                    label="診断した人のうち友達診断1人完了"
                    value={pctOrDash(
                      headlineFriendRate,
                      headlineFriendDenominator,
                    )}
                    badge={`${selectedPeriodLabel}の友達診断率`}
                    detail={`${headlineFriendNumerator.toLocaleString()}人 / ${headlineFriendDenominator.toLocaleString()}人`}
                    tone="cyan"
                    compare={friendRateCompare}
                  />
                </div>
              </div>

              <div className="relative flex flex-col gap-3 border-t border-white/[0.08] bg-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 xl:px-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Analysis window</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-400">期間変更ですべての指標を再集計</p>
                </div>
                <div className="flex min-w-0 max-w-full overflow-x-auto rounded-xl border border-white/10 bg-white/[0.06] p-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPreset(p.key)}
                      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-[11px] font-black transition sm:px-4 ${
                        preset === p.key
                          ? "bg-white text-slate-950 shadow-lg"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                {preset === "custom" && (
                  <div className="flex items-center gap-2 sm:ml-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none focus:border-indigo-400"
                    />
                    <span className="text-xs text-slate-500">〜</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 比較期間の選択 (見出しカードの ▲▼ チップの比較先) */}
            <div className="relative flex flex-col gap-3 border-t border-white/[0.08] bg-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 xl:px-10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Compare with
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  重要指標カードの比較先の期間
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-white/10 bg-white/[0.06] p-1">
                  {(
                    [
                      { key: "auto", label: "直前の同期間" },
                      { key: "custom", label: "期間指定" },
                      { key: "none", label: "比較なし" },
                    ] as const
                  ).map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setComparePreset(c.key)}
                      className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-[11px] font-black transition ${
                        comparePreset === c.key
                          ? "bg-white text-slate-950 shadow-lg"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {comparePreset === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={compareFrom}
                      onChange={(e) => setCompareFrom(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none focus:border-indigo-400"
                    />
                    <span className="text-xs text-slate-500">〜</span>
                    <input
                      type="date"
                      value={compareTo}
                      onChange={(e) => setCompareTo(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-medium text-white outline-none focus:border-indigo-400"
                    />
                  </div>
                )}
                {comparePreset === "auto" && !prevRangeInfo && (
                  <span className="text-[11px] font-medium text-slate-500">
                    全期間・カスタムでは自動比較できません (期間指定を使ってください)
                  </span>
                )}
              </div>
            </div>
            </div>
          </section>

          <section id="revenue" className="scroll-mt-36 lg:scroll-mt-28">
            <SectionHeader
              eyebrow="Revenue"
              title="課金分析"
              description="フルアクセスの閲覧から決済完了までと、コホート純売上を追跡"
              side={
                <div className="flex items-center gap-4 rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-[0_10px_30px_-24px_rgba(217,119,6,0.7)]">
                  <div>
                    <p className="text-[10px] font-bold text-amber-700">コホート純売上</p>
                    <p className="text-lg font-black tabular-nums text-amber-900">
                      {coreReady
                        ? formatNetRevenue(stats.coreKpis.arpu.currencies)
                        : "要DB更新"}
                    </p>
                  </div>
                </div>
              }
            />
            <Panel className="p-5 sm:p-6">
            {/* ===== ① 自己診断・完全版 (¥499 / full_access) ===== */}
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-black text-white">
                自己診断・完全版 ¥499
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                /me 結果ページの課金ファネル
              </span>
            </div>
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
            {(stats.paywallAttribution ?? []).length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-1 text-sm font-black text-slate-900">
                  導線別の決済結果（最後に押したカード別）
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  どのロックカードから ¥499 の購入へ進んだかを、Stripe到達・決済完了まで追跡します。
                </p>
                <AttributionTable rows={stats.paywallAttribution} />
                <p className="mt-3 text-[11px] text-slate-400">
                  購入率は「決済完了 ÷ 誘導クリック」。計測更新前の決済は「不明」に含まれます。
                </p>
              </div>
            )}

            {/* ===== ② 友達診断・全解放 (¥799 / tako_unlock) ===== */}
            <div className="mt-10 border-t-2 border-slate-100 pt-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-black text-white">
                  友達診断・全解放 ¥799
                </span>
                <span className="text-[11px] font-medium text-slate-400">
                  /tako ページの課金ファネル (全解放オーナーは¥300)
                </span>
              </div>
              <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.08em] text-slate-400">
                <span className="w-28 text-right">ステップ</span>
                <span className="flex-1">件数</span>
                <span className="w-16 text-right">前段比</span>
              </div>
              <div className="flex flex-col gap-2">
                {(stats.takoFunnel ?? []).map((step, i) => (
                  <FunnelBar
                    key={step.label}
                    label={step.label}
                    count={step.count}
                    max={takoFunnelMax}
                    prevCount={
                      i > 0 ? stats.takoFunnel[i - 1].count : undefined
                    }
                  />
                ))}
              </div>
              <p className="mt-4 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">
                決済完了は payment_history (tako_unlock) の実決済数。購入CTA・Stripe到達は
                2026-07-22 に計測追加のため、それ以前の期間は 0 になります。
              </p>
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-1 text-sm font-black text-slate-900">
                  導線別の決済結果 (¥799・最後に押したカード別)
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  /tako 内のロックカード・購入カードごとのクリックとStripe到達・決済完了。
                  カード別の計測は 2026-07-22 開始のため、それ以前の決済は「不明」になります。
                </p>
                {(stats.takoAttribution ?? []).length > 0 ? (
                  <AttributionTable rows={stats.takoAttribution} />
                ) : (
                  <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-xs font-medium text-slate-400">
                    選択期間に ¥799 導線のクリック・決済はまだありません。
                    期間を「全期間」にすると過去分が表示されます。
                  </div>
                )}
              </div>
            </div>

            {/* 商品別の売上内訳 (選択期間・全 payment_kind) */}
            {(stats.revenueByKind ?? []).length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-1 text-sm font-black text-slate-900">
                  商品別の売上内訳
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  完全版レポート以外 (友達診断の全解放など) を含む、選択期間の全決済です。
                </p>
                <div className="overflow-x-auto rounded-[18px] border border-slate-200/80">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="bg-slate-50/90 text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">商品</th>
                        <th className="px-3 py-2.5 text-right font-medium">決済件数</th>
                        <th className="px-3 py-2.5 text-right font-medium">総売上</th>
                        <th className="px-3 py-2.5 text-right font-medium">返金</th>
                        <th className="px-3 py-2.5 text-right font-medium">純売上</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {(() => {
                        const maxNet = Math.max(
                          1,
                          ...stats.revenueByKind.map((r) => r.netRevenueMinor),
                        );
                        return stats.revenueByKind.map((row) => (
                        <tr
                          key={`${row.kind}-${row.currency}`}
                          className="transition hover:bg-indigo-50/35"
                        >
                          <td className="px-3 py-3" title={row.kind}>
                            <p className="font-semibold text-slate-700">
                              {PAYMENT_KIND_LABELS[row.kind] ?? row.kind}
                              {row.currency !== "jpy" && (
                                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                                  {row.currency}
                                </span>
                              )}
                            </p>
                            {/* 純売上のミニバー (最大商品=100%) */}
                            <span className="mt-1.5 block h-1.5 w-full max-w-[260px] overflow-hidden rounded-full bg-slate-100">
                              <span
                                className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                                style={{
                                  width: `${Math.max(
                                    row.netRevenueMinor > 0 ? 2 : 0,
                                    (row.netRevenueMinor / maxNet) * 100,
                                  )}%`,
                                }}
                              />
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {row.purchases.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-slate-600">
                            {formatMoney(row.grossRevenueMinor, row.currency)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-rose-500">
                            {row.refundedMinor > 0
                              ? `−${formatMoney(row.refundedMinor, row.currency)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-black tabular-nums text-slate-900">
                            {formatMoney(row.netRevenueMinor, row.currency)}
                          </td>
                        </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 日別の売上推移 (選択期間・全商品・JST) */}
            {(stats.revenueDaily ?? []).length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="mb-1 text-sm font-black text-slate-900">
                  日別の売上推移
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-slate-400">
                  選択期間の決済を日付 (JST) ごとに集計。新しい日が上・最大62日分です。
                </p>
                <div className="max-h-[420px] overflow-auto rounded-[18px] border border-slate-200/80">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="sticky top-0 bg-slate-50/95 text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">日付</th>
                        <th className="px-3 py-2.5 text-right font-medium">決済件数</th>
                        <th className="px-3 py-2.5 text-right font-medium">純売上</th>
                        <th className="px-3 py-2.5 text-right font-medium">返金</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {(() => {
                        const dayNetTotal = (d: (typeof stats.revenueDaily)[number]) =>
                          d.currencies.reduce((sum, c) => sum + c.netRevenueMinor, 0);
                        const maxDayNet = Math.max(
                          1,
                          ...stats.revenueDaily.map(dayNetTotal),
                        );
                        return stats.revenueDaily.map((day) => {
                        const refundedTotal = day.currencies.reduce(
                          (sum, c) => sum + c.refundedMinor,
                          0,
                        );
                        return (
                          <tr key={day.date} className="transition hover:bg-indigo-50/35">
                            <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-700">
                              {day.date}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                              {day.purchases.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-black tabular-nums text-slate-900">
                                {day.currencies
                                  .map((c) =>
                                    formatMoney(c.netRevenueMinor, c.currency),
                                  )
                                  .join(" / ")}
                              </span>
                              {/* その日の純売上ミニバー (最大日=100%) */}
                              <span className="ml-auto mt-1 block h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-slate-100">
                                <span
                                  className="ml-auto block h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
                                  style={{
                                    width: `${Math.max(
                                      dayNetTotal(day) > 0 ? 2 : 0,
                                      (dayNetTotal(day) / maxDayNet) * 100,
                                    )}%`,
                                  }}
                                />
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-rose-500">
                              {refundedTotal > 0
                                ? day.currencies
                                    .filter((c) => c.refundedMinor > 0)
                                    .map(
                                      (c) =>
                                        `−${formatMoney(c.refundedMinor, c.currency)}`,
                                    )
                                    .join(" / ")
                                : "—"}
                            </td>
                          </tr>
                        );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </Panel>
        </section>

          <section>
            <SectionHeader
              eyebrow="Core KPI"
              title="経営KPI"
              description={`自己診断完了 ${stats.coreKpis.cohort.diagnosisUsers.toLocaleString()}人を共通の分母に、その後の行動を追跡`}
              side={
                loading ? (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                    更新中
                  </span>
                ) : undefined
              }
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="自己診断→課金率"
                value={
                  coreReady
                    ? pctOrDash(
                        stats.coreKpis.diagnosisToPaid.rate,
                        stats.coreKpis.diagnosisToPaid.denominator,
                      )
                    : "要DB更新"
                }
                sub={`${stats.coreKpis.diagnosisToPaid.numerator.toLocaleString()} / ${stats.coreKpis.diagnosisToPaid.denominator.toLocaleString()}人`}
                tone="indigo"
                index="01"
                featured
              />
              <KpiCard
                label="自己診断→友達1人完了率"
                value={
                  coreReady
                    ? pctOrDash(
                        stats.coreKpis.diagnosisToFriend.rate,
                        stats.coreKpis.diagnosisToFriend.denominator,
                      )
                    : "要DB更新"
                }
                sub={`${stats.coreKpis.diagnosisToFriend.numerator.toLocaleString()} / ${stats.coreKpis.diagnosisToFriend.denominator.toLocaleString()}人`}
                tone="emerald"
                index="02"
                featured
              />
              <KpiCard
                label="課金→友達1人完了率"
                value={
                  coreReady
                    ? pctOrDash(
                        stats.coreKpis.paidToFriend.rate,
                        stats.coreKpis.paidToFriend.denominator,
                      )
                    : "要DB更新"
                }
                sub={`${stats.coreKpis.paidToFriend.numerator.toLocaleString()} / ${stats.coreKpis.paidToFriend.denominator.toLocaleString()}人`}
                tone="amber"
                index="03"
                featured
              />
              <KpiCard
                label="ARPU"
                value={
                  coreReady
                    ? formatArpu(stats.coreKpis.arpu.currencies)
                    : "要DB更新"
                }
                sub={`純売上 ÷ 自己診断完了 ${stats.coreKpis.arpu.denominator.toLocaleString()}人`}
                tone="rose"
                index="04"
                featured
              />
              <KpiCard
                label="拡散係数"
                value={
                  !coreReady
                    ? "要DB更新"
                    : stats.coreKpis.viralCoefficient.denominator > 0
                    ? stats.coreKpis.viralCoefficient.value.toFixed(3)
                    : "—"
                }
                sub={`子診断 ${stats.coreKpis.viralCoefficient.children.toLocaleString()} ÷ 親 ${stats.coreKpis.viralCoefficient.denominator.toLocaleString()}人`}
                tone="indigo"
                index="05"
                featured
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <KpiCard label="自己診断完了人数" value={stats.coreKpis.cohort.diagnosisUsers.toLocaleString()} sub={`${selectedPeriodLabel}の確定コホート`} tone="indigo" />
              <KpiCard label="実決済紐付け率" value={coreReady ? pctOrDash(stats.coreKpis.dataQuality.paymentUserMatchRate, stats.coreKpis.dataQuality.matchedPayments + stats.coreKpis.dataQuality.unmatchedPayments) : "要DB更新"} sub={`${stats.coreKpis.dataQuality.matchedPayments}件をユーザーに紐付け`} tone="emerald" />
              <KpiCard label="友達共有" value={stats.shareCount} sub={`共有率 ${pct(stats.shareRate)}`} tone="indigo" />
              <KpiCard label="友達回答完了" value={stats.friendAnswerCompleted} sub={`完了率 ${pct(stats.answerCompletionRate)}`} tone="emerald" />
              <KpiCard label="3人達成" value={stats.threeAchieved} sub="第二部の解放" tone="amber" />
              <KpiCard label="5人達成" value={stats.fiveAchieved} sub="見られ方の完成" tone="rose" />
              <KpiCard label="結果再訪" value={stats.resultRevisited} sub={`再訪率 ${pct(stats.revisitRate)}`} />
              <KpiCard label="イベント完了率" value={pct(stats.completionRate)} sub="セッションイベント参考値" />
              <KpiCard label="課金ユーザー" value={stats.paidUsers} sub="権限テーブル参考値" />
              <KpiCard label="決済完了" value={stats.purchaseCompleted} sub="決済イベント参考値" />
            </div>
            {coreReady ? (
              <p className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[11px] font-medium leading-relaxed text-indigo-700">
                {stats.coreKpis.cohort.definition}。ARPUは通貨別の実決済額から返金額を引いた純売上で計算し、異なる通貨を合算しません。
              </p>
            ) : (
              <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-rose-700">
                経営KPIはまだ集計できません。Supabaseへ 2026-07-20-core-kpi-facts.sql を適用してから再読み込みしてください。既存の参考指標は引き続き表示しています。
              </p>
            )}
          </section>

        {/* 本人コホートと友達側を分けた友達診断ファネル */}
          <section id="friend-funnel" className="scroll-mt-36 lg:scroll-mt-28">
            <SectionHeader
              eyebrow="Friend diagnosis"
              title="友達診断ファネル"
              description="友達導線の計測開始後に取得できたセッションだけを追う、改善用の参考ファネル"
              side={
                <div className="rounded-2xl border border-rose-100 bg-white px-4 py-3 shadow-[0_10px_30px_-24px_rgba(225,29,72,0.7)]">
                  <p className="text-[10px] font-bold text-rose-600">計測対象→友達診断到達</p>
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
                label="計測対象→到達率"
                value={pct(stats.friendDiagnosisFunnel.attention.takoReachRate)}
                sub="友達導線の計測対象を分母"
                tone="emerald"
              />
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel className="p-5 sm:p-6">
                <h3 className="text-sm font-black text-slate-800">本人側（ユニーク本人）</h3>
                <p className="mt-1 text-[11px] text-slate-400">
                  計測開始後に自己診断完了イベントを送信した本人を追跡
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
          <section id="funnel" className="scroll-mt-36 lg:scroll-mt-28">
            <SectionHeader
              eyebrow="Conversion"
              title="全体ファネル（参考）"
              description="イベントのユニークセッション数で、診断開始から友達回答までの離脱を確認"
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
        {/* Campaign Stats */}
        {stats.campaignStats.length > 0 && (
          <section>
            <SectionHeader
              eyebrow="Acquisition"
              title="キャンペーン別"
              description="流入施策ごとの診断完了と友達回答（全期間）"
            />
            <Panel className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-slate-50/90">
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">campaign</th>
                    <th className="px-4 py-3 font-medium text-right">診断完了</th>
                    <th className="px-4 py-3 font-medium text-right">友達回答</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.campaignStats.map((c) => (
                    <tr key={c.campaign} className="border-b border-slate-100/70 transition last:border-0 hover:bg-indigo-50/35">
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
          <section id="growth" className="scroll-mt-36 lg:scroll-mt-28">
            <SectionHeader
              eyebrow="Growth"
              title="拡散分析"
              description="友達への共有から新しい診断が生まれる力を確認"
              side={
                <div className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 shadow-[0_10px_30px_-24px_rgba(79,70,229,0.7)]">
                  <p className="text-[10px] font-bold text-indigo-600">実測拡散係数</p>
                  <p className="text-lg font-black tabular-nums text-indigo-900">
                    {!coreReady
                      ? "要DB更新"
                      : stats.coreKpis.viralCoefficient.denominator > 0
                      ? stats.coreKpis.viralCoefficient.value.toFixed(3)
                      : "—"}
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
              value={
                !coreReady
                  ? "要DB更新"
                  : stats.coreKpis.viralCoefficient.denominator > 0
                  ? stats.coreKpis.viralCoefficient.value.toFixed(3)
                  : "—"
              }
              sub="コホート由来の子診断÷親コホート"
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
          <section id="audience" className="scroll-mt-36 lg:scroll-mt-28">
            <SectionHeader
              eyebrow="Audience"
              title="友達回答人数の分布"
              description="診断ユーザーが何人から回答を集められたか（全期間）"
            />
            <Panel className="p-5 sm:p-6">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-slate-800">{fc.zero}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">0人</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-slate-800">{fc.one}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">1人</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-slate-800">{fc.two}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">2人</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4 text-center">
                <p className="text-2xl font-black tabular-nums text-indigo-700">{fc.threePlus}</p>
                <p className="mt-1 text-[11px] font-bold text-indigo-500">3人以上</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 text-center">
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
          <section id="events" className="scroll-mt-36 lg:scroll-mt-28">
            <SectionHeader
              eyebrow="Activity"
              title="直近イベント"
              description="システムが受信した最新50件の計測イベント"
            />
            <Panel className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-slate-50/90">
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
                    className="border-b border-slate-100/70 transition last:border-0 hover:bg-indigo-50/35"
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
