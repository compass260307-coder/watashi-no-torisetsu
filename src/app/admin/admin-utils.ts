import type { Preset, Stats } from "./admin-types";
import {
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  PREMIUM_BUNDLE_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_KRW,
  SELF_REPORT_PRICE_JPY,
  SELF_REPORT_PRICE_KRW,
} from "@/lib/access-products";

export const PRESETS: { key: Preset; label: string; shortLabel: string }[] = [
  { key: "today", label: "今日", shortLabel: "今日" },
  { key: "yesterday", label: "昨日", shortLabel: "昨日" },
  { key: "7d", label: "過去7日", shortLabel: "7日" },
  { key: "30d", label: "過去30日", shortLabel: "30日" },
  { key: "all", label: "全期間", shortLabel: "全期間" },
  { key: "custom", label: "日付指定", shortLabel: "指定" },
];

export const PAYMENT_KIND_LABELS: Record<string, string> = {
  self_report: "学生向けライト",
  full_access: "完全版",
  premium_bundle: "全部入り",
  unmei: "運命の設計図",
  unmei_upgrade: "運命アップグレード",
  tako_unlock: "旧 友達診断",
  perception_unlock: "友達個別",
  integrated_trisetsu: "旧 統合トリセツ",
  unknown: "不明",
};

type CourseProduct = "self_report" | "full_access" | "premium_bundle";

export const COURSE_LABELS: Record<CourseProduct, string> = {
  self_report: `学生向け ¥${SELF_REPORT_PRICE_JPY.toLocaleString("ja-JP")}`,
  full_access: `完全版 ¥${FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")}`,
  premium_bundle: `全部入り ¥${PREMIUM_BUNDLE_PRICE_JPY.toLocaleString("ja-JP")}`,
};

export const KO_COURSE_LABELS: Record<CourseProduct, string> = {
  self_report: `ライト ₩${SELF_REPORT_PRICE_KRW.toLocaleString("ko-KR")}`,
  full_access: `完全版 ₩${FULL_ACCESS_PRICE_KRW.toLocaleString("ko-KR")}`,
  premium_bundle: `プレミアム ₩${PREMIUM_BUNDLE_PRICE_KRW.toLocaleString("ko-KR")}`,
};

const ZERO_DECIMAL_CURRENCIES = new Set(["jpy", "krw"]);
const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(minor: number, currency: string): string {
  const normalized = currency.toLowerCase();
  const amount = ZERO_DECIMAL_CURRENCIES.has(normalized) ? minor : minor / 100;
  const digits = Number.isInteger(amount) ? 0 : 1;
  try {
    const key = `${normalized}:${digits}`;
    let formatter = moneyFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: normalized.toUpperCase(),
        maximumFractionDigits: digits,
      });
      moneyFormatters.set(key, formatter);
    }
    return formatter.format(amount);
  } catch {
    return `${normalized.toUpperCase()} ${amount.toFixed(digits)}`;
  }
}

