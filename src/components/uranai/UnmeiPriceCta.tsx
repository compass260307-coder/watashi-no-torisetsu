"use client";

// /unmei 未購入LPの購入CTA (従来導線では価格も表示)。
// 日本版・韓国版とも、未購入者には現行の完全版を販売する。
// 運命の設計図を含まない旧完全版保有者にはプレミアムへの差額を出し分ける。
// 価格の権威は統一Checkout APIであり、ここでの判定は表示用。
//
// 判定は BottomNav と同じ流儀:
//   - ログイン session の owner_token か localStorage の torisetsu_owner_token
//   - full 確認済み token は torisetsu_full_token にキャッシュ (即時反映)
//   - 未確認は /api/checkout/full-access-status で確認
// 判定できない/失敗時は日本版の現行完全版価格のまま (安全側)。

import { useEffect, useState } from "react";
import {
  CheckoutCancelledModal,
  useCheckoutCancelledProduct,
} from "@/components/checkout/CheckoutCancelledNotice";
import { KoreanPurchaseLegalNotice } from "@/components/checkout/KoreanPurchaseLegalNotice";
import UnmeiCheckoutButton from "@/components/uranai/UnmeiCheckoutButton";
import type { ResultLocale } from "@/i18n/result";
import {
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  PREMIUM_BUNDLE_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_KRW,
} from "@/lib/access-products";
import { requestFullAccessStatus } from "@/lib/use-course-navigation-access";

const OWNER_TOKEN_KEY = "torisetsu_owner_token";
const FULL_TOKEN_KEY = "torisetsu_full_token";

export default function UnmeiPriceCta({
  sessionOwnerToken,
  sessionHasFull,
  align = "start",
  variant = "full",
  launchChat = false,
  locale = "ja",
  previewMode = false,
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
  /** devプレビューでは計測・決済APIを実行しない。 */
  previewMode?: boolean;
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
  const cancelledProduct = useCheckoutCancelledProduct();
  const purchaseProduct = hasFull ? "premium_bundle" : "full_access";
  const standardPrice =
    locale === "ko"
      ? `₩${FULL_ACCESS_PRICE_KRW.toLocaleString("ko-KR")}`
      : `¥${FULL_ACCESS_PRICE_JPY.toLocaleString("ja-JP")}`;
  const upgradePrice =
    locale === "ko"
      ? `₩${(PREMIUM_BUNDLE_PRICE_KRW - FULL_ACCESS_PRICE_KRW).toLocaleString("ko-KR")}`
      : `¥${(PREMIUM_BUNDLE_PRICE_JPY - FULL_ACCESS_PRICE_JPY).toLocaleString("ja-JP")}`;
  const showUpgradePrice = hasFull;

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
    void requestFullAccessStatus(resolvedToken)
      .then((d) => {
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
              ? `요금은 ${showUpgradePrice ? upgradePrice : standardPrice}이에요.`
              : `料金はわずか ${showUpgradePrice ? upgradePrice : standardPrice} です。`}
          </p>
        )}
        <div className="mt-6 flex justify-center">
          <UnmeiCheckoutButton
            ownerToken={ownerToken}
            product={purchaseProduct}
            launchChat={launchChat}
            tone="premium"
            locale={locale}
            previewMode={previewMode}
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
    <div id="unmei-purchase">
      {cancelledProduct === purchaseProduct && !launchChat ? (
        <CheckoutCancelledModal
          locale={locale}
          courseName={
            locale === "ko"
              ? purchaseProduct === "full_access"
                ? "완전판 코스"
                : "프리미엄 코스"
              : purchaseProduct === "full_access"
                ? "完全版"
                : "全部入り・買い切り"
          }
          imageSrc="/pricing/premium-destiny-felt-transparent.png"
          retryAction={
            <UnmeiCheckoutButton
              ownerToken={ownerToken}
              product={purchaseProduct}
              tone="premium"
              locale={locale}
              previewMode={previewMode}
            >
              {locale === "ko"
                ? "같은 코스로 다시 결제하기"
                : "同じコースでもう一度決済する"}
            </UnmeiCheckoutButton>
          }
        />
      ) : null}
      {!launchChat && (showUpgradePrice ? (
        <div className="mt-4">
          <p className="text-[13px] font-bold text-[#2E2E5C]/55 md:text-[14px]">
            {locale === "ko" ? "완전판 코스 구매 완료" : "完全版コース購入済み"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* 価格は Noto Sans JP/KR の 700 + tabular-nums (M PLUS は撤回 2026-09-04)。 */}
            <p className="text-[40px] font-bold tabular-nums leading-none tracking-[-0.03em] text-[#5B5BEF] md:text-[44px]">
              {upgradePrice}
            </p>
            <span className="inline-flex rounded-full bg-[#EEEEFF] px-3 py-1.5 text-[12px] font-black text-[#5B5BEF] md:text-[13px]">
              {locale === "ko" ? "완전판 사용자 한정" : "差額でアップグレード"}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-[40px] font-bold tabular-nums leading-none tracking-[-0.03em] text-[#A36818] md:text-[44px]">
              {standardPrice}
            </p>
          </div>
        </div>
      ))}
      <div
        className={`mt-4 flex ${align === "start" ? "" : "md:justify-center"}`}
      >
        <UnmeiCheckoutButton
          ownerToken={ownerToken}
          product={purchaseProduct}
          launchChat={launchChat}
          tone="premium"
          locale={locale}
          previewMode={previewMode}
        >
          {ctaLabel}
        </UnmeiCheckoutButton>
      </div>
      {locale === "ko" ? (
        <KoreanPurchaseLegalNotice
          className={`mt-3 max-w-[620px] ${align === "center" ? "mx-auto text-center" : "text-left"}`}
        />
      ) : null}
    </div>
  );
}
