// 社内向け数値画面 (/internal/numbers) の型と、表示用の計算。
//
// 数字そのものは DB 関数 internal_numbers_dashboard が数えて返す
// (supabase/migrations/20261122140000_internal_numbers_dashboard.sql)。
// ここは受け取った値の足し算と割り算だけを行う。サーバーとクライアントの両方から
// 読むので、サーバー専用・クライアント専用の API は置かない。

export interface NumbersHourEvents {
  started: number;
  completed: number;
  result_viewed: number;
  paywall_card: number;
  paywall_modal: number;
  cta: number;
  checkout: number;
  paid: number;
  paid_full: number;
  tako_viewed: number;
  invite_clicked: number;
  friend_landing: number;
  friend_completed: number;
  friend_to_self: number;
  tako_paywall: number;
  tako_cta: number;
  tako_checkout: number;
  tako_paid: number;
  share_clicked: number;
}

export interface NumbersHour {
  h: number;
  diagnoses: number;
  ad_diagnoses: number;
  gross: number;
  refunded: number;
  net: number;
  purchases: number;
  purchases_full: number;
  purchases_upgrade: number;
  events: NumbersHourEvents;
}

export interface NumbersSubtotal {
  diagnoses: number;
  ad_diagnoses: number;
  gross: number;
  refunded: number;
  net: number;
  purchases: number;
  purchases_full: number;
  purchases_upgrade: number;
}

export interface NumbersSource {
  source: string;
  is_ad: boolean;
  diagnoses: number;
  purchasers: number;
  net: number;
}

export interface NumbersDayBlock {
  day: string;
  hours: NumbersHour[];
  /** 今日なら現在時刻まで、比較日なら同じ経過時間までの小計。 */
  until_cut: NumbersSubtotal;
  cohort: { diagnosers: number; friend_owners: number; sharers: number };
  /** イベント名 → その日の重複を除いたセッション数。 */
  sessions: Record<string, number>;
  sources: NumbersSource[];
}

export interface NumbersPayload {
  meta: {
    generated_at: string;
    locale: string;
    day: string;
    compare_day: string;
    is_today: boolean;
    elapsed_seconds: number;
    events_through: string | null;
    compare_events_through: string | null;
    /**
     * ファネル (イベント) の集計が済んでいるか。古い日は 1 回の呼び出しで数え切れない
     * ことがあり、そのときは false。もう一度呼ぶと続きから数える。
     */
    events_complete?: boolean;
    compare_events_complete?: boolean;
    duration_ms: number;
  };
  day: NumbersDayBlock;
  compare: NumbersDayBlock;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
/** これより前の日は受け付けない (古い日を初めて開くと 1 日分を数え直すため)。 */
export const NUMBERS_EARLIEST_DAY = "2026-01-01";

/** ファネルの集計がまだ途中か (表示日・比較日のどちらか)。 */
export function isNumbersCatchingUp(payload: NumbersPayload): boolean {
  return (
    payload.meta.events_complete === false ||
    payload.meta.compare_events_complete === false
  );
}

/** YYYY-MM-DD として実在する日付か。 */
export function isValidNumbersDay(
  value: string | null | undefined,
): value is string {
  if (!value) return false;
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= NUMBERS_EARLIEST_DAY
  );
}

