"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  love_payoff_card: "恋愛・好かれる",
  love_failure_card: "恋愛・我慢",
  career_fit_card: "仕事・働き方",
  career_avoid_card: "旧 仕事・避ける",
  career_relations_card: "仕事・人間関係",
  career_talent_card: "旧 仕事・才能",
  deepdive_card: "旧 深掘り",
  scene_caution_card: "シーン別",
  moshimo_card: "もしも",
  friend_dislike_card: "友達",
  urawaza_card: "旧 裏技",
  relations_card: "本音",
  deepdive_panel: "旧 深掘り",
  deepdive_tab_career: "旧 仕事タブ",
  deepdive_tab_growth: "旧 成長タブ",
  deepdive_tab_aisho: "旧 相性タブ",
  sticky_bar: "追従バー",
  friend_list: "友達一覧",
  friend_individual_paywall: "友達個別",
  aisho_scene: "相性ページ",
  nav_aisho_locked: "下部ナビ・相性",
  tako_lock: "旧 /tako",
  tako_mote_card: "旧 モテ理由",
  tako_hints_card: "旧 好かれるヒント",
  tako_numa_card: "沼る人",
  tako_loss_card: "損してるポイント",
  tako_kotsu_card: "深めるヒント",
  tako_wana_card: "壊すワナ",
  tako_johari_card: "ジョハリの窓",
  tako_kirai_card: "嫌われてない？",
  tako_kotsu_wana_card: "深めるヒント/ワナ",
  tako_sheet_lock: "友達シート全ロック",
  tako_unlocked: "/tako 解放後",
  tako_promo_card: "/tako 購入",
  paywall_direct: "直接購入",
  unknown: "不明",
};

// payment_history.payment_kind → 日本語ラベル (商品別の売上内訳)。
const PAYMENT_KIND_LABELS: Record<string, string> = {
  self_report: "自己診断＋自己分析PDF ¥199",
  full_access: "完全版 ¥499",
  premium_bundle: "プレミアム ¥899",
  // unmei 系はセールで価格が変動するためラベルに金額を含めない (売上は実額で集計)
  unmei: "運命の設計図",
  unmei_upgrade: "運命アップグレード",
  tako_unlock: "旧 友達診断 ¥799",
  perception_unlock: "友達個別",
  integrated_trisetsu: "旧 統合トリセツ",
  unknown: "不明",
};

const COURSE_PAYWALL_LABELS: Record<
  "self_report" | "full_access" | "premium_bundle",
  string
> = {
  self_report: "お試し ¥199",
  full_access: "完全版 ¥499",
  premium_bundle: "プレミアム ¥899",
};

type Stats = {
  coreKpis: {
    cohort: {
      from: string | null;
      to: string | null;
      diagnosisUsers: number;
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
      // 通貨をまたいだユニーク購入者数 (通貨バケット別 payers の合算は同一ユーザーを
      // 二重計上するため、サーバ側で dedup した値を使う)。旧キャッシュ互換で optional。
      uniquePayers?: number;
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
  };
  paywallFunnel: { label: string; count: number }[];
  coursePaywall: {
    version: string;
    cardViewers: number;
    planViewers: number;
    ctaClickers: number;
    stripeReached: number;
    purchasers: number;
    transactions: number;
    newPurchases: number;
    upgrades: number;
    revenueJpy: number;
    revenuePerViewerJpy: number;
    purchaseRate: number;
    plans: {
      product: "self_report" | "full_access" | "premium_bundle";
      viewers: number;
      ctaClickers: number;
      stripeReached: number;
      purchasers: number;
      transactions: number;
      newPurchases: number;
      upgrades: number;
      revenueJpy: number;
      ctaRate: number;
      stripeRate: number;
      checkoutCompletionRate: number;
      purchaseRate: number;
    }[];
  };
  unmei: {
    funnel: { label: string; count: number }[];
    purchases: {
      total: number;
      basic: number;
      upgrade: number;
    };
    revenue: {
      currencies: {
        currency: string;
        purchases: number;
        netRevenueMinor: number;
      }[];
    };
    birthForm: {
      viewed: number;
      submitted: number;
      skipped: number;
      submitRate: number;
    };
    navBadge: {
      shown: number;
      clicked: number;
      clickRate: number;
    };
  };
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
  purchaseConversionRate: number;
  friendToDiagClicked: number;
  friendToDiagRate: number;
  typeDistribution: { typeId: string; name?: string; count: number }[];
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
  acquisitionStats: {
    directLabel: string;
    sources: { source: string; users: number; share: number }[];
    campaigns: { source: string; campaign: string; users: number }[];
  };
  generationDistribution: { generation: number; count: number }[];
  unknownGeneration: number;
  viral: {
    friendLandingViewed: number;
    avgLandingPerSharer: number;
    landingToStartRate: number;
    startToCompleteRate: number;
    friendToDiagClickedRate: number;
    childDiagCompleted: number;
    avgChildPerParent: number;
    viralCoefficient: number;
  };
};

type Preset = "today" | "yesterday" | "7d" | "30d" | "all" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "7d", label: "過去7日" },
  { key: "30d", label: "過去30日" },
  { key: "all", label: "全期間" },
  { key: "custom", label: "日付指定" },
];

const ADMIN_NAV_ITEMS = [
  {
    href: "#overview",
    id: "overview",
    label: "サマリー",
    group: "メイン",
    path: "M4 13h5V4H4v9Zm0 7h5v-4H4v4Zm8 0h8v-9h-8v9Zm0-16v4h8V4h-8Z",
  },
  {
    href: "#revenue",
    id: "revenue",
    label: "売上・購入",
    group: "ビジネス",
    path: "M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H7",
  },
  {
    href: "#friend-funnel",
    id: "friend-funnel",
    label: "友達・拡散",
    group: "成長",
    path: "M4 5h16l-6 7v5l-4 2v-7L4 5Z",
  },
  {
    href: "#unmei",
    id: "unmei",
    label: "運命の設計図",
    group: "商品",
    path: "M12 3.5 19.36 16.25H4.64L12 3.5Zm0 0v17m7.36-4.75L4.64 16.25M5 6l2 2m12-2-2 2",
  },
  {
    href: "#acquisition",
    id: "acquisition",
    label: "流入・集客",
    group: "成長",
    path: "M4 12h12m-5-5 5 5-5 5m8-10v10",
  },
] as const;

const ADMIN_NAV_GROUPS = ["メイン", "ビジネス", "商品", "成長"] as const;

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
  } else if (preset === "yesterday") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (preset === "7d") {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatPeriodSummary(
  preset: Preset,
  customFrom: string,
  customTo: string,
): string {
  if (preset === "all") return "初回計測から現在まで";

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(date);

  if (preset === "custom") {
    if (!customFrom || !customTo) return "日付を選択してください";
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return "日付を選択してください";
    }
    return customFrom === customTo
      ? formatDate(from)
      : `${formatDate(from)} 〜 ${formatDate(to)}`;
  }

  const range = getPresetRange(preset);
  if (!range) return "—";
  const from = new Date(range.from);
  const to = new Date(range.to);
  return toLocalDate(from) === toLocalDate(to)
    ? formatDate(from)
    : `${formatDate(from)} 〜 ${formatDate(to)}`;
}

// 前期間比較のレンジ: 今日→昨日 / 昨日→一昨日 /
// 7日→前の7日 / 30日→前の30日。
// all/custom は比較なし (基準となる「直前の同じ長さ」が定義できないため)。
function getPrevPresetRange(
  preset: Preset,
): { from: string; to: string; label: string } | null {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let days: number;
  let endOffsetDays: number;
  let label: string;
  if (preset === "today") {
    days = 1;
    endOffsetDays = 1;
    label = "昨日";
  } else if (preset === "yesterday") {
    days = 1;
    endOffsetDays = 2;
    label = "一昨日";
  } else if (preset === "7d") {
    days = 7;
    endOffsetDays = 7;
    label = "前の7日";
  } else if (preset === "30d") {
    days = 30;
    endOffsetDays = 30;
    label = "前の30日";
  } else {
    return null;
  }
  const from = new Date(base);
  from.setDate(from.getDate() - endOffsetDays - days + 1);
  const to = new Date(base);
  to.setDate(to.getDate() - endOffsetDays);
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
const nullablePct = (v: number | null) => (v === null ? "—" : pct(v));

function rateOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function countStep(
  funnel: { label: string; count: number }[],
  label: string,
  fallbackIndex: number,
) {
  return (
    funnel.find((step) => step.label === label)?.count ??
    funnel[fallbackIndex]?.count ??
    0
  );
}

const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw"]);

// Intl.NumberFormat は生成コストが高く、1レンダーで数十回呼ばれるためキャッシュする。
const MONEY_FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatMoney(minor: number, currency: string): string {
  const normalized = currency.toLowerCase();
  const amount = ZERO_DECIMAL_CURRENCIES.has(normalized)
    ? minor
    : minor / 100;
  const digits = Number.isInteger(amount) ? 0 : 1;
  try {
    const cacheKey = `${normalized}:${digits}`;
    let formatter = MONEY_FORMATTERS.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: normalized.toUpperCase(),
        maximumFractionDigits: digits,
      });
      MONEY_FORMATTERS.set(cacheKey, formatter);
    }
    return formatter.format(amount);
  } catch {
    return `${normalized.toUpperCase()} ${amount.toFixed(1)}`;
  }
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
  const paidNumerator = stats.coreKpis.diagnosisToPaid.numerator;
  const paidDenominator = stats.coreKpis.diagnosisToPaid.denominator;
  const paidRate = paidDenominator > 0 ? paidNumerator / paidDenominator : 0;
  const currencies = stats.coreKpis.periodRevenue.currencies;
  const purchases = currencies.reduce((sum, row) => sum + row.purchases, 0);
  // 通貨バケット別 payers の合算は JPY と KRW の両方で買った人を二重計上する。
  // サーバが返す通貨横断のユニーク数を優先し、無い場合 (旧キャッシュ) のみ合算で代用。
  const payers =
    stats.coreKpis.periodRevenue.uniquePayers ??
    currencies.reduce((sum, row) => sum + row.payers, 0);
  const revenueLabel =
    currencies.length > 0 ? formatNetRevenue(currencies) : formatMoney(0, "jpy");
  const refundLabel =
    currencies.length > 0
      ? currencies
          .map((row) => formatMoney(row.refundedMinor, row.currency))
          .join(" / ")
      : formatMoney(0, "jpy");
  const arpuCurrencies = stats.coreKpis.arpu.currencies;
  const arpuLabel =
    arpuCurrencies.length > 0
      ? arpuCurrencies
          .map((row) => formatMoney(row.arpuMinor, row.currency))
          .join(" / ")
      : formatMoney(0, "jpy");
  return {
    hasTrustedCoreDiagnosis,
    diagnosisUsers,
    friendNumerator,
    friendDenominator,
    friendRate,
    paidNumerator,
    paidDenominator,
    paidRate,
    currencies,
    purchases,
    payers,
    revenueLabel,
    refundLabel,
    arpuCurrencies,
    arpuLabel,
  };
}

