"use client";

// 友達診断 (/tako) 最下部の課金案内カード (tako_unlock 未購入時のみ)。
// デザインは /me の FullAccessPromoCard と完全に同じ (2026-07-20 指示):
//   グループ色の地 + 折り紙ダイヤ装飾 + 画像左カラム (md+) + ★バッジ +
//   見出し + ✓4項目 + 値引き表記 + 紺の全幅CTA + 返金保証行。
// 違いは中身だけ: 商品= tako_unlock (¥799 / 全解放オーナー ¥300)、
// CTA = create-tako-unlock-session への直接決済。
//
// id="tako-promo": ページ内のロックカードからの scrollToPaywall() のスクロール先
//   (着地パルスも同 id を対象にするため必ず維持)。

import { useEffect, useRef, useState } from "react";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { cardColorsForGroup, heroColorsForGroup } from "@/lib/hero-colors";
import { track } from "@/lib/track";
import { getLastPaywallSource } from "@/lib/scroll-to-paywall";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

// 表示用の価格コピー (実課金額はサーバ側 create-tako-unlock-session が決定する)。
const PRICE = { list: "¥799", sale: "¥300" } as const;

// 解放される項目 (見出し + マイクロコピー)。
// 見出しは「買うと何ができるか」のベネフィットで書く (2026-07-20 指示)。
// 個数の羅列は入れない。
const UNLOCKS: { title: string; desc: string }[] = [
  {
    title: "何度でも作り直せる、完全版PDFレポート",
    desc: "友達ごとの結果とメッセージを一冊にまとめてダウンロード。友達が増えたら、そのたびに最新版を作り直せます。",
  },
  {
    title: "自分では気づけないモテポイントを全開放",
    desc: "「場を明るくする太陽感」「動じない包容力」——まわりだけが知っているあなたの魅力を、友達の回答から言葉にします。もっとモテるためのアドバイスつき。",
  },
  {
    title: "ふたり専用の「仲良くなる攻略法」が手に入る",
    desc: "「思いつきはすぐ共有」「遠慮の無限ループに注意」——距離が縮まるコツから、やりがちなすれ違いの回避まで、ふたりの相性に合わせて読めます。",
  },
];

// カード隅の折り紙風ダイヤ装飾 (FullAccessPromoCard と同一)。
function CornerDecor({
  dark,
  mid,
  light,
  className,
  mirror = false,
}: {
  dark: string;
  mid: string;
  light: string;
  className?: string;
  mirror?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
    >
      <path d="M50 4 L4 50 L50 50 Z" fill={light} />
      <path d="M50 4 L96 50 L50 50 Z" fill={mid} />
      <path d="M96 50 L50 96 L50 50 Z" fill={dark} />
      <path d="M4 50 L50 96 L50 50 Z" fill={mid} />
    </svg>
  );
}

function CheckItem({
  title,
  desc,
  accent,
}: {
  title: string;
  desc: string;
  accent: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: accent }}
      >
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-black leading-snug text-[#2E2E5C]">
          {title}
        </span>
        <span className="body-gothic block text-[13px] leading-[1.6] text-[#5A5A6E]">
          {desc}
        </span>
      </span>
    </li>
  );
}

