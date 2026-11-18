// Alice ページ上部の「Alice / 占星術 / タロット」切り替え (2026-11-19)。
// 下部ナビから占星術・タロットのタブを外し、Alice の中から選ぶ形にした。
// 未購入の占いを選んだときは、下部ナビ (BottomNav) が持つ課金カード /
// 診断案内をそのまま開くため、このイベントで BottomNav に依頼する。

export type FortuneLockTarget = "unmei" | "tarot";

export const FORTUNE_LOCK_REQUEST_EVENT = "wt_fortune_lock_request_v1";

export type FortuneLockRequestDetail = {
  target: FortuneLockTarget;
  /** 課金カードの計測用 source (paywall_scroll_clicked / ctaSource)。 */
  source: string;
};

export function requestFortuneLock(detail: FortuneLockRequestDetail) {
  window.dispatchEvent(
    new CustomEvent<FortuneLockRequestDetail>(FORTUNE_LOCK_REQUEST_EVENT, {
      detail,
    }),
  );
}