type MetricTrend = "up" | "down" | "flat";

function trendOf(diff: number): MetricTrend {
  return diff > 0 ? "up" : diff < 0 ? "down" : "flat";
}

const TREND_STYLES: Record<MetricTrend, { chip: string; arrow: string }> = {
  up: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    arrow: "▲",
  },
  down: {
    chip: "border-rose-200 bg-rose-50 text-rose-700",
    arrow: "▼",
  },
  flat: {
    chip: "border-stone-200 bg-stone-50 text-stone-500",
    arrow: "―",
  },
};

function CoursePaywallTable({
  plans,
}: {
  plans: Stats["coursePaywall"]["plans"];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#dfe5ef] bg-white">
      <table className="w-full min-w-[940px] text-xs">
        <thead className="bg-[#f8fafd] text-[#5f6368]">
          <tr>
            <th className="px-3 py-3 text-left font-black">コース</th>
            <th className="px-3 py-3 text-right font-black">表示</th>
            <th className="px-3 py-3 text-right font-black">CTA</th>
            <th className="px-3 py-3 text-right font-black">Stripe</th>
            <th className="px-3 py-3 text-right font-black">決済</th>
            <th className="px-3 py-3 text-right font-black">新規 / UP</th>
            <th className="px-3 py-3 text-right font-black">課金率</th>
            <th className="px-3 py-3 text-right font-black">実売上</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100/80">
          {plans.map((plan) => (
            <tr key={plan.product} className="hover:bg-stone-50/90">
              <td className="px-3 py-3 font-black text-stone-800">
                {COURSE_PAYWALL_LABELS[plan.product]}
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-stone-700">
                {plan.viewers.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-right">
                <p className="font-bold tabular-nums text-stone-700">
                  {plan.ctaClickers.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-stone-400">
                  {pct(plan.ctaRate)}
                </p>
              </td>
              <td className="px-3 py-3 text-right">
                <p className="font-bold tabular-nums text-stone-700">
                  {plan.stripeReached.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-stone-400">
                  CTA比 {pct(plan.stripeRate)}
                </p>
              </td>
              <td className="px-3 py-3 text-right">
                <p className="font-black tabular-nums text-emerald-600">
                  {plan.purchasers.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[10px] tabular-nums text-stone-400">
                  Stripe比 {pct(plan.checkoutCompletionRate)}
                </p>
              </td>
              <td className="px-3 py-3 text-right tabular-nums text-stone-600">
                {plan.newPurchases.toLocaleString()} / {plan.upgrades.toLocaleString()}
              </td>
              <td className="px-3 py-3 text-right">
                <span className="rounded bg-stone-900 px-2 py-1 font-black tabular-nums text-white">
                  {pct(plan.purchaseRate)}
                </span>
              </td>
              <td className="px-3 py-3 text-right font-black tabular-nums text-stone-900">
                {formatMoney(plan.revenueJpy, "jpy")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ExecutiveMetricTone = "indigo" | "emerald" | "cyan";

const EXECUTIVE_METRIC_TONES: Record<
  ExecutiveMetricTone,
  { accent: string; badge: string; icon: string; value: string; line: string }
> = {
  indigo: {
    accent: "bg-[#1a73e8]",
    badge: "border-[#aecbfa] bg-[#e8f0fe] text-[#1967d2]",
    icon: "bg-[#e8f0fe] text-[#1967d2] ring-[#aecbfa]",
    value: "text-[#1967d2]",
    line: "border-[#dfe5ef]",
  },
  emerald: {
    accent: "bg-[#34a853]",
    badge: "border-[#b7dfc2] bg-[#e6f4ea] text-[#137333]",
    icon: "bg-[#e6f4ea] text-[#137333] ring-[#b7dfc2]",
    value: "text-[#137333]",
    line: "border-[#dfe5ef]",
  },
  cyan: {
    accent: "bg-[#00acc1]",
    badge: "border-[#b2ebf2] bg-[#e0f7fa] text-[#007b83]",
    icon: "bg-[#e0f7fa] text-[#007b83] ring-[#b2ebf2]",
    value: "text-[#007b83]",
    line: "border-[#dfe5ef]",
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
    <article className={`relative min-h-[202px] overflow-hidden rounded-2xl border ${colors.line} bg-white p-5 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition duration-200 hover:shadow-[0_2px_8px_rgba(60,64,67,0.13)] sm:p-6`}>
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${colors.accent}`}
      />
      <span
        aria-hidden="true"
        className="absolute -right-2 top-3 text-[72px] font-bold leading-none text-[#202124]/[0.025]"
      >
        {index}
      </span>
      <div className="relative flex items-start justify-between gap-4">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-normal ${colors.badge}`}>
          {badge}
        </span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold ring-1 ${colors.icon}`}>
          {index}
        </span>
      </div>
      <p className="relative mt-5 text-[12px] font-medium tracking-normal text-[#5f6368]">
        {label}
      </p>
      <div className="relative mt-2 flex min-w-0 items-end gap-2">
        <p
          className={`min-w-0 font-semibold leading-none tracking-normal tabular-nums ${colors.value} ${
            compactValue
              ? "text-[34px] sm:text-4xl xl:text-[42px]"
              : "text-[44px] sm:text-5xl xl:text-[56px]"
          }`}
        >
          {value}
        </p>
        {unit ? (
          <span className="mb-1.5 shrink-0 text-base font-black text-stone-500 sm:mb-2">
            {unit}
          </span>
        ) : null}
      </div>
      {compare ? (
        <p
          className={`relative mt-4 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-black tabular-nums ${TREND_STYLES[compare.trend].chip}`}
        >
          <span aria-hidden="true">{TREND_STYLES[compare.trend].arrow}</span>
          {compare.label}
        </p>
      ) : null}
      <p className="relative mt-4 border-t border-[#eef1f5] pt-3 text-[11px] font-medium leading-relaxed text-[#5f6368]">
        {detail}
      </p>
    </article>
  );
}

function DiagnosisTrendChart({
  points,
}: {
  points: Stats["coreKpis"]["diagnosisTrend"]["points"];
}) {
  const width = 1000;
  const height = 260;
  const left = 54;
  const right = 18;
  const top = 18;
  const bottom = 42;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...points.map((point) => point.count), 1);
  const chartPoints = points.map((point, index) => {
    const x =
      left +
      (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const y = top + plotHeight - (point.count / maxValue) * plotHeight;
    return { ...point, x, y };
  });
  const linePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = chartPoints.length
    ? `${left},${top + plotHeight} ${linePoints} ${chartPoints.at(-1)!.x},${top + plotHeight}`
    : "";
  const labelIndexes = Array.from(
    new Set(
      Array.from({ length: Math.min(5, points.length) }, (_, index) =>
        Math.round((index / Math.max(Math.min(5, points.length) - 1, 1)) * (points.length - 1)),
      ),
    ),
  );

  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[#5f6368]">
        この期間の推移データはまだありません
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[260px] min-w-[680px] w-full"
        role="img"
        aria-label="自己診断完了人数の日別推移"
      >
        <defs>
          <linearGradient id="admin-diagnosis-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1a73e8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = top + plotHeight - ratio * plotHeight;
          return (
            <g key={ratio}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e6eaf0"
                strokeWidth="1"
              />
              <text
                x={left - 10}
                y={y + 4}
                textAnchor="end"
                fill="#80868b"
                fontSize="11"
              >
                {Math.round(maxValue * ratio).toLocaleString()}
              </text>
            </g>
          );
        })}
        {chartPoints.length > 1 && (
          <polygon points={areaPoints} fill="url(#admin-diagnosis-area)" />
        )}
        {chartPoints.length === 1 ? (
          <circle cx={chartPoints[0].x} cy={chartPoints[0].y} r="5" fill="#1a73e8" />
        ) : (
          <polyline
            points={linePoints}
            fill="none"
            stroke="#1a73e8"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {labelIndexes.map((index) => {
          const point = chartPoints[index];
          const date = new Date(`${point.date}T00:00:00`);
          return (
            <text
              key={`${point.date}-${index}`}
              x={point.x}
              y={height - 12}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              fill="#80868b"
              fontSize="11"
            >
              {Number.isNaN(date.getTime())
                ? point.date
                : `${date.getMonth() + 1}/${date.getDate()}`}
            </text>
          );
        })}
      </svg>
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
    <div className="mb-5 flex flex-col gap-3 border-b border-[#dfe5ef] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#1a73e8]">
          <span className="h-2 w-2 rounded-full bg-[#1a73e8]" aria-hidden="true" />
          {eyebrow}
        </p>
        <h2 className="text-[22px] font-medium tracking-normal text-[#202124] sm:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-xs font-normal leading-relaxed text-[#5f6368]">
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
      className={`rounded-2xl border border-[#dfe5ef] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)] ${className}`}
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
    <div className="grid grid-cols-[6.75rem_minmax(0,1fr)_3.5rem] items-center gap-2.5 sm:grid-cols-[9rem_minmax(0,1fr)_4.25rem] sm:gap-3">
      <span className="truncate text-right text-[11px] font-black text-stone-700 sm:text-xs" title={label}>
        {label}
      </span>
      <div className="relative h-9 overflow-hidden rounded-full bg-[#edf2f7] ring-1 ring-inset ring-[#dfe5ef]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#1a73e8,#669df6)] transition-all duration-500"
          style={{ width: `${Math.max(width, 1)}%` }}
        />
        <span className="absolute inset-y-1 right-1 flex min-w-10 items-center justify-center rounded-full bg-white/95 px-2 text-xs font-bold tabular-nums text-[#202124] shadow-sm">
          {count.toLocaleString()}
        </span>
      </div>
      <span className="text-right text-[11px] font-black tabular-nums text-stone-500 sm:text-xs">
        {convRate ?? "—"}
      </span>
    </div>
  );
}

type ReachTone = "teal" | "indigo" | "emerald" | "rose";

const REACH_TONES: Record<
  ReachTone,
  { step: string; bar: string; soft: string; text: string; border: string }
> = {
  teal: {
    step: "bg-teal-950 text-teal-50",
    bar: "bg-[linear-gradient(90deg,#0f766e,#14b8a6)]",
    soft: "bg-teal-50",
    text: "text-teal-800",
    border: "border-teal-200/80",
  },
  indigo: {
    step: "bg-indigo-950 text-indigo-50",
    bar: "bg-[linear-gradient(90deg,#3730a3,#6366f1)]",
    soft: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-200/80",
  },
  emerald: {
    step: "bg-emerald-950 text-emerald-50",
    bar: "bg-[linear-gradient(90deg,#047857,#10b981)]",
    soft: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200/80",
  },
  rose: {
    step: "bg-rose-950 text-rose-50",
    bar: "bg-[linear-gradient(90deg,#be123c,#fb7185)]",
    soft: "bg-rose-50",
    text: "text-rose-800",
    border: "border-rose-200/80",
  },
};

function ReachStepRow({
  index,
  label,
  count,
  max,
  rateFromBase,
  rateFromPrevious,
  baseLabel,
  tone = "teal",
}: {
  index: number;
  label: string;
  count: number;
  max: number;
  rateFromBase: number;
  rateFromPrevious: number | null;
  baseLabel: string;
  tone?: ReachTone;
}) {
  const colors = REACH_TONES[tone];
  const width = max > 0 ? (count / max) * 100 : 0;

  return (
    <li className="rounded-lg border border-stone-200/80 bg-white/55 px-3 py-3 shadow-[0_10px_26px_-24px_rgba(25,23,20,0.4)] transition hover:bg-white">
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black tabular-nums shadow-sm ${colors.step}`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-stone-900" title={label}>
                {label}
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200/70 ring-1 ring-inset ring-stone-300/50">
                <span
                  className={`block h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] ${colors.bar}`}
                  style={{ width: `${Math.max(width, count > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#dfe5ef] bg-white text-center shadow-sm">
          <div className="border-r border-stone-200/70 px-2 py-2.5">
            <p className="text-base font-black tabular-nums text-stone-950">
              {count.toLocaleString()}
              <span className="ml-0.5 text-[11px] text-stone-500">人</span>
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-stone-400">
              到達
            </p>
          </div>
          <div className={`border-r border-stone-200/70 px-2 py-2.5 ${colors.soft}`}>
            <p className={`text-base font-black tabular-nums ${colors.text}`}>
              {pct(rateFromBase)}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-stone-500">
              {baseLabel}
            </p>
          </div>
          <div className="px-2 py-2.5">
            <p className="text-base font-black tabular-nums text-stone-700">
              {rateFromPrevious === null ? "起点" : pct(rateFromPrevious)}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-stone-400">
              前段比
            </p>
          </div>
        </div>
      </div>
    </li>
  );
}

function ReachSummaryCard({
  label,
  count,
  rate,
  sub,
  tone = "teal",
}: {
  label: string;
  count: number;
  rate: number;
  sub: string;
  tone?: ReachTone;
}) {
  const colors = REACH_TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${colors.border} bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)]`}>
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${colors.bar}`}
      />
      <p className="pt-1 text-[11px] font-black text-stone-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-black leading-none tabular-nums text-stone-950">
          {count.toLocaleString()}
          <span className="ml-1 text-sm text-stone-500">人</span>
        </p>
        <span className={`rounded-md px-2.5 py-1 text-sm font-black tabular-nums ${colors.soft} ${colors.text}`}>
          {pct(rate)}
        </span>
      </div>
      <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] font-semibold leading-relaxed text-stone-500">
        {sub}
      </p>
    </div>
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
    // setTimeout(0) は react-hooks/set-state-in-effect (effect内の同期setState禁止)
    // を満たすためのもの。直接呼びに変えないこと。
    const stored = sessionStorage.getItem("torisetsu_admin_key");
    if (!stored) return;
    const restoreTimer = window.setTimeout(() => setAdminKey(stored), 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  // 応答の後勝ち上書きを防ぐ (遅い全期間の応答が、後から押した今日の表示を潰す)。
  // 最新のリクエスト番号だけが state を更新できる。
  const fetchSeqRef = useRef(0);
  // 「更新」ボタンで比較フェッチも強制再計算するためのトリガー。
  const compareFreshRef = useRef(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const fetchStats = useCallback(
    // fresh=true は「更新」ボタン。サーバキャッシュを飛ばして最新を再集計する
    // (通常の切替はキャッシュ利用: 現在を含む期間は5分・終端が48時間以内の過去
    // 期間は1時間・それより古い期間は24時間)。
    async (key: string, p: Preset, cFrom: string, cTo: string, fresh = false) => {
      const seq = ++fetchSeqRef.current;
      const isLatest = () => seq === fetchSeqRef.current;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (fresh) params.set("fresh", "1");
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
          if (!isLatest()) return;
          setError("パスワードが正しくありません");
          setAdminKey(null);
          sessionStorage.removeItem("torisetsu_admin_key");
          return;
        }
        if (!res.ok) throw new Error();
        const nextStats = (await res.json()) as Stats;
        if (!isLatest()) return;
        setStats(nextStats);
        setLastUpdatedAt(new Date().toISOString());
        setAdminKey(key);
        sessionStorage.setItem("torisetsu_admin_key", key);
      } catch {
        if (isLatest()) setError("データの取得に失敗しました");
      } finally {
        if (isLatest()) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!adminKey) return;
    // カスタム日付は矢印キーで1ステップごとに change が発火するため、
    // 350ms のデバウンスで集計APIの連打を防ぐ。プリセット切替は即時。
    const delay = preset === "custom" ? 350 : 0;
    const fetchTimer = window.setTimeout(
      () => void fetchStats(adminKey, preset, customFrom, customTo),
      delay,
    );
    return () => window.clearTimeout(fetchTimer);
  }, [adminKey, preset, customFrom, customTo, fetchStats]);

  // 比較期間の統計を追加取得 (見出しカードの比較チップ用)。
  // 本体とは独立して取得し、失敗時はチップ非表示のみ (本体表示は影響なし)。
  // refreshNonce: 「更新」ボタンで本体と一緒に再取得する (compareFreshRef が立って
  // いればサーバキャッシュも飛ばす。過去期間は24hキャッシュされるため必須)。
  useEffect(() => {
    if (!adminKey) return;
    const range = resolveCompareRange(
      preset,
      comparePreset,
      compareFrom,
      compareTo,
    );
    let cancelled = false;
    const run = async () => {
      if (!range) {
        if (!cancelled) setPrevStats(null);
        return;
      }
      try {
        const params = new URLSearchParams({ from: range.from, to: range.to });
        if (compareFreshRef.current) {
          compareFreshRef.current = false;
          params.set("fresh", "1");
        }
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
    };
    // カスタム比較日付も本体と同じ理由でデバウンスする。
    const delay = comparePreset === "custom" ? 350 : 0;
    const timer = window.setTimeout(() => void run(), delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [adminKey, preset, comparePreset, compareFrom, compareTo, refreshNonce]);

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
      <div className="min-h-screen bg-[#f3f6fc] text-[#202124]">
        <header className="flex h-[72px] items-center border-b border-[#dfe5ef] bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a73e8] text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-[#202124]">ワタシのトリセツ</p>
              <p className="text-[11px] text-[#5f6368]">管理コンソール</p>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-[1120px] items-center px-4 py-10 sm:px-6">
          <div className="grid w-full overflow-hidden rounded-3xl border border-[#dfe5ef] bg-white shadow-[0_8px_28px_rgba(60,64,67,0.12)] md:grid-cols-[1.05fr_0.95fr]">
            <div className="hidden bg-[#e8f0fe] p-10 md:flex md:flex-col md:justify-between lg:p-14">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-[#1967d2]">
                  <span className="h-2 w-2 rounded-full bg-[#34a853]" />
                  Private dashboard
                </span>
                <h1 className="mt-8 text-4xl font-medium leading-tight text-[#202124] lg:text-[44px]">
                  大事な数字が、
                  <br />
                  すぐわかる。
                </h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-[#5f6368]">
                  診断・売上・課金・友達診断の状況を、ひとつの画面で確認できます。
                </p>
              </div>
              <div className="mt-12 grid grid-cols-3 gap-3">
                {[
                  ["診断", "#1a73e8"],
                  ["売上", "#34a853"],
                  ["拡散", "#f9ab00"],
                ].map(([label, color]) => (
                  <div key={label} className="rounded-2xl bg-white/75 p-4">
                    <span className="block h-1 w-8 rounded-full" style={{ backgroundColor: color }} />
                    <p className="mt-3 text-xs font-medium text-[#3c4043]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1967d2]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <h2 className="text-2xl font-medium text-[#202124]">管理画面へログイン</h2>
              <p className="mt-2 text-sm leading-6 text-[#5f6368]">
                管理パスワードを入力してください。
              </p>
              <label htmlFor="admin-password" className="mb-2 mt-8 text-xs font-medium text-[#3c4043]">
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
                className="w-full rounded-xl border border-[#bdc1c6] bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-[#9aa0a6] focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/15"
              />
              {error && (
                <p className="mt-3 rounded-xl bg-[#fce8e6] px-3 py-2.5 text-xs font-medium text-[#b3261e]">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading || !inputKey.trim()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1a73e8] py-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1765cc] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "確認中..." : "ログイン"}
                {!loading && <span aria-hidden="true">→</span>}
              </button>
              <p className="mt-6 text-center text-[11px] text-[#9aa0a6]">
                管理者のみアクセスできます
              </p>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6fc]">
        <div className="rounded-2xl border border-[#dfe5ef] bg-white px-8 py-7 text-center shadow-[0_4px_16px_rgba(60,64,67,0.12)]">
          <span className="mx-auto mb-4 block h-9 w-9 animate-spin rounded-full border-[3px] border-[#dfe5ef] border-t-[#1a73e8]" />
          <p className="text-sm font-medium text-[#202124]">データを読み込み中</p>
          <p className="mt-1 text-xs text-[#5f6368]">集計に少し時間がかかる場合があります</p>
        </div>
      </div>
    );
  }

  // 認証済みで stats が無い = 取得失敗 (非401)。以前は null を返して真っ白になり、
  // エラー文もリトライ手段も無かった (Supabase 障害時に管理画面全体が沈黙する)。
  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6fc] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#dfe5ef] bg-white px-8 py-7 text-center shadow-[0_4px_16px_rgba(60,64,67,0.12)]">
          <p className="text-sm font-medium text-[#202124]">
            {error || "データを取得できませんでした"}
          </p>
          <p className="mt-1 text-xs text-[#5f6368]">
            時間をおいて再試行してください
          </p>
          <button
            type="button"
            onClick={() => void fetchStats(adminKey, preset, customFrom, customTo)}
            disabled={loading}
            className="mt-5 w-full rounded-full bg-[#1a73e8] py-3 text-sm font-medium text-white transition hover:bg-[#1765cc] disabled:opacity-50"
          >
            {loading ? "再試行中..." : "再試行"}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full text-xs font-medium text-[#5f6368] hover:text-[#b3261e]"
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  const ownerFriendFunnelMax = Math.max(
    ...stats.friendDiagnosisFunnel.ownerFunnel.map((f) => f.count),
    1,
  );
  const visitorFriendFunnelMax = Math.max(
    ...stats.friendDiagnosisFunnel.friendFunnel.map((f) => f.count),
    1,
  );
  // 「解除ボタン押下」はカード表示後の段階ではなく、モーダルを開く流入操作。
  // 連続ファネルに混ぜると前段比が100%を超えるため、別指標として扱う。
  const paywallUnlockClicks =
    (stats.paywallFunnel ?? []).find(
      (step) => step.label === "解除ボタン押下",
    )?.count ?? 0;
  const displayPaywallFunnel = (stats.paywallFunnel ?? []).filter(
    (step) => step.label !== "解除ボタン押下",
  );
  const paywallFunnelMax = Math.max(
    ...displayPaywallFunnel.map((f) => f.count),
    1,
  );
  const unmeiFunnelMax = Math.max(
    ...(stats.unmei?.funnel ?? []).map((f) => f.count),
    1,
  );
  const unmeiRevenueLabel =
    stats.unmei.revenue.currencies.length > 0
      ? formatNetRevenue(stats.unmei.revenue.currencies)
      : formatMoney(0, "jpy");
  const unmeiLpCount = stats.unmei.funnel[0]?.count ?? 0;
  const unmeiPurchaseCount = stats.unmei.purchases.total;
  const unmeiReadingCount =
    stats.unmei.funnel.find((step) => step.label === "鑑定表示")?.count ?? 0;
  const fc = stats.friendCountDistribution;
  const coreReady = stats.coreKpis.dataQuality.ready;
  const ownerFriendFunnel = stats.friendDiagnosisFunnel.ownerFunnel;
  const visitorFriendFunnel = stats.friendDiagnosisFunnel.friendFunnel;

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
      "選択期間の自己診断完了者のうち、フルアクセス実決済済みの人",
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
    rows.push(["# 3コース課金ファネル"]);
    rows.push(["ステップ", "件数"]);
    (stats.paywallFunnel ?? []).forEach((s) =>
      rows.push([s.label, String(s.count)]),
    );
    rows.push([]);
    rows.push(["# 3コース商品別"]);
    rows.push([
      "コース",
      "表示者",
      "CTA",
      "Stripe",
      "課金者",
      "新規",
      "アップグレード",
      "課金率",
      "実売上(JPY)",
    ]);
    stats.coursePaywall.plans.forEach((plan) =>
      rows.push([
        COURSE_PAYWALL_LABELS[plan.product],
        String(plan.viewers),
        String(plan.ctaClickers),
        String(plan.stripeReached),
        String(plan.purchasers),
        String(plan.newPurchases),
        String(plan.upgrades),
        pct(plan.purchaseRate),
        String(plan.revenueJpy),
      ]),
    );
    rows.push([]);
    rows.push(["# 運命の設計図"]);
    rows.push(["ステップ", "件数"]);
    stats.unmei.funnel.forEach((s) => rows.push([s.label, String(s.count)]));
    rows.push([
      "購入内訳",
      `通常 ${stats.unmei.purchases.basic} / アップグレード ${stats.unmei.purchases.upgrade}`,
    ]);
    rows.push(["出生フォーム保存率", pct(stats.unmei.birthForm.submitRate)]);
    rows.push(["運命バッジクリック率", pct(stats.unmei.navBadge.clickRate)]);
    stats.unmei.revenue.currencies.forEach((currency) =>
      rows.push([
        `運命売上 (${currency.currency.toUpperCase()})`,
        String(currency.netRevenueMinor),
      ]),
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
    if (stats.acquisitionStats.sources.length > 0) {
      rows.push(["# 流入元別"]);
      rows.push(["流入元", "新規ユーザー", "構成比"]);
      stats.acquisitionStats.sources.forEach((s) =>
        rows.push([s.source, String(s.users), pct(s.share)]),
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

  const selectedPeriodSummary = formatPeriodSummary(
    preset,
    customFrom,
    customTo,
  );
  const headlines = computeHeadlines(stats);
  const hasTrustedCoreDiagnosis = headlines.hasTrustedCoreDiagnosis;
  const headlineDiagnosisUsers = headlines.diagnosisUsers;
  const headlineFriendNumerator = headlines.friendNumerator;
  const headlineFriendDenominator = headlines.friendDenominator;
  const headlineFriendRate = headlines.friendRate;
  const headlinePaidNumerator = headlines.paidNumerator;
  const headlinePaidDenominator = headlines.paidDenominator;
  const headlinePaidRate = headlines.paidRate;
  const periodRevenuePurchases = headlines.purchases;
  const periodRevenuePayers = headlines.payers;
  const headlineRevenue = headlines.revenueLabel;
  const headlineArpu = headlines.arpuLabel;
  const headlineRefunds = headlines.refundLabel;
  // 返金率は通貨をまたいで合算できない (JPY と KRW の minor 単位を 1:1 で足すと
  // 率が壊れる。既知の罠)。通貨ごとに算出し、単一通貨ならそのまま、混在時は並記する。
  // periodRevenue 由来なので全商品ベース (3コース限定ではない)。
  const refundRateRows = headlines.currencies.filter(
    (row) => row.grossRevenueMinor > 0,
  );
  const refundRateLabel =
    refundRateRows.length === 0
      ? null
      : refundRateRows.length === 1
        ? pct(refundRateRows[0].refundedMinor / refundRateRows[0].grossRevenueMinor)
        : refundRateRows
            .map(
              (row) =>
                `${row.currency.toUpperCase()} ${pct(row.refundedMinor / row.grossRevenueMinor)}`,
            )
            .join(" / ");
  const hasRefunds = headlines.currencies.some((row) => row.refundedMinor > 0);
  const fullAccessCtaCount = countStep(
    stats.paywallFunnel ?? [],
    "購入CTA押下",
    3,
  );
  const fullAccessStripeCount = countStep(
    stats.paywallFunnel ?? [],
    "Stripe到達",
    4,
  );
  const fullAccessPurchaseCount = countStep(
    stats.paywallFunnel ?? [],
    "決済完了",
    5,
  );
  const fullAccessStripeRate = rateOrNull(
    fullAccessStripeCount,
    fullAccessCtaCount,
  );
  const fullAccessCompleteRate = rateOrNull(
    fullAccessPurchaseCount,
    fullAccessStripeCount,
  );
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
  const payerCompare = prevHeadlines
    ? (() => {
        const diff = periodRevenuePayers - prevHeadlines.payers;
        return {
          label: `${prevRangeInfo!.label} ${prevHeadlines.payers.toLocaleString()}人 (${diff > 0 ? "+" : ""}${diff.toLocaleString()})`,
          trend: trendOf(diff),
        };
      })()
    : null;
  const arpuCompare = prevHeadlines
    ? (() => {
        const current = headlines.arpuCurrencies;
        const previous = prevHeadlines.arpuCurrencies;
        const comparable =
          current.length <= 1 &&
          previous.length <= 1 &&
          (current.length === 0 ||
            previous.length === 0 ||
            current[0].currency === previous[0].currency);
        if (!comparable) {
          return {
            label: `${prevRangeInfo!.label} ${prevHeadlines.arpuLabel}`,
            trend: "flat" as MetricTrend,
          };
        }
        const currency = current[0]?.currency ?? previous[0]?.currency ?? "jpy";
        const currentMinor = current[0]?.arpuMinor ?? 0;
        const previousMinor = previous[0]?.arpuMinor ?? 0;
        const diff = currentMinor - previousMinor;
        return {
          label: `${prevRangeInfo!.label} ${formatMoney(previousMinor, currency)} (${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${formatMoney(Math.abs(diff), currency)})`,
          trend: trendOf(diff),
        };
      })()
    : null;
  const paidRateCompare = prevHeadlines
    ? (() => {
        if (prevHeadlines.paidDenominator === 0) {
          return {
            label: `${prevRangeInfo!.label} —`,
            trend: "flat" as MetricTrend,
          };
        }
        const diffPt = (headlinePaidRate - prevHeadlines.paidRate) * 100;
        return {
          label: `${prevRangeInfo!.label} ${pct(prevHeadlines.paidRate)} (${diffPt > 0 ? "+" : ""}${diffPt.toFixed(1)}pt)`,
          trend: trendOf(diffPt),
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
  const biggestPaywallDrop = displayPaywallFunnel.reduce<{
    from: string;
    to: string;
    lost: number;
    lossRate: number;
  } | null>((largest, step, index, funnel) => {
    if (index === 0) return largest;
    const previous = funnel[index - 1];
    if (!previous || previous.count <= 0) return largest;
    const lost = Math.max(previous.count - step.count, 0);
    // 減少ゼロは「離脱箇所」ではない。候補にすると全段同数のとき
    // 「0人（0.0%）減少」というアンバー誤警報が出る。
    if (lost === 0) return largest;
    const candidate = {
      from: previous.label,
      to: step.label,
      lost,
      lossRate: lost / previous.count,
    };
    return !largest || candidate.lost > largest.lost ? candidate : largest;
  }, null);
  const trackableAcquisitionSources = stats.acquisitionStats.sources.filter(
    (source) => source.source !== stats.acquisitionStats.directLabel,
  );
  const topAcquisitionSource = (
    trackableAcquisitionSources.length > 0
      ? trackableAcquisitionSources
      : stats.acquisitionStats.sources
  ).reduce<
    Stats["acquisitionStats"]["sources"][number] | null
  >((top, source) => (!top || source.users > top.users ? source : top), null);
  const decisionNotes = [
    !coreReady
      ? {
          label: "データ確認",
          detail: `KPIの確定に必要な確認事項が ${stats.coreKpis.dataQuality.issues.length.toLocaleString()}件あります。`,
          href: "#overview",
          tone: "amber" as const,
        }
      : {
          label: "売上状況",
          // 現期間の実額を常に出す。比較があれば括弧で併記 (?? で置き換えると
          // 比較有効時に現期間の売上がどこにも表示されなくなる)。
          detail: `${headlineRevenue}・購入者 ${periodRevenuePayers.toLocaleString()}人${revenueCompare ? `（${revenueCompare.label}）` : ""}`,
          href: "#revenue",
          tone: revenueCompare?.trend === "down" ? ("amber" as const) : ("blue" as const),
        },
    biggestPaywallDrop
      ? {
          label: "最大の離脱箇所",
          detail: `${biggestPaywallDrop.from} → ${biggestPaywallDrop.to} で ${biggestPaywallDrop.lost.toLocaleString()}人（${pct(biggestPaywallDrop.lossRate)}）減少。`,
          href: "#revenue",
          tone: "amber" as const,
        }
      : {
          label: "購入導線",
          detail: `CTA→Stripe ${nullablePct(fullAccessStripeRate)}・Stripe→完了 ${nullablePct(fullAccessCompleteRate)}`,
          href: "#revenue",
          tone: "blue" as const,
        },
    {
      label: "友達・拡散",
      detail: `診断→友達回答 ${pctOrDash(headlineFriendRate, headlineFriendDenominator)}・拡散係数 ${!coreReady ? "要DB更新" : stats.coreKpis.viralCoefficient.denominator > 0 ? stats.coreKpis.viralCoefficient.value.toFixed(3) : "—"}`,
      href: "#friend-funnel",
      tone: friendRateCompare?.trend === "down" ? ("amber" as const) : ("green" as const),
    },
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f3f6fc] text-[#202124]">
      <header className="sticky top-0 z-40 flex h-[72px] items-center gap-3 border-b border-[#dfe5ef] bg-white px-3 shadow-[0_1px_2px_rgba(60,64,67,0.06)] sm:px-5">
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5f6368] transition hover:bg-[#f1f3f4] lg:hidden"
          aria-label={mobileNavOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-expanded={mobileNavOpen}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex w-auto shrink-0 items-center gap-3 lg:w-[244px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a73e8] text-white shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
              <path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" />
            </svg>
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-[#202124]">ワタシのトリセツ</p>
            <p className="text-[11px] text-[#5f6368]">管理コンソール</p>
          </div>
        </div>

        <div className="mx-auto hidden h-12 max-w-[760px] flex-1 items-center gap-2 rounded-full bg-[#edf3fe] px-4 xl:flex">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 text-[#5f6368]" aria-hidden="true">
            <path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" strokeLinecap="round" />
          </svg>
          <span className="mr-2 text-xs text-[#5f6368]">表示期間</span>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
            {PRESETS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPreset(item.key)}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition ${
                  preset === item.key
                    ? "bg-[#1a73e8] text-white shadow-sm"
                    : "text-[#3c4043] hover:bg-white/80"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            aria-label="CSVを出力"
            className="flex h-10 items-center gap-2 rounded-full px-3 text-xs font-medium text-[#5f6368] transition hover:bg-[#f1f3f4]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden="true">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden xl:inline">CSV出力</span>
          </button>
          <button
            type="button"
            onClick={() => {
              compareFreshRef.current = true;
              setRefreshNonce((nonce) => nonce + 1);
              void fetchStats(adminKey, preset, customFrom, customTo, true);
            }}
            disabled={loading}
            aria-label={loading ? "更新中" : "最新データに更新"}
            className="flex h-10 items-center gap-2 rounded-full bg-[#1a73e8] px-3.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#1765cc] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.34 5.66M20 11V5m0 6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">{loading ? "更新中" : "更新"}</span>
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="メニューを閉じる"
          className="fixed inset-0 top-[72px] z-20 bg-black/20 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-[72px] z-30 flex w-[272px] flex-col border-r border-[#dfe5ef] bg-[#f8faff] transition-transform duration-200 lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="p-3">
          <div className="rounded-2xl border border-[#bdc1c6] bg-white px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#80868b]">プロパティ</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium text-[#3c4043]">watashi-torisetsu.com</span>
              <span className="text-[#5f6368]" aria-hidden="true">⌄</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-5" aria-label="管理画面メニュー">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group} className="mt-4 first:mt-1">
              {group !== "メイン" && (
                <p className="mb-1 px-4 text-[11px] font-medium text-[#80868b]">{group}</p>
              )}
              <div className="space-y-1">
                {ADMIN_NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`group flex items-center gap-3 rounded-full px-4 py-2.5 text-[13px] font-medium transition ${
                      activeSection === item.id
                        ? "bg-[#d3e3fd] text-[#0b57d0]"
                        : "text-[#3c4043] hover:bg-[#edf2f7]"
                    }`}
                    aria-current={activeSection === item.id ? "location" : undefined}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
                      <path d={item.path} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-5 border-t border-[#dfe5ef] pt-4">
            <a href="/admin/social" className="flex items-center gap-3 rounded-full px-4 py-2.5 text-[13px] font-medium text-[#3c4043] transition hover:bg-[#edf2f7]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden="true">
                <path d="M4 7h16M4 12h10M4 17h16" strokeLinecap="round" />
              </svg>
              SNS素材ライブラリ
            </a>
          </div>
        </nav>

        <div className="border-t border-[#dfe5ef] p-3">
          <div className="rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs font-medium text-[#3c4043]">
                <span className={`h-2 w-2 rounded-full ${coreReady ? "bg-[#34a853]" : "bg-[#f9ab00]"}`} />
                {coreReady ? "データ正常" : "DB更新が必要"}
              </span>
              <span className="text-[10px] tabular-nums text-[#80868b]">
                {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
            <button type="button" onClick={handleLogout} className="mt-3 w-full border-t border-[#eef1f5] pt-3 text-left text-xs font-medium text-[#5f6368] hover:text-[#b3261e]">
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[272px]">
        <nav className="sticky top-[72px] z-10 flex gap-1 overflow-x-auto border-b border-[#dfe5ef] bg-white/95 px-3 py-2 backdrop-blur xl:hidden" aria-label="表示期間">
          {PRESETS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPreset(item.key)}
              className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium ${
                preset === item.key ? "bg-[#d3e3fd] text-[#0b57d0]" : "text-[#5f6368]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <main className="mx-auto flex max-w-[1360px] flex-col gap-12 px-4 py-6 sm:px-6 sm:py-8 xl:px-8 xl:py-10">
          <section id="overview" className="scroll-mt-36 xl:scroll-mt-28">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium text-[#5f6368]">watashi-torisetsu.com</p>
                <h1 className="mt-1 text-2xl font-medium text-[#202124] sm:text-[28px]">サマリー</h1>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#5f6368]">
                <span className={`h-2 w-2 rounded-full ${coreReady ? "bg-[#34a853]" : "bg-[#f9ab00]"}`} />
                {coreReady ? "集計データは正常です" : "一部の数値は暫定値です"}
                <span className="text-[#9aa0a6]">・</span>
                <span>更新 {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ExecutiveMetricCard
                index="01"
                label="純売上"
                value={headlineRevenue}
                badge="返金反映後"
                detail={`決済 ${periodRevenuePurchases.toLocaleString()}件・返金 ${headlineRefunds}`}
                tone="emerald"
                compactValue
                compare={revenueCompare}
              />
              <ExecutiveMetricCard
                index="02"
                label="購入者"
                value={periodRevenuePayers.toLocaleString()}
                unit="人"
                badge="ユニーク"
                detail={`1人あたり ${(periodRevenuePayers > 0 ? periodRevenuePurchases / periodRevenuePayers : 0).toFixed(1)}件の決済`}
                tone="indigo"
                compare={payerCompare}
              />
              <ExecutiveMetricCard
                index="03"
                label="診断からの課金率"
                value={coreReady ? pctOrDash(headlinePaidRate, headlinePaidDenominator) : "要DB更新"}
                badge="診断 → 購入"
                detail={coreReady ? `${headlinePaidNumerator.toLocaleString()}人 / ${headlinePaidDenominator.toLocaleString()}人` : "payment_history の更新が必要です"}
                tone="emerald"
                compactValue={!coreReady}
                compare={coreReady ? paidRateCompare : null}
              />
              <ExecutiveMetricCard
                index="04"
                label="ARPU"
                value={coreReady ? headlineArpu : "要DB更新"}
                badge="診断者1人あたり"
                detail={stats.coreKpis.arpu.basis}
                tone="cyan"
                compactValue
                compare={coreReady ? arpuCompare : null}
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
              <Panel className="overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-[#eef1f5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-medium text-[#202124]">自己診断完了の推移</h2>
                    <p className="mt-1 text-xs text-[#5f6368]">1日ごとの完了ユーザー数（JST）</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-[#1a73e8]">
                    <span className="h-0.5 w-5 rounded-full bg-[#1a73e8]" />
                    自己診断完了
                  </div>
                </div>
                <div className="px-3 pb-2 pt-4 sm:px-5">
                  <DiagnosisTrendChart points={stats.coreKpis.diagnosisTrend.points} />
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <div className="border-b border-[#eef1f5] px-5 py-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#1a73e8]">Action center</p>
                  <h2 className="mt-1 text-base font-medium text-[#202124]">今見るポイント</h2>
                </div>
                <div className="divide-y divide-[#eef1f5]">
                  {decisionNotes.map((note) => (
                    <a key={note.label} href={note.href} className="group flex gap-3 px-5 py-4 transition hover:bg-[#f8fbff]">
                      <span
                        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          note.tone === "amber"
                            ? "bg-[#f9ab00]"
                            : note.tone === "green"
                              ? "bg-[#34a853]"
                              : "bg-[#1a73e8]"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium text-[#202124]">{note.label}</p>
                          <span className="text-[#9aa0a6] transition group-hover:translate-x-0.5 group-hover:text-[#1a73e8]" aria-hidden="true">›</span>
                        </div>
                        <p className="mt-1.5 text-[11px] leading-5 text-[#5f6368]">{note.detail}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </Panel>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <a href="#acquisition" className="rounded-2xl border border-[#dfe5ef] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition hover:border-[#a8c7fa]">
                <p className="text-[11px] font-medium text-[#5f6368]">自己診断完了</p>
                <p className="mt-2 text-2xl font-medium tabular-nums text-[#1967d2]">
                  {headlineDiagnosisUsers.toLocaleString()}<span className="ml-1 text-sm">人</span>
                </p>
                <p className="mt-2 text-[11px] text-[#80868b]">
                  {/* 集計基準 (確定ユーザー/完了セッション) は比較の有無に関わらず常に表示する。
                      ?? で置き換えるとセッション数がユーザー数として読まれてしまう。 */}
                  {[
                    hasTrustedCoreDiagnosis ? "確定ユーザー" : "完了セッション",
                    diagCompare?.label,
                  ]
                    .filter(Boolean)
                    .join("・")}
                </p>
              </a>
              <a href="#friend-funnel" className="rounded-2xl border border-[#dfe5ef] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition hover:border-[#a8c7fa]">
                <p className="text-[11px] font-medium text-[#5f6368]">診断→友達回答</p>
                <p className="mt-2 text-2xl font-medium tabular-nums text-[#007b83]">
                  {pctOrDash(headlineFriendRate, headlineFriendDenominator)}
                </p>
                <p className="mt-2 text-[11px] text-[#80868b]">
                  {[
                    `${headlineFriendNumerator.toLocaleString()}人 / ${headlineFriendDenominator.toLocaleString()}人`,
                    friendRateCompare?.label,
                  ]
                    .filter(Boolean)
                    .join("・")}
                </p>
              </a>
              <a href="#friend-funnel" className="rounded-2xl border border-[#dfe5ef] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition hover:border-[#a8c7fa]">
                <p className="text-[11px] font-medium text-[#5f6368]">拡散係数</p>
                <p className="mt-2 text-2xl font-medium tabular-nums text-[#137333]">
                  {/* DB未更新時に「—」や0を出すと実測値と区別が付かない (2026-08-10 の教訓)。 */}
                  {!coreReady
                    ? "要DB更新"
                    : stats.coreKpis.viralCoefficient.denominator > 0
                      ? stats.coreKpis.viralCoefficient.value.toFixed(3)
                      : "—"}
                </p>
                <p className="mt-2 text-[11px] text-[#80868b]">
                  {coreReady
                    ? `招待経由の新規診断 ${stats.coreKpis.viralCoefficient.children.toLocaleString()}人`
                    : "DB更新後に確定します"}
                </p>
              </a>
            </div>

            <div
              id="overview-filters"
              className="mt-5 overflow-hidden rounded-2xl border border-[#dfe5ef] bg-white shadow-[0_1px_3px_rgba(60,64,67,0.1)]"
            >
              <div className="grid gap-4 border-b border-[#e6eaf0] p-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1967d2]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M16 3v4M8 3v4M3 10h18" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#202124]">表示期間</p>
                    <p className="mt-1 text-[11px] leading-4 text-[#5f6368]">
                      {selectedPeriodSummary}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setPreset(item.key)}
                        aria-pressed={preset === item.key}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/25 ${
                          preset === item.key
                            ? "border-[#1a73e8] bg-[#e8f0fe] text-[#0b57d0]"
                            : "border-[#dadce0] bg-white text-[#3c4043] hover:border-[#a8c7fa] hover:bg-[#f8fbff]"
                        }`}
                      >
                        {preset === item.key && (
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5" aria-hidden="true">
                            <path d="m3 8 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {preset === "custom" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#f8fafd] p-3">
                      <label className="flex items-center gap-2 text-[11px] font-medium text-[#5f6368]">
                        開始
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="rounded-lg border border-[#bdc1c6] bg-white px-3 py-2 text-xs font-medium text-[#3c4043] outline-none focus:border-[#1a73e8]"
                        />
                      </label>
                      <span className="text-xs text-[#80868b]">〜</span>
                      <label className="flex items-center gap-2 text-[11px] font-medium text-[#5f6368]">
                        終了
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="rounded-lg border border-[#bdc1c6] bg-white px-3 py-2 text-xs font-medium text-[#3c4043] outline-none focus:border-[#1a73e8]"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 bg-[#f8fafd] p-5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#5f6368] ring-1 ring-[#dfe5ef]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                      <path d="M8 7h11m0 0-3-3m3 3-3 3M16 17H5m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[#202124]">比較</p>
                    <p className="mt-1 text-[11px] text-[#5f6368]">
                      {comparePreset === "none"
                        ? "比較しない"
                        : comparePreset === "custom"
                          ? "指定期間と比較"
                          : (prevRangeInfo?.label ?? "比較期間なし")}
                    </p>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: "auto", label: "直前の同期間" },
                        { key: "custom", label: "日付を指定" },
                        { key: "none", label: "比較なし" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setComparePreset(item.key)}
                        aria-pressed={comparePreset === item.key}
                        className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/25 ${
                          comparePreset === item.key
                            ? "border-[#1a73e8] bg-white text-[#0b57d0] shadow-sm"
                            : "border-[#dadce0] bg-transparent text-[#5f6368] hover:bg-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {comparePreset === "custom" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-[11px] font-medium text-[#5f6368]">
                        開始
                        <input
                          type="date"
                          value={compareFrom}
                          onChange={(e) => setCompareFrom(e.target.value)}
                          className="rounded-lg border border-[#bdc1c6] bg-white px-3 py-2 text-xs font-medium text-[#3c4043] outline-none focus:border-[#1a73e8]"
                        />
                      </label>
                      <span className="text-xs text-[#80868b]">〜</span>
                      <label className="flex items-center gap-2 text-[11px] font-medium text-[#5f6368]">
                        終了
                        <input
                          type="date"
                          value={compareTo}
                          onChange={(e) => setCompareTo(e.target.value)}
                          className="rounded-lg border border-[#bdc1c6] bg-white px-3 py-2 text-xs font-medium text-[#3c4043] outline-none focus:border-[#1a73e8]"
                        />
                      </label>
                    </div>
                  )}
                  {comparePreset === "auto" && !prevRangeInfo && (
                    <p className="mt-2 text-[11px] text-[#a15c00]">
                      全期間・日付指定は「日付を指定」で比較期間を選んでください。
                    </p>
                  )}
                </div>
              </div>
            </div>

          </section>

          <section id="revenue" className="scroll-mt-36 xl:scroll-mt-28">
            <SectionHeader
              eyebrow="Business"
              title="売上・購入"
              description="売上の結果と、購入導線のどこで離脱しているかを確認します"
              side={
                <div className="flex items-center gap-4 rounded-xl border border-[#b7dfc2] bg-[#e6f4ea] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-medium text-[#137333]">選択期間の純売上</p>
                    <p className="text-lg font-semibold tabular-nums text-[#0d652d]">
                      {/* DB未更新時の ¥0 は「売上ゼロの日」と区別が付かないため明示する。 */}
                      {coreReady ? headlineRevenue : "要DB更新"}
                    </p>
                  </div>
                </div>
              }
            />
            <Panel className="p-5 sm:p-6">
            <div className="mb-6 flex flex-col gap-4 border-b border-[#eef1f5] pb-5 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#202124]">
                  {stats.coursePaywall.version === "legacy"
                    ? "¥499課金カードの購入ファネル"
                    : "3コースの購入ファネル"}
                </h3>
                <p className="mt-1 text-[11px] text-[#5f6368]">
                  {stats.coursePaywall.version === "legacy"
                    ? "完全版 ¥499"
                    : "お試し ¥199・完全版 ¥499・プレミアム ¥899"}
                </p>
              </div>
              <dl className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#dfe5ef] bg-[#f8fafd]">
                <div className="border-r border-[#dfe5ef] px-4 py-3 text-center">
                  <dt className="text-[10px] text-[#80868b]">購入者</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-[#202124]">{stats.coursePaywall.purchasers.toLocaleString()}<span className="ml-0.5 text-xs">人</span></dd>
                </div>
                <div className="border-r border-[#dfe5ef] px-4 py-3 text-center">
                  <dt className="text-[10px] text-[#80868b]">閲覧→購入</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-[#1967d2]">{pct(stats.purchaseConversionRate)}</dd>
                </div>
                <div className="px-4 py-3 text-center">
                  <dt className="text-[10px] text-[#80868b]">返金率（全商品）</dt>
                  <dd className={`mt-1 text-lg font-semibold tabular-nums ${hasRefunds ? "text-[#b3261e]" : "text-[#137333]"}`}>{refundRateLabel ?? "—"}</dd>
                </div>
              </dl>
            </div>
            <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-normal text-stone-400">
              <span className="w-28 text-right">ステップ</span>
              <span className="flex-1">件数</span>
              <span className="w-16 text-right">前段比</span>
            </div>
            <div className="flex flex-col gap-2">
              {displayPaywallFunnel.map((step, i) => (
                <FunnelBar
                  key={step.label}
                  label={step.label}
                  count={step.count}
                  max={paywallFunnelMax}
                  prevCount={
                    i > 0 ? displayPaywallFunnel[i - 1].count : undefined
                  }
                />
              ))}
            </div>
            <p className="mt-4 border-t border-stone-100 pt-4 text-[11px] leading-relaxed text-stone-400">
              {stats.coursePaywall.version === "legacy"
                ? "現在表示中の¥499単一カードだけを集計し、開発プレビューとテスト決済（cs_test_）は除外しています。"
                : "現在表示中の3コース版だけを集計し、開発プレビューとテスト決済（cs_test_）は除外しています。"}
              課金率はユニーク課金者 ÷ カード閲覧者です。解除導線クリックはカードへの流入操作のため、ファネル段階には含めていません（
              {paywallUnlockClicks.toLocaleString()}人）。
            </p>
            {stats.coursePaywall.version !== "legacy" && (
              <div className="mt-6 border-t border-stone-100 pt-5">
                <p className="mb-1 text-sm font-black text-stone-900">
                  コース別
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-stone-400">
                  500ms以上中央表示されたコースを分母に、CTA・Stripe・決済を商品別に追跡します。
                </p>
                <CoursePaywallTable plans={stats.coursePaywall.plans} />
              </div>
            )}
            {/* 商品別の売上内訳 (選択期間・全 payment_kind) */}
            {(stats.revenueByKind ?? []).length > 0 && (
              <div className="mt-6 border-t border-stone-100 pt-5">
                <p className="mb-1 text-sm font-black text-stone-900">
                  商品別売上
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-stone-400">
                  選択期間の全決済です。
                </p>
                <div className="overflow-x-auto rounded-lg border border-stone-200/80">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="bg-stone-50/90 text-stone-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">商品</th>
                        <th className="px-3 py-2.5 text-right font-medium">決済数</th>
                        <th className="px-3 py-2.5 text-right font-medium">総売上</th>
                        <th className="px-3 py-2.5 text-right font-medium">返金</th>
                        <th className="px-3 py-2.5 text-right font-medium">売上</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100/80">
                      {(() => {
                        const maxNet = Math.max(
                          1,
                          ...stats.revenueByKind.map((r) => r.netRevenueMinor),
                        );
                        return stats.revenueByKind.map((row) => (
                        <tr
                          key={`${row.kind}-${row.currency}`}
                          className="transition hover:bg-stone-50"
                        >
                          <td className="px-3 py-3" title={row.kind}>
                            <p className="font-semibold text-stone-700">
                              {PAYMENT_KIND_LABELS[row.kind] ?? row.kind}
                              {row.currency !== "jpy" && (
                                <span className="ml-1.5 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-stone-500">
                                  {row.currency}
                                </span>
                              )}
                            </p>
                            {/* 純売上のミニバー (最大商品=100%) */}
                            <span className="mt-1.5 block h-1.5 w-full max-w-[260px] overflow-hidden rounded bg-stone-100">
                              <span
                                className="block h-full rounded bg-teal-600"
                                style={{
                                  width: `${Math.max(
                                    row.netRevenueMinor > 0 ? 2 : 0,
                                    (row.netRevenueMinor / maxNet) * 100,
                                  )}%`,
                                }}
                              />
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-stone-600">
                            {row.purchases.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-stone-600">
                            {formatMoney(row.grossRevenueMinor, row.currency)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-rose-500">
                            {row.refundedMinor > 0
                              ? `−${formatMoney(row.refundedMinor, row.currency)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-black tabular-nums text-stone-900">
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
              <div className="mt-6 border-t border-stone-100 pt-5">
                <p className="mb-1 text-sm font-black text-stone-900">
                  日別売上
                </p>
                <p className="mb-4 text-[11px] leading-relaxed text-stone-400">
                  日ごとの売上です。新しい日が上です。
                </p>
                <div className="max-h-[420px] overflow-auto rounded-lg border border-stone-200/80">
                  <table className="w-full min-w-[520px] text-xs">
                    <thead className="sticky top-0 bg-stone-50/95 text-stone-500">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-medium">日付</th>
                        <th className="px-3 py-2.5 text-right font-medium">決済数</th>
                        <th className="px-3 py-2.5 text-right font-medium">売上</th>
                        <th className="px-3 py-2.5 text-right font-medium">返金</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100/80">
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
                          <tr key={day.date} className="transition hover:bg-stone-50">
                            <td className="px-3 py-2.5 font-semibold tabular-nums text-stone-700">
                              {day.date}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-stone-600">
                              {day.purchases.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-black tabular-nums text-stone-900">
                                {day.currencies
                                  .map((c) =>
                                    formatMoney(c.netRevenueMinor, c.currency),
                                  )
                                  .join(" / ")}
                              </span>
                              {/* その日の純売上ミニバー (最大日=100%) */}
                              <span className="ml-auto mt-1 block h-1.5 w-full max-w-[180px] overflow-hidden rounded bg-stone-100">
                                <span
                                  className="ml-auto block h-full rounded bg-sky-500"
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

          <section id="unmei" className="scroll-mt-36 xl:scroll-mt-28">
            <SectionHeader
              eyebrow="Unmei"
              title="運命の設計図"
              description="LP表示から購入、出生情報、鑑定表示まで"
              side={
                <div className="flex items-center gap-4 rounded-lg border border-indigo-100 bg-white px-4 py-3 shadow-[0_12px_30px_-26px_rgba(28,25,23,0.42)]">
                  <div>
                    <p className="text-[10px] font-bold text-indigo-700">運命売上</p>
                    <p className="text-lg font-black tabular-nums text-indigo-900">
                      {unmeiRevenueLabel}
                    </p>
                  </div>
                </div>
              }
            />
            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ReachSummaryCard
                label="LP表示"
                count={unmeiLpCount}
                rate={1}
                sub="運命の設計図ページの未購入LP表示"
                tone="indigo"
              />
              <ReachSummaryCard
                label="決済完了"
                count={unmeiPurchaseCount}
                rate={unmeiLpCount > 0 ? unmeiPurchaseCount / unmeiLpCount : 0}
                sub={`通常 ${stats.unmei.purchases.basic.toLocaleString()} / アップグレード ${stats.unmei.purchases.upgrade.toLocaleString()}`}
                tone="emerald"
              />
              <ReachSummaryCard
                label="出生情報保存"
                count={stats.unmei.birthForm.submitted}
                rate={stats.unmei.birthForm.submitRate}
                sub={`${stats.unmei.birthForm.viewed.toLocaleString()}表示 / ${stats.unmei.birthForm.skipped.toLocaleString()}スキップ`}
                tone="teal"
              />
              <ReachSummaryCard
                label="鑑定表示"
                count={unmeiReadingCount}
                rate={
                  stats.unmei.birthForm.submitted > 0
                    ? unmeiReadingCount / stats.unmei.birthForm.submitted
                    : 0
                }
                sub="生成完了後に鑑定を表示したセッション"
                tone="rose"
              />
            </div>
            <div>
              <Panel className="p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="rounded bg-indigo-600 px-3 py-1 text-[11px] font-black text-white">
                    運命の設計図
                  </span>
                  <span className="text-[11px] font-medium text-stone-400">
                    /unmei
                  </span>
                </div>
                <div className="mb-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-normal text-stone-400">
                  <span className="w-28 text-right">ステップ</span>
                  <span className="flex-1">件数</span>
                  <span className="w-16 text-right">前段比</span>
                </div>
                <div className="flex flex-col gap-2">
                  {stats.unmei.funnel.map((step, i) => (
                    <FunnelBar
                      key={step.label}
                      label={step.label}
                      count={step.count}
                      max={unmeiFunnelMax}
                      prevCount={
                        i > 0 ? stats.unmei.funnel[i - 1].count : undefined
                      }
                    />
                  ))}
                </div>
                <p className="mt-4 border-t border-stone-100 pt-4 text-[11px] leading-relaxed text-stone-400">
                  購入開始は専用イベントと既存の purchase_cta_clicked(page=unmei) を同一セッションで重複排除しています。
                </p>
              </Panel>
            </div>
          </section>

        {/* 本人コホートと友達側を分けた友達診断ファネル */}
          <section id="friend-funnel" className="scroll-mt-36 xl:scroll-mt-28">
            <SectionHeader
              eyebrow="Growth"
              title="友達・拡散"
              description="診断から友達回答、新しい診断が生まれるまでの成長ループを確認します"
              side={
                <div className="rounded-xl border border-[#b7dfc2] bg-[#e6f4ea] px-4 py-3">
                  <p className="text-[10px] font-medium text-[#137333]">拡散係数</p>
                  <p className="text-lg font-semibold tabular-nums text-[#0d652d]">
                    {!coreReady
                      ? "要DB更新"
                      : stats.coreKpis.viralCoefficient.denominator > 0
                        ? stats.coreKpis.viralCoefficient.value.toFixed(3)
                        : "—"}
                  </p>
                </div>
              }
            />
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <Panel className="p-4">
                <p className="text-[11px] font-medium text-[#5f6368]">診断 → 友達回答</p>
                {/* 概要カードと同じ headline 値を使う (コホート未確定時のイベントデータ
                    フォールバック込み)。coreKpis を直接読むと同一画面で数値が食い違う。 */}
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#1967d2]">
                  {pctOrDash(headlineFriendRate, headlineFriendDenominator)}
                </p>
                <p className="mt-2 text-[11px] text-[#80868b]">
                  {headlineFriendNumerator.toLocaleString()}人 / {headlineFriendDenominator.toLocaleString()}人
                </p>
              </Panel>
              <Panel className="p-4">
                <p className="text-[11px] font-medium text-[#5f6368]">購入者 → 友達回答</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#007b83]">
                  {coreReady
                    ? pctOrDash(stats.coreKpis.paidToFriend.rate, stats.coreKpis.paidToFriend.denominator)
                    : "要DB更新"}
                </p>
                <p className="mt-2 text-[11px] text-[#80868b]">
                  {coreReady
                    ? `${stats.coreKpis.paidToFriend.numerator.toLocaleString()}人 / ${stats.coreKpis.paidToFriend.denominator.toLocaleString()}人`
                    : "payment_history の更新が必要です"}
                </p>
              </Panel>
              <Panel className="p-4">
                <p className="text-[11px] font-medium text-[#5f6368]">招待から生まれた新規診断</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#137333]">
                  {stats.coreKpis.viralCoefficient.children.toLocaleString()}<span className="ml-1 text-sm">人</span>
                </p>
                <p className="mt-2 text-[11px] text-[#80868b]">
                  共有者あたり到達 {stats.viral.avgLandingPerSharer.toFixed(1)}人
                </p>
              </Panel>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel className="p-5 sm:p-6">
                <h3 className="text-sm font-black text-stone-800">本人側の到達</h3>
                <p className="mt-1 text-[11px] font-medium text-stone-500">
                  自己診断完了者を起点に、友達診断へどこまで進んだか。
                </p>
                <ol className="mt-5 flex flex-col gap-2.5">
                  {ownerFriendFunnel.map((step, index) => (
                    <ReachStepRow
                      key={step.key}
                      index={index}
                      label={step.label}
                      count={step.count}
                      max={ownerFriendFunnelMax}
                      rateFromBase={step.rateFromDiagnosis}
                      rateFromPrevious={step.rateFromPrevious}
                      baseLabel="診断比"
                      tone={index < 2 ? "teal" : index < 4 ? "rose" : "emerald"}
                    />
                  ))}
                </ol>
              </Panel>
              <Panel className="p-5 sm:p-6">
                <h3 className="text-sm font-black text-stone-800">友達側の拡散</h3>
                <p className="mt-1 text-[11px] font-medium text-stone-500">
                  招待ページ到達を起点に、友達が回答し、自分の診断へ進む流れ。
                </p>
                <ol className="mt-5 flex flex-col gap-2.5">
                  {visitorFriendFunnel.map((step, index) => (
                    <ReachStepRow
                      key={step.key}
                      index={index}
                      label={step.label}
                      count={step.count}
                      max={visitorFriendFunnelMax}
                      rateFromBase={step.rateFromLanding}
                      rateFromPrevious={step.rateFromPrevious}
                      baseLabel="到達比"
                      tone={index < 1 ? "indigo" : index < 3 ? "teal" : "emerald"}
                    />
                  ))}
                </ol>
              </Panel>
            </div>
            {/* 全期間表示だとサマリーの診断者数と桁が合わない理由 (計測開始日以降のみの
                コホート) をここで示す。消すと「データ欠損？」に見える。 */}
            <p className="mt-3 text-[11px] leading-relaxed text-stone-400">
              計測開始: {stats.friendDiagnosisFunnel.measurementStartedAt} / {stats.friendDiagnosisFunnel.cohortDefinition}
            </p>
          </section>

        {/* 流入元別 (2026-08-04 集客フォーカス): first-touch utm_source/ref → users.acquisition_source。
            外部リンクに ?ref=tiktok 等を付けた流入がここに並ぶ。数字は「流入元別の診断完了者」。 */}
          <section id="acquisition" className="scroll-mt-36 xl:scroll-mt-28">
            <SectionHeader
              eyebrow="Acquisition"
              title="流入・集客"
              description="新規診断を連れてきた媒体とキャンペーンを比較します"
              side={
                topAcquisitionSource ? (
                  <div className="rounded-xl border border-[#c2d7f5] bg-[#e8f0fe] px-4 py-3">
                    <p className="text-[10px] font-medium text-[#1967d2]">最多の流入元</p>
                    <p className="mt-1 max-w-44 truncate text-sm font-semibold text-[#174ea6]">
                      {topAcquisitionSource.source}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-[#3c4043]">
                      {topAcquisitionSource.users.toLocaleString()}人・{pct(topAcquisitionSource.share)}
                    </p>
                  </div>
                ) : null
              }
            />
            {stats.acquisitionStats.sources.length === 0 ? (
              <Panel>
                <p className="px-4 py-6 text-center text-xs font-medium text-stone-500">
                  期間内の新規ユーザーがいません
                </p>
              </Panel>
            ) : (
              <Panel className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-stone-50/90">
                    <tr className="border-b border-stone-100 text-left text-xs text-stone-500">
                      <th className="px-4 py-3 font-medium">流入元</th>
                      <th className="px-4 py-3 font-medium text-right">新規ユーザー</th>
                      <th className="px-4 py-3 font-medium text-right">構成比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.acquisitionStats.sources.map((s) => (
                      <tr key={s.source} className="border-b border-stone-100/70 transition last:border-0 hover:bg-stone-50">
                        <td className="px-4 py-3">
                          {s.source === stats.acquisitionStats.directLabel ? (
                            <span className="inline-block rounded bg-stone-100 px-2.5 py-1 text-xs font-mono font-bold text-stone-500">
                              {s.source}
                            </span>
                          ) : (
                            <span className="inline-block rounded bg-teal-50 px-2.5 py-1 text-xs font-mono font-bold text-teal-800">
                              {s.source}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{s.users.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-stone-500">{pct(s.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.acquisitionStats.campaigns.length > 0 && (
                  <div className="border-t border-stone-100 px-4 py-3">
                    <p className="text-[11px] font-bold text-stone-500">キャンペーン内訳 (utm_campaign / camp)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stats.acquisitionStats.campaigns.map((c) => (
                        <span
                          key={`${c.source}-${c.campaign}`}
                          className="inline-flex items-center gap-1.5 rounded border border-stone-200/80 bg-white px-2.5 py-1 text-xs font-medium text-stone-700"
                        >
                          <span className="font-mono font-bold text-teal-800">{c.source}</span>
                          <span className="text-stone-400">/</span>
                          <span className="font-mono">{c.campaign}</span>
                          <span className="tabular-nums font-bold">{c.users.toLocaleString()}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>
            )}
            {stats.campaignStats.length > 0 && (
              <Panel className="mt-4 overflow-x-auto">
                <div className="border-b border-[#eef1f5] px-4 py-3">
                  <h3 className="text-sm font-medium text-[#202124]">キャンペーン成果</h3>
                  <p className="mt-1 text-[11px] text-[#5f6368]">診断完了と友達回答までつながった件数</p>
                </div>
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-[#f8fafd]">
                    <tr className="border-b border-[#eef1f5] text-left text-xs text-[#5f6368]">
                      <th className="px-4 py-3 font-medium">キャンペーン</th>
                      <th className="px-4 py-3 text-right font-medium">診断完了</th>
                      <th className="px-4 py-3 text-right font-medium">友達回答</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.campaignStats.map((campaign) => (
                      <tr key={campaign.campaign} className="border-b border-[#eef1f5] last:border-0">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-[#1967d2]">{campaign.campaign}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{campaign.completed.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{campaign.friendCompleted.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