/** YYYY-MM-DD に日数を足す (暦の計算だけ。時刻・タイムゾーンは関係しない)。 */
export function shiftNumbersDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 今の JST の日付 (YYYY-MM-DD)。 */
export function todayInJst(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 分母が 0 のときは null (0% と「計算できない」を区別する)。 */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function sumHours(
  hours: NumbersHour[],
  pick: (hour: NumbersHour) => number,
): number {
  return hours.reduce((total, hour) => total + pick(hour), 0);
}

export function sumEvents(
  hours: NumbersHour[],
  key: keyof NumbersHourEvents,
): number {
  return hours.reduce((total, hour) => total + hour.events[key], 0);
}

/** 上部に並べる主要指標。 */
export type HeadlineKey =
  | "diagnoses"
  | "net"
  | "purchases_full"
  | "purchase_rate"
  | "net_per_diagnosis";

/** 指標の計算に使う数字。1 時間分 (NumbersHour) にも小計 (NumbersSubtotal) にもある。 */
type HeadlineAmounts = Pick<
  NumbersSubtotal,
  "diagnoses" | "net" | "purchases_full"
>;

export interface HeadlineDefinition {
  key: HeadlineKey;
  label: string;
  /** グラフの見出しに添える、数え方の一言。 */
  hint: string;
  kind: "count" | "yen" | "rate" | "yen_decimal";
  /** 分子。分母が無い指標は、これがそのまま値になる。 */
  numerator: (amounts: HeadlineAmounts) => number;
  /** 率や単価の分母。足し上げるときは分子と分母を別々に足してから割る。 */
  denominator?: (amounts: HeadlineAmounts) => number;
}

export const HEADLINES: HeadlineDefinition[] = [
  {
    key: "diagnoses",
    label: "診断数",
    hint: "診断を完了した人数",
    kind: "count",
    numerator: (x) => x.diagnoses,
  },
  {
    key: "net",
    label: "純売上",
    hint: "購入時刻で計上し、返金を引いた金額",
    kind: "yen",
    numerator: (x) => x.net,
  },
  {
    key: "purchases_full",
    label: "買い切り",
    hint: "完全版の購入件数",
    kind: "count",
    numerator: (x) => x.purchases_full,
  },
  {
    key: "purchase_rate",
    label: "課金率",
    hint: "買い切り ÷ 診断数",
    kind: "rate",
    numerator: (x) => x.purchases_full,
    denominator: (x) => x.diagnoses,
  },
  {
    key: "net_per_diagnosis",
    label: "診断あたり売上",
    hint: "純売上 ÷ 診断数",
    kind: "yen_decimal",
    numerator: (x) => x.net,
    denominator: (x) => x.diagnoses,
  },
];

export function headlineValue(
  definition: HeadlineDefinition,
  amounts: HeadlineAmounts,
): number | null {
  return definition.denominator
    ? ratio(definition.numerator(amounts), definition.denominator(amounts))
    : definition.numerator(amounts);
}

export type HeadlineSeriesMode = "hourly" | "cumulative";

/**
 * グラフ用の 24 個の値。lastHour より先 (まだ来ていない時間帯) は null。
 * 累計は、その時間帯の終わりまでを足したもの。率と単価は、分子と分母を別々に足してから割る。
 */
export function headlineSeries(
  definition: HeadlineDefinition,
  hours: NumbersHour[],
  mode: HeadlineSeriesMode,
  lastHour: number,
): (number | null)[] {
  let numerator = 0;
  let denominator = 0;
  return hours.map((hour) => {
    if (hour.h > lastHour) return null;
    if (mode === "hourly") return headlineValue(definition, hour);
    numerator += definition.numerator(hour);
    if (!definition.denominator) return numerator;
    denominator += definition.denominator(hour);
    return ratio(numerator, denominator);
  });
}

const countFormat = new Intl.NumberFormat("ja-JP");

export function formatNumbersValue(
  value: number | null,
  kind: HeadlineDefinition["kind"],
): string {
  if (value === null || !Number.isFinite(value)) return "–";
  if (kind === "count") return countFormat.format(value);
  if (kind === "yen") return `¥${countFormat.format(Math.round(value))}`;
  if (kind === "yen_decimal") return `¥${value.toFixed(2)}`;
  return `${(value * 100).toFixed(2)}%`;
}

export interface NumbersDelta {
  /** 符号なしの大きさ。"5.9%" や "0.03pt"。 */
  text: string;
  direction: "up" | "down" | "flat";
}

/**
 * 比較日との差。数と金額は増減率 (%)、率はポイント差 (pt)。
 * 比べられないとき (どちらかが無い、比較日が 0) は null。
 */
export function numbersDelta(
  current: number | null,
  previous: number | null,
  kind: HeadlineDefinition["kind"],
): NumbersDelta | null {
  if (current === null || previous === null) return null;
  if (kind !== "rate" && previous === 0) return null;
  const change =
    kind === "rate"
      ? (current - previous) * 100
      : ((current - previous) / previous) * 100;
  const digits = kind === "rate" ? 2 : 1;
  const rounded = Number(Math.abs(change).toFixed(digits));
  return {
    text: `${rounded.toFixed(digits)}${kind === "rate" ? "pt" : "%"}`,
    direction: rounded === 0 ? "flat" : change > 0 ? "up" : "down",
  };
}

/** "2026-11-22" → "11/22(日)"。 */
export function formatNumbersDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const weekday = "日月火水木金土"[date.getUTCDay()];
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${weekday})`;
}

/** ISO 時刻 → JST の "13:21"。 */
export function formatNumbersClock(iso: string): string {
  const date = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${date.getUTCHours()}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}
