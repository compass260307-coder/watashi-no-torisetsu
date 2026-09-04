"use client";

// 日本版・韓国版の3コースで共用する課金導線ボタン。
// クリックで /api/checkout/create-full-access-session を叩き、返ってきた Stripe Checkout
// URL へ遷移する。金額・price はサーバ側 (Price 固定) で決まり、ここからは一切渡さない。
//
// PR2 (サーバゲート) 時点の最小実装。見た目の作り込みは PR3。
// ローディング / エラー表示を持つ (CLAUDE.md: エラー・ローディング・空状態を用意)。
// 既に full の場合 (409 already_full) はページを再読込して本文表示へ戻す。

import { useState } from "react";
import { normalizePaywallSource } from "@/lib/paywall-source";
import { redirectToFullAccessCheckout } from "@/lib/redirect-to-checkout";
import { track } from "@/lib/track";
import { getLastPaywallSource } from "@/lib/scroll-to-paywall";
import type { ResultLocale } from "@/i18n/result";
import {
  FULL_ACCESS_PRICE_JPY,
  FULL_ACCESS_PRICE_KRW,
  PREMIUM_BUNDLE_PRICE_JPY,
  PREMIUM_BUNDLE_PRICE_KRW,
  SELF_REPORT_PRICE_JPY,
  SELF_REPORT_PRICE_KRW,
  THREE_COURSE_PAYWALL_VERSION,
  type AccessProduct,
  type PaywallPlacement,
} from "@/lib/access-products";

