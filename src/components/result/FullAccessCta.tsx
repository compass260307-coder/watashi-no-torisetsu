"use client";

// 日本版・韓国版の商品カードで共用する課金導線ボタン。
// クリックで /api/checkout/create-full-access-session を叩き、返ってきた Stripe Checkout
// URL へ遷移する。金額・price はサーバ側 (Price 固定) で決まり、ここからは一切渡さない。
//
// PR2 (サーバゲート) 時点の最小実装。見た目の作り込みは PR3。
// ローディング / エラー表示を持つ (CLAUDE.md: エラー・ローディング・空状態を用意)。
// 既に full の場合 (409 already_full) はページを再読込して本文表示へ戻す。

import { useState, type CSSProperties } from "react";
import { normalizePaywallSource } from "@/lib/paywall-source";
import { redirectToFullAccessCheckout } from "@/lib/redirect-to-checkout";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { getLastPaywallSource } from "@/lib/scroll-to-paywall";
import { readAdAttribution } from "@/lib/ad-attribution";
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

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function FullAccessCta({
  children = "全部入りを解放する",
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
  accentColor,
  shadowColor,
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
  /** 日本版: self_report=学生向け¥299 / full_access=完全版¥499。premium_bundleは専用面の上位商品。 */
  product?: AccessProduct;
  /** 商品比較テストの識別子。未指定は旧単一カード。 */
  paywallVersion?: typeof THREE_COURSE_PAYWALL_VERSION;
  /** 同じカードの常設表示とモーダル表示を分ける。 */
  placement?: PaywallPlacement;
  /** 比較カード内では38px固定のコンパクトな高さにする。 */
  compact?: boolean;
  /** ローカルUI確認用。CTAを押しても計測・Checkoutを実行しない。 */
  previewMode?: boolean;
  /** 結果グループに合わせたCTA色。未指定時は従来のネイビー。 */
  accentColor?: string;
  /** CTA下辺の立体影。accentColor と組で指定する。 */
  shadowColor?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState(false);
  const resolvedUnauthHref =
    unauthHref ?? (locale === "ko" ? "/ko/diagnosis" : "/diagnosis");
  const themedButtonStyle: CSSProperties | undefined = accentColor
    ? {
        backgroundColor: accentColor,
        boxShadow: `0 4px 0 ${shadowColor ?? accentColor}`,
      }
    : undefined;

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
    const { ttclid } = readAdAttribution();
    const ttp = readCookie("_ttp");
    const fbp = readCookie("_fbp");
    const fbc = readCookie("_fbc");
    // 課金ファネル計測: 購入CTAクリック = checkout 要求。結果 (409/401/成功) に
    // かかわらずクリック自体を数える。Stripe 到達はサーバ側 checkout_session_created。
    track("purchase_cta_clicked", {
      ownerToken: ownerToken ?? null,
      metadata: {
        page: trackingPageFromPathname(window.location.pathname),
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
          ...(ttclid ? { ttclid } : {}),
          ...(ttp ? { ttp } : {}),
          ...(fbp ? { fbp } : {}),
          ...(fbc ? { fbc } : {}),
          ...(paywallVersion ? { paywall_version: paywallVersion } : {}),
          ...(placement ? { paywall_placement: placement } : {}),
        }),
      });
      // 旧カードならクエリ付きでキャッシュを避けて現行カードへ復帰する。
      // 既に課金済みなら通常の再読込で本文表示へ戻す。
      if (res.status === 409) {
        const conflict = (await res.json().catch(() => null)) as {
          code?: unknown;
        } | null;
        if (conflict?.code === "stale_paywall") {
          const refreshUrl = new URL(window.location.href);
          refreshUrl.searchParams.set("paywall_refresh", String(Date.now()));
          window.location.replace(refreshUrl.toString());
          return;
        }
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
        style={themedButtonStyle}
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
