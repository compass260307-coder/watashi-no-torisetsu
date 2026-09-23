"use client";

// 決済直後の各success URLで、webhook反映を待つオーバーレイ。
//
// 背景: Stripe 決済 → success_url (/{me|tako}/{token}?paid=1) に着地するが、plan='full' を
//   付けるのは webhook で非同期。着地した瞬間はまだ未反映のことがあり、そのままだと
//   「払ったのに課金カード(ロック)が再表示」→ 再購入(二重課金)や離脱を招く。
//
// このコンポーネントは「?paid=1 かつ まだ未反映 (ロック中)」のときだけ親がマウントし、
//   全画面「決済処理中…」を出しつつ status API をポーリング。完全版系は下部バーの
//   Alice・運命・タロットがすべて解放されてから paid= を外した URL に置き換えて再描画する。
//   一定時間で反映されなければ手動再読み込み導線を表示する。

import { useEffect, useState } from "react";
import type { AppResultLocale } from "@/i18n/result";
import type { AccessProduct } from "@/lib/access-products";

const NAVY = "#2E2E5C";
// ポーリングは 2 秒から始めて徐々に間隔を広げる (×1.5、上限 10 秒)。
// webhook は通常数秒で反映されるため序盤は素早く確認し、後半を疎にして
// Function 呼び出し回数を約半分 (20回→10回) に抑えつつ、待ち受けは約60秒に延ばす。
const FIRST_DELAY_MS = 1200;
const INITIAL_POLL_INTERVAL_MS = 2000;
const POLL_BACKOFF_FACTOR = 1.5;
const MAX_POLL_INTERVAL_MS = 10_000;
const MAX_TRIES = 10; // 累計 約 60 秒

// 反映後 (またはタイムアウト後の手動再読込) の戻し先 URL。
//   me/tako: /{me|tako}/{token} (paid= を外した canonical URL)。
//   aisho/unmei: token パスを持たないため、現URLから paid/session_id だけ外す
//          (aishoのペア ?a=&b= は維持 → 解錠済みの本文をそのまま出す)。
function unlockedUrl(
  returnTo: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot",
  ownerToken: string,
  locale: AppResultLocale,
): string {
  if (
    returnTo === "aisho" ||
    returnTo === "unmei" ||
    returnTo === "hoshiyomi" ||
    returnTo === "tarot"
  ) {
    const url = new URL(window.location.href);
    url.searchParams.delete("paid");
    url.searchParams.delete("session_id");
    return url.toString();
  }
  const prefix = locale === "ko" ? "/ko" : locale === "en" ? "/en" : locale === "id" ? "/id" : "";
  return `${prefix}/${returnTo}/${ownerToken}`;
}

export function PaidUnlockWatcher({
  ownerToken,
  locale = "ja",
  returnTo = "me",
  product = "full_access",
}: {
  ownerToken: string;
  locale?: AppResultLocale;
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi" | "tarot";
  product?: AccessProduct;
}) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let pollDelay = INITIAL_POLL_INTERVAL_MS;

    const reloadUnlocked = () => {
      // paid= を外した URL に置換 (履歴を汚さない)。必要な権限がすべて
      // 反映済みなので、再読込後は本文と下部バーを解放済みで表示できる。
      window.location.replace(unlockedUrl(returnTo, ownerToken, locale));
    };

    const poll = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const res = await fetch(
          `/api/checkout/full-access-status?owner_token=${encodeURIComponent(ownerToken)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data = (await res.json()) as {
            full?: boolean;
            selfReport?: boolean;
            premiumBundle?: boolean;
            astrologer?: boolean;
            unmei?: boolean;
            tarot?: boolean;
          };
          const allBottomNavAccessGranted =
            data.astrologer === true &&
            data.unmei === true &&
            data.tarot === true;
          const unlocked =
            product === "full_access" || product === "premium_bundle"
              ? allBottomNavAccessGranted
              : returnTo === "tarot"
              ? data.tarot
              : returnTo === "aisho"
              ? data.full
              : product === "self_report"
                ? data.selfReport
                : data.full;
          if (unlocked) {
            reloadUnlocked();
            return;
          }
        }
      } catch {
        // ネットワーク一時失敗は無視して次のポーリングへ
      }
      if (cancelled) return;
      if (tries >= MAX_TRIES) {
        setTimedOut(true);
        return;
      }
      window.setTimeout(poll, pollDelay);
      pollDelay = Math.min(
        Math.round(pollDelay * POLL_BACKOFF_FACTOR),
        MAX_POLL_INTERVAL_MS,
      );
    };

    const first = window.setTimeout(poll, FIRST_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
    };
  }, [locale, ownerToken, product, returnTo]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-8 text-center"
      style={{ background: "rgba(255,255,255,0.96)" }}
      role="status"
      aria-live="polite"
    >
      {!timedOut ? (
        <>
          {/* スピナー */}
          <div
            aria-hidden="true"
            className="mb-5 h-10 w-10 animate-spin rounded-full border-4 border-[#E3E6F5]"
            style={{ borderTopColor: NAVY }}
          />
          <p
            className="text-[17px] font-black leading-[1.6]"
            style={{ color: NAVY }}
          >
            {locale === "ko"
              ? "결제를 반영하고 있어요…"
              : locale === "en"
                ? "Finalizing your purchase…"
                : "決済処理中です…"}
          </p>
          <p className="mt-1.5 text-[13px] font-bold leading-[1.7] text-[#8A8AA3]">
            {locale === "ko" ? (
              <>잠금 해제를 반영하고 있어요.<br />완료되면 자동으로 열립니다.</>
            ) : locale === "en" ? (
              <>We’re unlocking your Complete Edition.<br />This page will open automatically.</>
            ) : (
              <>
                {product === "self_report"
                  ? "自己診断と自己分析PDFの解放まで、もう少しお待ちください。"
                  : product === "premium_bundle"
                    ? "すべての機能と専属占い師チャットの解放まで、もう少しお待ちください。"
                    : "完全版機能の解放まで、もう少しお待ちください。"}
                <br />自動でひらきます。
              </>
            )}
          </p>
        </>
      ) : (
        <>
          <p
            className="text-[17px] font-black leading-[1.6]"
            style={{ color: NAVY }}
          >
            {locale === "ko"
              ? "반영에 조금 시간이 걸리고 있어요"
              : locale === "en"
                ? "This is taking a little longer than usual"
                : "反映に少し時間がかかっています"}
          </p>
          <p className="mt-1.5 text-[13px] font-bold leading-[1.7] text-[#8A8AA3]">
            {locale === "ko"
              ? "결제는 완료됐어요. 몇 분 뒤 다시 확인해 주세요."
              : locale === "en"
                ? "Your payment is complete. Please check again in a few minutes."
                : "決済は完了しています。数分後にもう一度お試しください。"}
          </p>
          <button
            type="button"
            onClick={() =>
              window.location.replace(unlockedUrl(returnTo, ownerToken, locale))
            }
            className="mt-6 inline-flex items-center justify-center rounded-full px-8 py-3 text-[15px] font-black text-white"
            style={{ background: NAVY }}
          >
            {locale === "ko" ? "새로고침" : locale === "en" ? "Refresh" : "再読み込み"}
          </button>
        </>
      )}
    </div>
  );
}