export function formatRevenue(
  currencies: { currency: string; netRevenueMinor: number }[],
): string {
  if (currencies.length === 0) return formatMoney(0, "jpy");
  return currencies
    .map((row) => formatMoney(row.netRevenueMinor, row.currency))
    .join(" / ");
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function toLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPresetRange(
  preset: Preset,
): { from: string; to: string } | null {
  if (preset === "all") return null;
  const now = new Date();
  const to = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
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

export function getCustomRange(
  fromValue: string,
  toValue: string,
): { from: string; to: string } | null {
  if (!fromValue || !toValue) return null;
  const fromDate = new Date(`${fromValue}T00:00:00`);
  const toDate = new Date(`${toValue}T00:00:00`);
  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    fromDate > toDate
  ) {
    return null;
  }
  toDate.setHours(23, 59, 59, 999);
  return { from: fromDate.toISOString(), to: toDate.toISOString() };
}

export function rangeFor(
  preset: Preset,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  return preset === "custom"
    ? getCustomRange(customFrom, customTo)
    : getPresetRange(preset);
}

export function previousRangeFor(
  preset: Preset,
  customFrom: string,
  customTo: string,
): { from: string; to: string; label: string } | null {
  const current = rangeFor(preset, customFrom, customTo);
  if (!current || preset === "all") return null;
  const currentFrom = new Date(current.from);
  const currentTo = new Date(current.to);
  const duration = currentTo.getTime() - currentFrom.getTime() + 1;
  const to = new Date(currentFrom.getTime() - 1);
  const from = new Date(to.getTime() - duration + 1);
  const label = preset === "today" ? "昨日" : preset === "yesterday" ? "一昨日" : "前期間";
  return { from: from.toISOString(), to: to.toISOString(), label };
}

export function periodLabel(
  preset: Preset,
  customFrom: string,
  customTo: string,
): string {
  if (preset === "all") return "初回計測から現在まで";
  const range = rangeFor(preset, customFrom, customTo);
  if (!range) return "日付を確認してください";
  const format = (value: string) =>
    new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(new Date(value));
  return toLocalDate(new Date(range.from)) === toLocalDate(new Date(range.to))
    ? format(range.from)
    : `${format(range.from)} 〜 ${format(range.to)}`;
}

export function buildStatsUrl(
  range: { from: string; to: string } | null,
  fresh = false,
  locale?: "ja" | "ko",
): string {
  const params = new URLSearchParams();
  if (range) {
    params.set("from", range.from);
    params.set("to", range.to);
  }
  if (fresh) params.set("fresh", "1");
  if (locale) params.set("locale", locale);
  const query = params.toString();
  return `/api/admin/stats${query ? `?${query}` : ""}`;
}

export function getHeadlines(stats: Stats) {
  const coreReady = stats.coreKpis.dataQuality.ready;
  const fallbackDiagnosis = stats.diagnosisCompleted ?? 0;
  const diagnosisUsers =
    coreReady &&
    (stats.coreKpis.cohort.diagnosisUsers > 0 || fallbackDiagnosis === 0)
      ? stats.coreKpis.cohort.diagnosisUsers
      : fallbackDiagnosis;
  const currencies = stats.coreKpis.periodRevenue.currencies ?? [];
  const payers =
    stats.coreKpis.periodRevenue.uniquePayers ??
    currencies.reduce((sum, item) => sum + item.payers, 0);
  const purchases = currencies.reduce((sum, item) => sum + item.purchases, 0);
  const refunds = currencies.map((item) => ({
    currency: item.currency,
    amount: item.refundedMinor,
  }));
  const friendRate = stats.coreKpis.diagnosisToFriend.denominator > 0
    ? stats.coreKpis.diagnosisToFriend.rate
    : 0;
  const paidRate = stats.coreKpis.diagnosisToPaid.denominator > 0
    ? stats.coreKpis.diagnosisToPaid.rate
    : 0;
  return {
    diagnosisUsers,
    currencies,
    revenue: formatRevenue(currencies),
    payers,
    purchases,
    refunds,
    friendRate,
    paidRate,
    arpu: formatRevenue(stats.coreKpis.arpu.currencies ?? []),
  };
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function downloadStatsCsv(stats: Stats, preset: Preset): void {
  const rows: (string | number)[][] = [
    ["ワタシのトリセツ 管理統計"],
    ["指標", "値"],
    ["自己診断完了", getHeadlines(stats).diagnosisUsers],
    ["純売上", getHeadlines(stats).revenue],
    ["購入者", getHeadlines(stats).payers],
    ["診断→購入率", pct(getHeadlines(stats).paidRate)],
    ["診断→友達回答率", pct(getHeadlines(stats).friendRate)],
    ["拡散係数", stats.coreKpis.viralCoefficient.value.toFixed(3)],
    [],
    ["自己診断完了の日別推移"],
    ["日付", "人数"],
    ...stats.coreKpis.diagnosisTrend.points.map((point) => [point.date, point.count]),
    [],
    ["購入ファネル"],
    ["ステップ", "件数"],
    ...(stats.paywallFunnel ?? []).map((step) => [step.label, step.count]),
    [],
    ["商品別売上"],
    ["商品", "通貨", "決済数", "総売上", "返金", "純売上"],
    ...(stats.revenueByKind ?? []).map((item) => [
      PAYMENT_KIND_LABELS[item.kind] ?? item.kind,
      item.currency.toUpperCase(),
      item.purchases,
      item.grossRevenueMinor,
      item.refundedMinor,
      item.netRevenueMinor,
    ]),
    [],
    ["運命の設計図"],
    ["指標", "値"],
    ["運命導線売上", formatRevenue(stats.unmei.revenue.currencies)],
    ["決済完了", stats.unmei.purchases.total],
    ["現行コース決済", stats.unmei.purchases.current],
    ["現行プレミアム決済", stats.unmei.purchases.premium],
    ["旧商品決済", stats.unmei.purchases.legacy],
    [],
    ["設計図チャット導線"],
    ["ステップ", "件数"],
    ...stats.unmei.chatFunnel.map((step) => [step.label, step.count]),
    [],
    ["運命ナビロック導線"],
    ["ステップ", "件数"],
    ...stats.unmei.navigationFunnel.map((step) => [step.label, step.count]),
    [],
    ["Alice"],
    ["指標", "値"],
    ["Alice導線売上", formatRevenue(stats.alice.revenue.currencies)],
    ["購入カード表示", stats.alice.cardViewers],
    ["購入CTA", stats.alice.ctaClickers],
    ["Stripe到達", stats.alice.stripeReached],
    ["決済完了", stats.alice.purchases],
    ["購入者", stats.alice.purchasers],
    ["ページ閲覧セッション", stats.alice.pageViews],
    ["利用ユーザー", stats.alice.activeUsers],
    ["メッセージ送信", stats.alice.messageActions],
    ["応答完了", stats.alice.responsesCompleted],
    ["応答失敗", stats.alice.responsesFailed],
    ["応答成功率", pct(stats.alice.responseSuccessRate)],
    ["付与回数", stats.alice.credits.total],
    ["残り回数", stats.alice.credits.remaining],
    [],
    ["流入元"],
    ["流入元", "新規ユーザー", "構成比"],
    ...(stats.acquisitionStats?.sources ?? []).map((source) => [
      source.source,
      source.users,
      pct(source.share),
    ]),
  ];
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `torisetsu_stats_${preset}_${toLocalDate(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
