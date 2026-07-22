"use client";

// ¥499 買い切り「フルアクセス(全解放)」の課金導線ボタン。
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

export function FullAccessCta({
  children = "¥499で全部よむ",
  // ページの owner_token (= 解放対象の本人)。Cookie 不在のスマホでも課金できるよう
  // サーバに本人解決の手がかりとして渡す。省略時は Cookie(session) fallback。
  ownerToken,
  // 未ログイン(401)時の遷移先。匿名だと「解放する自分のトリセツ」がまだ無いので
  // 決済できない → まず診断へ funnel (診断→トリセツ作成→課金 の橋渡し)。
  // 例: Safari シークレット/SPでCookie不在 かつ URL に owner_token が無い (/aisho) ケース。
  // /me・/tako は owner_token を渡すのでここには来ない (常に Stripe へ到達)。
  unauthHref = "/diagnosis",
  locale = "ja",
  source,
  returnTo,
}: {
  children?: React.ReactNode;
  ownerToken?: string;
  unauthHref?: string;
  locale?: ResultLocale;
  /** この購入CTA専用の導線ID。未指定時は同一ページ内の最終タッチを使う。 */
  source?: string;
  /** 購入後の着地。'tako' で /tako/[token] に戻す (既定は /me/[token])。 */
  returnTo?: "me" | "tako";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
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
      },
    });
    try {
      const res = await fetch("/api/checkout/create-full-access-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(ownerToken ? { owner_token: ownerToken } : {}),
          ...(returnTo ? { return_to: returnTo } : {}),
          paywall_source: paywallSource,
          locale,
        }),
      });
      // 既に課金済み → 本文が見られる状態なので再読込。
      if (res.status === 409) {
        window.location.reload();
        return;
      }
      // 未ログイン → 決済不能。トップへ funnel (アカウント作成→課金の橋渡し)。
      if (res.status === 401) {
        window.location.href = unauthHref;
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
      const data = (await res.json()) as { url?: unknown };
      if (typeof data.url === "string" && data.url.length > 0) {
        redirectToFullAccessCheckout(data.url);
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
        className="flex items-center justify-center w-full bg-[#2E2E5C] text-white font-black text-base px-6 py-3.5 rounded-full shadow-[0_4px_0_#1b1b3e] hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e] transition-all disabled:opacity-60 disabled:pointer-events-none"
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
    </div>
  );
}
