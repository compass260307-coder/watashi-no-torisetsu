"use client";

// /unmei 未購入LPの価格表示 + 購入CTA (2026-07-26 指示)。
// 完全版 (¥499 full_access) 保有者にはプレミアムへの差額 ¥400 を出し分ける。
// 価格の権威は統一Checkout APIであり、ここでの判定は表示用。
//
// 判定は BottomNav と同じ流儀:
//   - ログイン session の owner_token か localStorage の torisetsu_owner_token
//   - full 確認済み token は torisetsu_full_token にキャッシュ (即時反映)
//   - 未確認は /api/checkout/full-access-status で確認
// 判定できない/失敗時は通常価格 ¥899 のまま (安全側)。

import { useEffect, useState } from "react";
import { KoreanPurchaseLegalNotice } from "@/components/checkout/KoreanPurchaseLegalNotice";
import UnmeiCheckoutButton from "@/components/uranai/UnmeiCheckoutButton";
import type { ResultLocale } from "@/i18n/result";
import {
  FULL_ACCESS_PRICE_KRW,
  PREMIUM_BUNDLE_DISCOUNT_PERCENT_KRW,
  PREMIUM_BUNDLE_LIST_PRICE_KRW,
  PREMIUM_BUNDLE_PRICE_KRW,
} from "@/lib/access-products";

const OWNER_TOKEN_KEY = "torisetsu_owner_token";
const FULL_TOKEN_KEY = "torisetsu_full_token";

