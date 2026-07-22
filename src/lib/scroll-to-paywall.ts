// PR3: ページ内のロック要素を押したとき、最下部の課金案内カード
// (FullAccessPromoCard, id="fullaccess-promo") へスムーズスクロールし、
// 着地を分かりやすくするため 1 回だけパルス(ハイライト)を付ける。
//
// ページ遷移・URL 変更はしない。同一ページ内のスクロール移動のみ。
// パルスの見た目は globals.css の .paywall-pulse (prefers-reduced-motion で無効)。
//
// ブラウザ専用 (onClick 等のイベントハンドラから呼ぶ前提)。SSR 側で呼ばれても no-op。
//
// 課金ファネル計測 (2026-07-13): 呼び出し = 「課金カードへの誘導クリック」なので、
// ここで paywall_scroll_clicked を一元計測する (metadata.source = どのUIか)。
// 呼び出し元は source を必ず渡すこと (未指定は "unknown" で記録)。

import { track } from "@/lib/track";
import {
  DIRECT_PAYWALL_SOURCE,
  normalizePaywallSource,
} from "@/lib/paywall-source";

const PAYWALL_ID = "fullaccess-promo";
const PULSE_CLASS = "paywall-pulse";
const PULSE_MS = 1300;
const LAST_SOURCE_KEY = "torisetsu_paywall_source_v1";
const LAST_SOURCE_TTL_MS = 30 * 60 * 1000;

// 「シーン別の注意点」(SceneCautionTeaser) のアンカー id。
export const SCENE_CAUTION_ID = "scene-caution";

type StoredPaywallSource = {
  source: string;
  page: string;
  at: number;
};

function currentPage(): string {
  return typeof window === "undefined" ? "" : window.location.pathname;
}

function rememberPaywallSource(source: string): void {
  if (typeof window === "undefined") return;
  const stored: StoredPaywallSource = {
    source: normalizePaywallSource(source),
    page: currentPage(),
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(LAST_SOURCE_KEY, JSON.stringify(stored));
  } catch {
    // ストレージが使えなくてもクリック計測と購入処理は継続する。
  }
}

// 購入 CTA が押された時点の最終タッチ導線。別ページの古い値は混ぜず、
// ロックカードを経由せず課金カードを直接押した場合は専用 source に寄せる。
export function getLastPaywallSource(): string {
  if (typeof window === "undefined") return DIRECT_PAYWALL_SOURCE;
  try {
    const raw = sessionStorage.getItem(LAST_SOURCE_KEY);
    if (!raw) return DIRECT_PAYWALL_SOURCE;
    const parsed = JSON.parse(raw) as Partial<StoredPaywallSource>;
    if (
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > LAST_SOURCE_TTL_MS ||
      parsed.page !== currentPage()
    ) {
      return DIRECT_PAYWALL_SOURCE;
    }
    return normalizePaywallSource(parsed.source);
  } catch {
    return DIRECT_PAYWALL_SOURCE;
  }
}

// ロック要素の「今すぐアクセス」等を押したときの共通ハンドラ。
// 2026-07-22: 最下部カードへのスクロールから「その場でモーダル表示」に変更。
//   - PaywallModal がページに存在する場合: カスタムイベントで開き、スクロールしない。
//   - モーダルが無いページ (フォールバック): 従来どおり targetId へスクロール+パルス。
// 計測 (paywall_scroll_clicked) と最終タッチ導線の記憶は挙動に関わらず共通で行う。
export const PAYWALL_OPEN_EVENT = "torisetsu:open-paywall";

export function scrollToPaywall(
  source: string = "unknown",
  targetId: string = PAYWALL_ID,
): void {
  if (typeof document === "undefined") return;
  const normalizedSource = normalizePaywallSource(source);
  rememberPaywallSource(normalizedSource);
  track("paywall_scroll_clicked", {
    metadata: {
      source: normalizedSource,
      target: targetId,
      page: window.location.pathname.split("/")[1] || "top",
    },
  });

  // モーダルを開く要求を発火。PaywallModal が拾ったら preventDefault し、
  // dispatchEvent は false を返す (= スクロールへフォールバックしない)。
  const openEvent = new CustomEvent(PAYWALL_OPEN_EVENT, {
    detail: { source: normalizedSource },
    cancelable: true,
  });
  const notHandled = window.dispatchEvent(openEvent);
  if (!notHandled) return;

  // フォールバック: モーダルが無いページは従来のスクロール+パルス。
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // 再トリガー時にアニメを確実に再生させるため一旦外してから付け直す。
  el.classList.remove(PULSE_CLASS);
  // reflow を挟んで add (連打でもパルスが復活する)
  void el.offsetWidth;
  el.classList.add(PULSE_CLASS);
  window.setTimeout(() => el.classList.remove(PULSE_CLASS), PULSE_MS);
}
