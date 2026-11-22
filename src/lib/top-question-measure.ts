// トップの「1問目の小窓」の使われ方を、2026-11-23 (日本時間) の1日だけ計測する。
//   - 小窓を見た回数・閉じた回数 (閉じ方つき)
//   - トップ表示とボタン押下に、流入元 (x / tiktok / google など) を添える
// 1日だけにするのは本人の指定 (2026-11-22)。日付が変わると自動で送らなくなる。
// 後片付け: 11/24 以降はこのファイルと呼び出し箇所を消してよい。
//
// 小窓の表示・閉じるの記録には、新しいイベント名を足さず、今どこからも送られていない
// 既存の名前 (uranai_interstitial_view / uranai_interstitial_close) を借りる。
// イベント名はDBの受け口 (ingest_client_events) の許可リスト制で、名前を足すには
// 受け口の関数を丸ごと入れ替える必要があり、1日だけの計測には釣り合わないため。
// ほかの記録と混ざらないよう、必ず metadata.surface = "top_first_question" を付ける。
// この2つの名前が本番の受け口で許可されていることは、2026-11-22 に確認済み。
// それでも万一はじかれたときにトップ表示などの記録を巻き込まないよう、単独で送る (trackIsolated)。
import {
  parseAcquisitionFromSearch,
  readAcquisition,
  readReferrerHost,
  sourceFromReferrerHost,
  type Acquisition,
} from "@/lib/acquisition";
import { readAdAttribution } from "@/lib/ad-attribution";
import { trackIsolated } from "@/lib/track";

const MEASURE_DAY_JST = "2026-11-23";
const SURFACE = "top_first_question";

/** 今が計測日 (日本時間) かどうか。端末の時計で判定する。 */
export function isTopQuestionMeasureDay(now: number = Date.now()): boolean {
  // 日本時間 = UTC+9。toISOString は UTC なので、9時間進めてから日付部分を取る。
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) === MEASURE_DAY_JST;
}

// 受け口は 200 文字を超える文字列があると、同じ束の記録ごと捨てる。長い値は切って送る。
function clip(value: string | null | undefined): string | null {
  return value ? value.slice(0, 100) : null;
}

// 流入元を読むだけ (保存はしない)。診断完了時の保存 (resolveAcquisitionForSave) と同じ優先順だが、
// ここで保存まですると、あとで決まる流入元の結果を変えてしまうため、読み出しに限る。
function readAcquisitionForMeasure(): Acquisition {
  try {
    const fromUrl = parseAcquisitionFromSearch(window.location.search);
    if (fromUrl.source || fromUrl.campaign || fromUrl.medium) return fromUrl;
    const firstTouch = readAcquisition();
    if (firstTouch.source || firstTouch.campaign || firstTouch.medium) return firstTouch;
    const ad = readAdAttribution();
    if (ad.utmSource || ad.utmCampaign || ad.utmMedium) {
      return { source: ad.utmSource, campaign: ad.utmCampaign, medium: ad.utmMedium };
    }
    if (ad.ttclid) return { source: "tiktok", campaign: null, medium: "paid_social" };
    return { source: sourceFromReferrerHost(readReferrerHost()), campaign: null, medium: null };
  } catch {
    // 読めなければ流入元なしとして扱う
  }
  return { source: null, campaign: null, medium: null };
}

/** トップ表示・ボタン押下の記録に添える項目。計測日でなければ空。 */
export function topMeasureMetadata(): Record<string, unknown> {
  if (!isTopQuestionMeasureDay()) return {};
  const acq = readAcquisitionForMeasure();
  return {
    acqSource: clip(acq.source),
    acqMedium: clip(acq.medium),
    acqCampaign: clip(acq.campaign),
    // この訪問で小窓を見たか・閉じたか (ボタンから進んだ人が、小窓を見たあとだったかを分ける)
    questionShown: shownAt !== null,
    questionClosed: closed,
  };
}

let shownAt: number | null = null;
let closed = false;

/** 小窓を出したとき。 */
export function measureTopQuestionShown(): void {
  shownAt = performance.now();
  closed = false;
  if (!isTopQuestionMeasureDay()) return;
  const acq = readAcquisitionForMeasure();
  trackIsolated("uranai_interstitial_view", {
    surface: SURFACE,
    acqSource: clip(acq.source),
    acqMedium: clip(acq.medium),
  });
}

/** 小窓を答えずに閉じたとき。how = 閉じ方。 */
export function measureTopQuestionClosed(how: "button" | "backdrop" | "escape"): void {
  closed = true;
  if (!isTopQuestionMeasureDay()) return;
  trackIsolated("uranai_interstitial_close", {
    surface: SURFACE,
    how,
    // 小窓が出てから閉じるまでのミリ秒
    afterMs: shownAt === null ? null : Math.round(performance.now() - shownAt),
  });
}