export default function UnmeiPriceCta({
  sessionOwnerToken,
  sessionHasFull,
  align = "start",
  variant = "full",
  launchChat = false,
  locale = "ja",
}: {
  /** ログイン済みならその owner_token (未ログインは null → localStorage を見る)。 */
  sessionOwnerToken: string | null;
  /** サーバで判定済みの完全版保有 (ログイン済みのときのみ true になり得る)。 */
  sessionHasFull: boolean;
  /** PC での寄せ。ヒーロー=start (左寄せ) / 最下部の締めCTA=center。 */
  align?: "start" | "center";
  /**
   * full: 大きな価格行 + 取り消し線/バッジ + ボタン + 返金保証 (ヒーロー用)。
   * compact: 「料金はわずか¥…です。」の一文 + ボタンのみ (締めCTA用。16P 参考)。
   */
  variant?: "full" | "compact";
  /** true = リダイレクトせず全画面チャット決済を起動する (チャット決済フロー)。 */
  launchChat?: boolean;
  locale?: ResultLocale;
}) {
  // チャット起動モードでは「作成する」文言、従来のリダイレクトは「続ける」。
  const ctaLabel =
    locale === "ko"
      ? launchChat
        ? "운명의 설계도 만들기 →"
        : "계속하기 →"
      : launchChat
        ? "設計図を作成する →"
        : "続ける →";
  const [ownerToken, setOwnerToken] = useState<string | null>(
    sessionOwnerToken,
  );
  const [hasFull, setHasFull] = useState(sessionHasFull);
  const koreanUpgradePrice = PREMIUM_BUNDLE_PRICE_KRW - FULL_ACCESS_PRICE_KRW;
  const fullPrice =
    locale === "ko" ? `₩${PREMIUM_BUNDLE_PRICE_KRW.toLocaleString("ko-KR")}` : "¥899";
  const upgradePrice =
    locale === "ko" ? `₩${koreanUpgradePrice.toLocaleString("ko-KR")}` : "¥400";
  const listPrice =
    locale === "ko" ? `₩${PREMIUM_BUNDLE_LIST_PRICE_KRW.toLocaleString("ko-KR")}` : "¥1,980";

  useEffect(() => {
    if (hasFull) return;
    let cancelled = false;
    let ownerTokenTimer: number | null = null;
    let token = sessionOwnerToken;
    try {
      if (!token) token = localStorage.getItem(OWNER_TOKEN_KEY);
      if (token && localStorage.getItem(FULL_TOKEN_KEY) === token) {
        const cachedToken = token;
        ownerTokenTimer = window.setTimeout(() => {
          if (cancelled) return;
          setOwnerToken(cachedToken);
          setHasFull(true);
        }, 0);
        return () => {
          cancelled = true;
          if (ownerTokenTimer !== null) window.clearTimeout(ownerTokenTimer);
        };
      }
    } catch {
      // localStorage 不可環境: 通常価格のまま
    }
    if (!token) return;
    const resolvedToken = token;
    ownerTokenTimer = window.setTimeout(() => {
      if (!cancelled) setOwnerToken(resolvedToken);
    }, 0);
    fetch(
      `/api/checkout/full-access-status?owner_token=${encodeURIComponent(resolvedToken)}`,
    )
      .then((r) => (r.ok ? r.json() : { full: false }))
      .then((d: { full?: boolean }) => {
        if (cancelled || !d?.full) return;
        setHasFull(true);
        try {
          localStorage.setItem(FULL_TOKEN_KEY, resolvedToken);
        } catch {
          // noop
        }
      })
      .catch(() => {
        // 判定失敗時は通常価格のまま (安全側)
      });
    return () => {
      cancelled = true;
      if (ownerTokenTimer !== null) window.clearTimeout(ownerTokenTimer);
    };
  }, [hasFull, sessionOwnerToken]);

  if (variant === "compact") {
    return (
      <>
        {!launchChat && (
          <p className="mt-1 text-[15px] font-bold text-[#2E2E5C]/65 md:text-[16px]">
            {locale === "ko"
              ? `요금은 ${hasFull ? upgradePrice : fullPrice}이에요.`
              : `料金はわずか ${hasFull ? upgradePrice : fullPrice} です。`}
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <UnmeiCheckoutButton
            ownerToken={ownerToken}
            launchChat={launchChat}
            tone="premium"
            locale={locale}
          >
            {ctaLabel}
          </UnmeiCheckoutButton>
        </div>
        {locale === "ko" ? (
          <KoreanPurchaseLegalNotice className="mx-auto mt-3 max-w-[620px] text-center" />
        ) : null}
      </>
    );
  }

  return (
    <>
      {/* 価格は入力前から明示し、ヒーローからCTAまでプレミアムのゴールドで統一する。 */}
      {hasFull ? (
        <div className="mt-4">
          <p className="text-[13px] font-bold text-[#2E2E5C]/45 line-through md:text-[14px]">
            {locale === "ko" ? `정가 ${fullPrice}` : `通常 ${fullPrice}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[40px] font-black leading-none tracking-[-0.03em] text-[#5B5BEF] md:text-[44px]">
              {upgradePrice}
            </p>
            <span className="inline-flex rounded-full bg-[#EEEEFF] px-3 py-1.5 text-[12px] font-black text-[#5B5BEF] md:text-[13px]">
              {locale === "ko" ? "완전판 사용자 한정" : "完全版ユーザー限定"}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-[13px] font-bold text-[#2E2E5C]/45 line-through md:text-[14px]">
            {locale === "ko" ? `정가 ${listPrice}` : `通常 ${listPrice}`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[40px] font-black leading-none tracking-[-0.03em] text-[#A36818] md:text-[44px]">
              {fullPrice}
            </p>
            <span className="inline-flex rounded-full bg-[#FFF1CB] px-3 py-1.5 text-[12px] font-black text-[#9A6117] md:text-[13px]">
              {locale === "ko"
                ? `출시 기념 ${PREMIUM_BUNDLE_DISCOUNT_PERCENT_KRW}% 할인 (8/31까지)`
                : "リリース記念 55%OFF（8/31まで）"}
            </span>
          </div>
        </div>
      )}
      <div
        className={`mt-4 flex ${align === "start" ? "" : "md:justify-center"}`}
      >
        <UnmeiCheckoutButton
          ownerToken={ownerToken}
          launchChat={launchChat}
          tone="premium"
          locale={locale}
        >
          {ctaLabel}
        </UnmeiCheckoutButton>
      </div>
      {locale === "ko" ? (
        <KoreanPurchaseLegalNotice
          className={`mt-3 max-w-[620px] ${align === "center" ? "mx-auto text-center" : "text-left"}`}
        />
      ) : null}
    </>
  );
}