export function TakoPromoCard({
  ownerToken,
  discounted,
  imageSrc,
  imageAlt = "",
  group = "unknown",
}: {
  ownerToken: string;
  /** 全解放 (¥499) 保有者なら true → ¥499 OFF の ¥300 表示。 */
  discounted: boolean;
  imageSrc?: string | null;
  imageAlt?: string;
  group?: ThirtyTwoGroup;
}) {
  const tone = cardColorsForGroup(group);
  const midTone = heroColorsForGroup(group).heroBg;
  const hasImage = !!imageSrc;

  // 課金ファネル計測: カードがビューポートに入ったら paywall_viewed を1回送る
  // (FullAccessPromoCard と同ロジック。variant="tako" で区別)。
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const page = window.location.pathname.split("/")[1] || "top";
    const dedupKey = `torisetsu_paywall_viewed_tako_${page}`;
    try {
      if (sessionStorage.getItem(dedupKey)) return;
    } catch {
      /* noop */
    }
    const fire = () => {
      track("paywall_viewed", {
        ownerToken,
        metadata: { page, variant: "tako" },
      });
      try {
        sessionStorage.setItem(dedupKey, "1");
      } catch {
        /* noop */
      }
    };
    if (typeof IntersectionObserver === "undefined") {
      fire();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fire();
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ownerToken]);

  // CTA: tako_unlock の Checkout Session を作って遷移。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleBuy = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    // 課金ファネル計測: 購入CTAクリック (FullAccessCta と同形式。product で ¥799 を区別)。
    // 最終タッチ導線 (どのロックカードからここへ来たか) を購入まで引き継ぐ。
    const paywallSource = getLastPaywallSource();
    track("purchase_cta_clicked", {
      ownerToken,
      metadata: {
        page: window.location.pathname.split("/")[1] || "top",
        product: "tako_unlock",
        source: paywallSource,
      },
    });
    try {
      const res = await fetch("/api/checkout/create-tako-unlock-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, paywall_source: paywallSource }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        code?: string;
      };
      if (res.status === 409 && json.code === "already_unlocked") {
        window.location.reload();
        return;
      }
      if (!res.ok || !json.url) {
        setError("決済ページを開けませんでした。少し待ってもう一度どうぞ。");
        setLoading(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("決済ページを開けませんでした。少し待ってもう一度どうぞ。");
      setLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="tako-promo-title"
      className="px-4 pt-6 pb-10 md:px-8"
    >
      <div
        id="tako-promo"
        ref={cardRef}
        className={`relative mx-auto w-full scroll-mt-[80px] rounded-3xl border-2 shadow-[0_16px_48px_rgba(46,46,92,0.12)] ${
          hasImage
            ? "max-w-[1080px] md:flex md:items-stretch"
            : "max-w-[460px]"
        }`}
        style={{ backgroundColor: tone.softBg, borderColor: tone.border }}
      >
        {/* 右上・左下の折り紙風装飾 (カード角に半分被せて外へ) */}
        <CornerDecor
          dark={tone.accent}
          mid={midTone}
          light={tone.border}
          mirror
          className="pointer-events-none absolute -right-3 -top-3 z-10 h-14 w-14 rotate-[12deg] drop-shadow-sm md:h-16 md:w-16"
        />
        <CornerDecor
          dark={tone.accent}
          mid={midTone}
          light={tone.border}
          className="pointer-events-none absolute -bottom-3 -left-3 z-10 h-14 w-14 rotate-[-12deg] drop-shadow-sm md:h-16 md:w-16"
        />

        {/* 画像 (md+: 左カラム / モバイル: 上)。imageSrc があるときだけ。 */}
        {hasImage && (
          <div
            className="flex items-center justify-center rounded-t-3xl px-6 pt-7 md:w-[40%] md:rounded-l-3xl md:rounded-tr-none md:px-6 md:py-8"
            style={{ backgroundColor: tone.panelBg }}
          >
            <SmoothImage
              src={imageSrc!}
              alt={imageAlt}
              width={640}
              height={640}
              className="h-auto w-full max-w-[280px] md:max-w-[340px]"
            />
          </div>
        )}

        <div
          className={
            hasImage
              ? "px-6 py-6 text-left md:flex-1 md:px-9 md:py-6"
              : "px-6 py-6 text-center"
          }
        >
          {/* バッジ (★ + 今すぐロックを解除) */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-black text-[#2E2E5C] shadow-[0_2px_8px_rgba(46,46,92,0.10)]">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              style={{ color: tone.accent }}
            >
              <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
            </svg>
            今すぐロックを解除
          </span>

          {/* 見出し */}
          <h2
            id="tako-promo-title"
            className="mt-2.5 text-[27px] font-black leading-[1.3] text-[#2E2E5C] md:text-[32px]"
          >
            友達から見たあなたの
            <br />
            すべてを解放
          </h2>

          {/* 訴求 */}
          <p className="mt-2 text-[13.5px] font-bold leading-[1.6] text-[#5A5A72]">
            友達ごとの隠れモテポイントから、関係を深めるヒント・壊すワナまで、友達の回答から見えたあなたのぜんぶを1つのパッケージにまとめました。
          </p>

          {/* 解放される 4 項目 */}
          <ul
            className={`mt-4 grid gap-2.5 text-left ${
              hasImage ? "" : "mx-auto max-w-[320px]"
            }`}
          >
            {UNLOCKS.map(({ title, desc }) => (
              <CheckItem
                key={title}
                title={title}
                desc={desc}
                accent={tone.accent}
              />
            ))}
          </ul>

          {/* 価格の値引き表記 (割引は全解放オーナー特典として明示) */}
          <div
            className={`mt-5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 ${
              hasImage ? "" : "justify-center"
            }`}
          >
            {discounted ? (
              <>
                <span
                  className="rounded-md px-2 py-0.5 text-[12px] font-black text-white"
                  style={{ backgroundColor: tone.accent }}
                >
                  全解放オーナー ¥499OFF
                </span>
                <span className="text-[16px] font-bold text-[#A0A0B4] line-through">
                  {PRICE.list}
                </span>
                <span
                  className="text-[36px] font-black leading-none"
                  style={{ color: tone.accent }}
                >
                  {PRICE.sale}
                </span>
              </>
            ) : (
              <span
                className="text-[36px] font-black leading-none"
                style={{ color: tone.accent }}
              >
                {PRICE.list}
              </span>
            )}
          </div>

          {/* CTA (FullAccessCta と同スタイルの紺・全幅ピル) */}
          <div className="mt-4 w-full">
            <button
              onClick={handleBuy}
              disabled={loading}
              className="flex w-full items-center justify-center rounded-full bg-[#2E2E5C] px-6 py-3.5 text-base font-black text-white shadow-[0_4px_0_#1b1b3e] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#1b1b3e] active:translate-y-1 active:shadow-[0_0_0_#1b1b3e] disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? "決済ページへ移動中…" : "すべてのロックを解除"}
            </button>
            {error && (
              <p className="mt-3 text-center text-[13px] font-bold text-[#E5544B]">
                {error}
              </p>
            )}
          </div>

          {/* 30日間の返金保証 (/me と同一) */}
          <p
            className={`mt-2.5 flex items-center gap-1.5 text-[12px] font-bold text-[#7A7A92] ${
              hasImage ? "justify-center md:justify-start" : "justify-center"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            30日間の返金保証つき
          </p>
        </div>
      </div>
    </section>
  );
}