export function FullAccessCta({
  children = "¥499で全部よむ",
  // ページの owner_token (= 解放対象の本人)。Cookie 不在のスマホでも課金できるよう
  // サーバに本人解決の手がかりとして渡す。省略時は Cookie(session) fallback。
  ownerToken,
  // 未ログイン(401)時の遷移先。匿名だと「解放する自分のトリセツ」がまだ無いので
  // 決済できない → まず診断へ funnel (診断→トリセツ作成→課金 の橋渡し)。
  // 例: Safari シークレット/SPでCookie不在 かつ URL に owner_token が無い (/aisho) ケース。
  // /me・/tako は owner_token を渡すのでここには来ない (常に Stripe へ到達)。
  unauthHref,
  locale = "ja",
  source,
  returnTo,
  product = "full_access",
  paywallVersion,
  placement,
  compact = false,
  previewMode = false,
}: {
  children?: React.ReactNode;
  ownerToken?: string;
  /** 未ログイン時の遷移先。省略時は locale に対応する診断ページ。 */
  unauthHref?: string;
  locale?: ResultLocale;
  /** この購入CTA専用の導線ID。未指定時は同一ページ内の最終タッチを使う。 */
  source?: string;
  /** 購入後の着地。診断・相性・運命の設計図の購入元へ戻す (既定は /me/[token])。 */
  returnTo?: "me" | "tako" | "aisho" | "unmei" | "hoshiyomi";
  /** self_report=¥199 / full_access=¥499 / premium_bundle=¥899全部入り。 */
  product?: AccessProduct;
  /** 3コース比較テストの識別子。未指定は旧単一カード。 */
  paywallVersion?: typeof THREE_COURSE_PAYWALL_VERSION;
  /** 同じカードの常設表示とモーダル表示を分ける。 */
  placement?: PaywallPlacement;
  /** 比較カード内では38px固定のコンパクトな高さにする。 */
  compact?: boolean;
  /** ローカルUI確認用。CTAを押しても計測・Checkoutを実行しない。 */
  previewMode?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState(false);
  const resolvedUnauthHref =
    unauthHref ?? (locale === "ko" ? "/ko/diagnosis" : "/diagnosis");

  async function handleClick() {
    if (loading) return;
    if (previewMode) {
      setPreviewNotice(true);
      return;
    }
    setLoading(true);
    setError(null);
    const paywallSource = source
      ? normalizePaywallSource(source)
      : getLastPaywallSource();
    // 課金ファネル計測: 購入CTAクリック = checkout 要求。結果 (409/401/成功) に
    // かかわらずクリック自体を数える。Stripe 到達はサーバ側 checkout_session_created。
    track("purchase_cta_clicked", {
      ownerToken: ownerToken ?? null,
      metadata: {
        page: window.location.pathname.split("/")[1] || "top",
        source: paywallSource,
        locale,
        product,
        paywall_version: paywallVersion ?? "legacy",
        placement: placement ?? "unknown",
      },
    });
    try {
      const res = await fetch("/api/checkout/create-full-access-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(ownerToken ? { owner_token: ownerToken } : {}),
          ...(returnTo ? { return_to: returnTo } : {}),
          // /aisho からの購入は閲覧中のペア (?a=&b=) ごと戻せるようサーバへ渡す
          // (サーバ側で実在タイプIDのみ success/cancel URL に反映する)。
          ...(returnTo === "aisho"
            ? (() => {
                const q = new URLSearchParams(window.location.search);
                const a = q.get("a");
                const b = q.get("b");
                return a && b ? { aisho_a: a, aisho_b: b } : {};
              })()
            : {}),
          paywall_source: paywallSource,
          locale,
          product,
          ...(paywallVersion ? { paywall_version: paywallVersion } : {}),
          ...(placement ? { paywall_placement: placement } : {}),
        }),
      });
      // 既に課金済み → 本文が見られる状態なので再読込。
      if (res.status === 409) {
        window.location.reload();
        return;
      }
      // 未ログイン → 決済不能。各言語の診断へ funnel (診断→トリセツ作成→課金)。
      if (res.status === 401) {
        window.location.href = resolvedUnauthHref;
        return;
      }
      if (!res.ok) {
        setError(
          locale === "ko"
            ? "페이지를 열지 못했어요. 잠시 뒤 다시 시도해 주세요."
            : "うまく開けませんでした。少し待ってからもう一度お試しください。",
        );
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        url?: unknown;
        amount?: unknown;
        currency?: unknown;
      };
      if (typeof data.url === "string" && data.url.length > 0) {
        // meta_initiate_checkout の value/currency はサーバ応答の実売価格を使う。
        // 応答に無い場合 (旧レスポンスのキャッシュ等) だけロケール既定にフォールバック。
        redirectToFullAccessCheckout(data.url, {
          value:
            typeof data.amount === "number"
              ? data.amount
              : product === "self_report"
                ? locale === "ko"
                  ? SELF_REPORT_PRICE_KRW
                  : SELF_REPORT_PRICE_JPY
                : product === "premium_bundle"
                  ? locale === "ko"
                    ? PREMIUM_BUNDLE_PRICE_KRW
                    : PREMIUM_BUNDLE_PRICE_JPY
                : locale === "ko"
                  ? FULL_ACCESS_PRICE_KRW
                  : FULL_ACCESS_PRICE_JPY,
          currency:
            typeof data.currency === "string"
              ? data.currency
              : locale === "ko"
                ? "KRW"
                : "JPY",
        });
        return;
      }
      setError(
        locale === "ko"
          ? "페이지를 열지 못했어요. 잠시 뒤 다시 시도해 주세요."
          : "うまく開けませんでした。少し待ってからもう一度お試しください。",
      );
      setLoading(false);
    } catch {
      setError(
        locale === "ko"
          ? "통신에 실패했어요. 연결 상태가 좋은 곳에서 다시 시도해 주세요."
          : "通信に失敗しました。電波のいい場所でもう一度お試しください。",
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={`flex w-full items-center justify-center rounded-full bg-[#2E2E5C] px-6 text-white shadow-[0_4px_0_#1b1b3e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e] disabled:pointer-events-none disabled:opacity-60 ${
          compact
            ? "h-[38px] py-0 text-[14px] font-bold"
            : "py-3.5 text-base font-bold"
        }`}
      >
        {/* エラー後はリトライを明示 (ボタンは再度タップ可能=再試行できる) */}
        {loading
          ? locale === "ko" ? "열고 있어요…" : "ひらいています…"
          : error
            ? locale === "ko" ? "다시 시도하기 →" : "もう一度ためす →"
            : children}
      </button>
      {error && (
        <p className="mt-3 text-center text-[13px] font-bold text-[#E5544B]">
          {error}
          <br />
          <span className="text-[#8A8AA3]">
            {locale === "ko"
              ? "위 버튼으로 다시 시도해 주세요."
              : "上のボタンでもう一度お試しください。"}
          </span>
        </p>
      )}
      {previewNotice ? (
        <p
          role="status"
          className="mt-2 rounded-xl bg-[#F2F0FF] px-3 py-2 text-center text-[11px] font-bold leading-relaxed text-[#5B5BEF]"
        >
          ローカルプレビューのため、決済画面には進みません。
        </p>
      ) : null}
    </div>
  );
}
